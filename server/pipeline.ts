import crypto from 'node:crypto';
import Parser from 'rss-parser';
import { db, getSettingsMap } from './db.ts';
import { analyzeBatchWithAI } from './ai.ts';
import { RECORDED_SNAPSHOT_ENTRIES, type RawFeedEntry } from './snapshotData.ts';
import type {
  BulletinRecord,
  CollectionRun,
  DedupMethod,
  ScientificMetrics,
  VeilleDomain,
  VeilleItem,
  VeilleSource,
} from '../src/types/veille.ts';

const rssParser = new Parser({
  timeout: 6500,
  headers: {
    'User-Agent': 'VigieLab-Veille-Bot/1.0 (+https://vigielab.local)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  },
});

export function normalizeCanonicalUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'fbclid',
      'gclid',
    ];
    for (const p of trackingParams) {
      u.searchParams.delete(p);
    }
    u.hash = '';
    const cleanPath = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.replace(/^www\./, '').toLowerCase()}${cleanPath}${u.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function normalizeTextTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export function computeContentHash(title: string): string {
  const tokens = normalizeTextTokens(title).join(' ');
  return crypto.createHash('sha256').update(tokens).digest('hex');
}

export function computeJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeTextTokens(a));
  const setB = new Set(normalizeTextTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function runCollectionPipeline(options?: {
  mode?: 'live_rss' | 'snapshot' | 'hybride';
  resetDemo?: boolean;
}): Promise<CollectionRun> {
  const startedAt = new Date();
  const settings = getSettingsMap();
  const mode = options?.mode ?? (settings.collectionMode as 'live_rss' | 'snapshot' | 'hybride') ?? 'snapshot';
  const threshold = parseFloat(settings.dedupThreshold ?? '0.72') || 0.72;

  if (options?.resetDemo) {
    db.prepare('DELETE FROM items').run();
  }

  const enabledSources = db
    .prepare('SELECT * FROM sources WHERE enabled = 1')
    .all() as Array<{
    id: string;
    name: string;
    url: string;
    default_domain: VeilleDomain;
    source_type: string;
  }>;

  const keywordsRows = db.prepare('SELECT term, domain, weight FROM keywords').all() as Array<{
    term: string;
    domain: string;
    weight: number;
  }>;
  const keywordTerms = keywordsRows.map((k) => k.term);

  const rawEntries: RawFeedEntry[] = [];
  let liveSuccessCount = 0;
  const logNotes: string[] = [];

  if (mode === 'live_rss' || mode === 'hybride') {
    await Promise.all(
      enabledSources.map(async (source) => {
        try {
          const feed = await rssParser.parseURL(source.url);
          const feedItems = (feed.items ?? []).slice(0, 6);
          for (const entry of feedItems) {
            if (!entry.title || !entry.link) continue;
            rawEntries.push({
              sourceId: source.id,
              sourceName: source.name,
              title: entry.title.trim(),
              link: entry.link.trim(),
              publishedAt: entry.isoDate ?? entry.pubDate ?? new Date().toISOString(),
              excerpt: stripHtml(entry.contentSnippet ?? entry.content ?? entry.summary ?? entry.title).slice(0, 900),
              fallbackDomain: source.default_domain,
            });
          }
          liveSuccessCount++;
          db.prepare('UPDATE sources SET last_fetched_at = ?, last_status = ? WHERE id = ?').run(
            new Date().toISOString(),
            `RSS OK (${feedItems.length} flux)`,
            source.id
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Indisponible';
          db.prepare('UPDATE sources SET last_fetched_at = ?, last_status = ? WHERE id = ?').run(
            new Date().toISOString(),
            mode === 'hybride' ? 'Repli jeu enregistré' : `Erreur RSS: ${msg.slice(0, 40)}`,
            source.id
          );
          logNotes.push(`${source.name}: hors ligne (${msg.slice(0, 35)})`);
        }
      })
    );
  }

  // Fallback or explicit snapshot mode ("jeu de données enregistré pour démonstration reproductible")
  if (mode === 'snapshot' || (mode === 'hybride' && rawEntries.length < 4)) {
    const enabledIds = new Set(enabledSources.map((s) => s.id));
    for (const snap of RECORDED_SNAPSHOT_ENTRIES) {
      if (enabledIds.size === 0 || enabledIds.has(snap.sourceId)) {
        rawEntries.push(snap);
      }
    }
    if (mode === 'snapshot') {
      for (const source of enabledSources) {
        db.prepare('UPDATE sources SET last_fetched_at = ?, last_status = ? WHERE id = ?').run(
          new Date().toISOString(),
          'Jeu enregistré actif',
          source.id
        );
      }
    }
    logNotes.push(`Jeu enregistré chargé (${RECORDED_SNAPSHOT_ENTRIES.length} entrées de référence)`);
  }

  // Existing unique items for deduplication lookup
  const existingUnique = db
    .prepare('SELECT id, title, canonical_url, content_hash FROM items WHERE is_duplicate = 0')
    .all() as Array<{
    id: string;
    title: string;
    canonical_url: string;
    content_hash: string;
  }>;

  const uniquePool = [...existingUnique];
  const existingAllUrls = new Set(
    (db.prepare('SELECT original_url FROM items').all() as Array<{ original_url: string }>).map(
      (r) => r.original_url
    )
  );

  interface CandidateItem {
    tempId: string;
    entry: RawFeedEntry;
    canonicalUrl: string;
    contentHash: string;
    isDuplicate: boolean;
    duplicateOfId: string | null;
    dedupMethod: DedupMethod;
    similarityScore: number | null;
    matchedKeywords: string[];
    baseScore: number;
  }

  const candidates: CandidateItem[] = [];
  let duplicatesCount = 0;

  for (let idx = 0; idx < rawEntries.length; idx++) {
    const entry = rawEntries[idx];
    // Skip exact same original_url already stored from a previous run unless resetDemo
    if (existingAllUrls.has(entry.link)) {
      continue;
    }
    existingAllUrls.add(entry.link);

    const canonicalUrl = normalizeCanonicalUrl(entry.link);
    const contentHash = computeContentHash(entry.title);

    let isDuplicate = false;
    let duplicateOfId: string | null = null;
    let dedupMethod: DedupMethod = null;
    let similarityScore: number | null = null;

    // Step 1: Canonical URL match
    const urlMatch = uniquePool.find((u) => u.canonical_url === canonicalUrl);
    if (urlMatch) {
      isDuplicate = true;
      duplicateOfId = urlMatch.id;
      dedupMethod = 'url_canonique';
      similarityScore = 1.0;
    }

    // Step 2: SHA-256 normalized title hash match
    if (!isDuplicate) {
      const hashMatch = uniquePool.find((u) => u.content_hash === contentHash);
      if (hashMatch) {
        isDuplicate = true;
        duplicateOfId = hashMatch.id;
        dedupMethod = 'hash_sha256';
        similarityScore = 1.0;
      }
    }

    // Step 3: Jaccard lexical similarity on normalized titles
    if (!isDuplicate) {
      let bestSim = 0;
      let bestId: string | null = null;
      for (const u of uniquePool) {
        const sim = computeJaccardSimilarity(entry.title, u.title);
        if (sim > bestSim) {
          bestSim = sim;
          bestId = u.id;
        }
      }
      if (bestSim >= threshold && bestId) {
        isDuplicate = true;
        duplicateOfId = bestId;
        dedupMethod = 'similarite_jaccard';
        similarityScore = Number(bestSim.toFixed(2));
      }
    }

    const tempId = `item-${crypto.randomUUID().slice(0, 8)}`;

    // Match user keywords
    const haystack = `${entry.title} ${entry.excerpt}`.toLowerCase();
    const matchedKeywords: string[] = [];
    let kwScore = 45;
    for (const kw of keywordsRows) {
      if (haystack.includes(kw.term.toLowerCase())) {
        matchedKeywords.push(kw.term);
        kwScore += kw.weight * 6;
      }
    }

    if (isDuplicate) {
      duplicatesCount++;
    } else {
      uniquePool.push({
        id: tempId,
        title: entry.title,
        canonical_url: canonicalUrl,
        content_hash: contentHash,
      });
    }

    candidates.push({
      tempId,
      entry,
      canonicalUrl,
      contentHash,
      isDuplicate,
      duplicateOfId,
      dedupMethod,
      similarityScore,
      matchedKeywords,
      baseScore: Math.min(75, kwScore),
    });
  }

  // Only run AI synthesis on non-duplicate items to save compute/tokens
  const uniqueCandidates = candidates.filter((c) => !c.isDuplicate);
  const aiMap = await analyzeBatchWithAI(
    uniqueCandidates.map((c) => ({
      tempId: c.tempId,
      title: c.entry.title,
      excerpt: c.entry.excerpt,
      sourceName: c.entry.sourceName,
      fallbackDomain: c.entry.fallbackDomain,
    })),
    keywordTerms,
    {
      preferLocalOllama: settings.preferLocalOllama === 'true',
      ollamaEndpoint: settings.ollamaEndpoint ?? 'http://localhost:11434',
      ollamaModel: settings.ollamaModel ?? 'mistral',
    }
  );

  const insertItemStmt = db.prepare(`
    INSERT INTO items (
      id, title, canonical_url, original_url, content_hash, source_id, source_name,
      published_at, collected_at, raw_excerpt, ai_summary, key_points_json,
      domain, opportunity_type, matched_keywords_json, relevance_score, ai_engine,
      human_relevant, summary_rating, is_duplicate, duplicate_of_id, dedup_method, similarity_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
  `);

  const nowIso = new Date().toISOString();
  let newUniqueCount = 0;

  for (const c of candidates) {
    const aiRes = aiMap.get(c.tempId);
    const domain = aiRes?.domain ?? c.entry.fallbackDomain;
    const opportunityType = aiRes?.opportunityType ?? 'Publication technique';
    const aiSummary = c.isDuplicate
      ? `Doublon écarté automatiquement (${c.dedupMethod ?? 'similaire'}).`
      : aiRes?.aiSummary ?? c.entry.excerpt;
    const keyPoints = aiRes?.keyPoints ?? [];
    const relevanceScore = c.isDuplicate
      ? 0
      : Math.min(99, c.baseScore + (aiRes?.relevanceBoost ?? 10));
    const aiEngine = c.isDuplicate ? 'Filtre déduplication' : aiRes?.aiEngine ?? 'Analyseur local';

    insertItemStmt.run(
      c.tempId,
      c.entry.title,
      c.canonicalUrl,
      c.entry.link,
      c.contentHash,
      c.entry.sourceId,
      c.entry.sourceName,
      c.entry.publishedAt,
      nowIso,
      c.entry.excerpt,
      aiSummary,
      JSON.stringify(keyPoints),
      domain,
      opportunityType,
      JSON.stringify(c.matchedKeywords),
      relevanceScore,
      aiEngine,
      c.isDuplicate ? 1 : 0,
      c.duplicateOfId,
      c.dedupMethod,
      c.similarityScore
    );

    if (!c.isDuplicate) newUniqueCount++;
  }

  // Update item counts per source
  db.exec(`
    UPDATE sources
    SET item_count = (
      SELECT COUNT(*) FROM items WHERE items.source_id = sources.id AND items.is_duplicate = 0
    )
  `);

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const runRecord: CollectionRun = {
    id: `run-${crypto.randomUUID().slice(0, 8)}`,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    mode,
    sourcesCount: enabledSources.length,
    rawFetched: candidates.length,
    duplicatesRemoved: duplicatesCount,
    newItems: newUniqueCount,
    durationMs,
    status: mode === 'live_rss' && liveSuccessCount === 0 ? 'erreur' : logNotes.length > 0 && mode === 'live_rss' ? 'partiel' : 'succes',
    logSummary:
      candidates.length === 0
        ? 'Aucun nouvel élément inédit détecté depuis la dernière collecte.'
        : `${newUniqueCount} nouvelles opportunités synthétisées, ${duplicatesCount} doublon(s) filtré(s). ${logNotes.join(' · ')}`.trim(),
  };

  db.prepare(`
    INSERT INTO collection_runs (
      id, started_at, finished_at, mode, sources_count, raw_fetched,
      duplicates_removed, new_items, duration_ms, status, log_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runRecord.id,
    runRecord.startedAt,
    runRecord.finishedAt,
    runRecord.mode,
    runRecord.sourcesCount,
    runRecord.rawFetched,
    runRecord.duplicatesRemoved,
    runRecord.newItems,
    runRecord.durationMs,
    runRecord.status,
    runRecord.logSummary
  );

  return runRecord;
}

export function mapRowToItem(row: Record<string, unknown>): VeilleItem {
  return {
    id: String(row.id),
    title: String(row.title),
    canonicalUrl: String(row.canonical_url),
    originalUrl: String(row.original_url),
    contentHash: String(row.content_hash),
    sourceId: String(row.source_id),
    sourceName: String(row.source_name),
    publishedAt: String(row.published_at),
    collectedAt: String(row.collected_at),
    rawExcerpt: String(row.raw_excerpt),
    aiSummary: String(row.ai_summary),
    keyPoints: JSON.parse(String(row.key_points_json || '[]')),
    domain: String(row.domain) as VeilleDomain,
    opportunityType: String(row.opportunity_type) as VeilleItem['opportunityType'],
    matchedKeywords: JSON.parse(String(row.matched_keywords_json || '[]')),
    relevanceScore: Number(row.relevance_score),
    aiEngine: String(row.ai_engine),
    humanRelevant: row.human_relevant === null || row.human_relevant === undefined ? null : Number(row.human_relevant),
    summaryRating: row.summary_rating === null || row.summary_rating === undefined ? null : Number(row.summary_rating),
    isDuplicate: Boolean(row.is_duplicate),
    duplicateOfId: row.duplicate_of_id ? String(row.duplicate_of_id) : null,
    duplicateOfTitle: row.duplicate_of_title ? String(row.duplicate_of_title) : null,
    dedupMethod: (row.dedup_method as DedupMethod) ?? null,
    similarityScore: row.similarity_score !== null && row.similarity_score !== undefined ? Number(row.similarity_score) : null,
  };
}

export function computeScientificMetrics(): ScientificMetrics {
  const counts = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_duplicate = 0 THEN 1 ELSE 0 END) as unique_cnt,
        SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as dup_cnt,
        SUM(CASE WHEN dedup_method = 'url_canonique' THEN 1 ELSE 0 END) as m_url,
        SUM(CASE WHEN dedup_method = 'hash_sha256' THEN 1 ELSE 0 END) as m_hash,
        SUM(CASE WHEN dedup_method = 'similarite_jaccard' THEN 1 ELSE 0 END) as m_jaccard,
        SUM(CASE WHEN is_duplicate = 0 AND human_relevant IS NOT NULL THEN 1 ELSE 0 END) as eval_cnt,
        SUM(CASE WHEN is_duplicate = 0 AND human_relevant = 1 THEN 1 ELSE 0 END) as rel_cnt,
        AVG(CASE WHEN is_duplicate = 0 AND summary_rating IS NOT NULL THEN summary_rating END) as avg_rating
       FROM items`
    )
    .get() as Record<string, number | null>;

  const totalRawCollected = Number(counts.total ?? 0);
  const uniqueRetained = Number(counts.unique_cnt ?? 0);
  const duplicatesRemoved = Number(counts.dup_cnt ?? 0);
  const deduplicationRate = totalRawCollected > 0 ? Number(((duplicatesRemoved / totalRawCollected) * 100).toFixed(1)) : 0;

  const evaluatedCount = Number(counts.eval_cnt ?? 0);
  const relevantCount = Number(counts.rel_cnt ?? 0);
  const precisionRate = evaluatedCount > 0 ? Number(((relevantCount / evaluatedCount) * 100).toFixed(1)) : null;
  const avgSummaryRating = counts.avg_rating !== null && counts.avg_rating !== undefined ? Number(Number(counts.avg_rating).toFixed(2)) : null;

  const ratingRows = db
    .prepare(
      `SELECT summary_rating as rating, COUNT(*) as count
       FROM items
       WHERE is_duplicate = 0 AND summary_rating IS NOT NULL
       GROUP BY summary_rating
       ORDER BY summary_rating ASC`
    )
    .all() as Array<{ rating: number; count: number }>;

  const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: ratingRows.find((row) => row.rating === r)?.count ?? 0,
  }));

  const domainBreakdown = db
    .prepare(
      `SELECT domain, COUNT(*) as count, ROUND(AVG(relevance_score), 1) as avgRelevance
       FROM items
       WHERE is_duplicate = 0
       GROUP BY domain
       ORDER BY count DESC`
    )
    .all() as Array<{ domain: string; count: number; avgRelevance: number }>;

  const sourceRows = db
    .prepare(
      `SELECT
        source_name as sourceName,
        COUNT(*) as total,
        SUM(CASE WHEN is_duplicate = 0 THEN 1 ELSE 0 END) as uniqueCount,
        SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicateCount
       FROM items
       GROUP BY source_name
       ORDER BY total DESC`
    )
    .all() as Array<{
    sourceName: string;
    total: number;
    uniqueCount: number;
    duplicateCount: number;
  }>;

  const sourceStats = sourceRows.map((s) => ({
    ...s,
    dedupRate: s.total > 0 ? Number(((s.duplicateCount / s.total) * 100).toFixed(1)) : 0,
  }));

  return {
    totalRawCollected,
    uniqueRetained,
    duplicatesRemoved,
    deduplicationRate,
    dedupByMethod: {
      url_canonique: Number(counts.m_url ?? 0),
      hash_sha256: Number(counts.m_hash ?? 0),
      similarite_jaccard: Number(counts.m_jaccard ?? 0),
    },
    evaluatedCount,
    relevantCount,
    precisionRate,
    avgSummaryRating,
    ratingDistribution,
    domainBreakdown,
    sourceStats,
  };
}

export function generateBulletin(params: {
  cadence: 'quotidien' | 'hebdomadaire';
  domains: string[];
  minRelevance: number;
  title?: string;
}): BulletinRecord {
  const rows = db
    .prepare('SELECT * FROM items WHERE is_duplicate = 0 AND relevance_score >= ? ORDER BY relevance_score DESC, published_at DESC')
    .all(params.minRelevance) as Array<Record<string, unknown>>;

  let items = rows.map(mapRowToItem);
  if (params.domains.length > 0) {
    items = items.filter((i) => params.domains.includes(i.domain));
  }
  items = items.slice(0, 20);

  const now = new Date();
  const dateFr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const title =
    params.title?.trim() ||
    `Bulletin de veille ${params.cadence === 'quotidien' ? 'quotidien' : 'hebdomadaire'} — ${dateFr}`;
  const periodLabel = params.cadence === 'quotidien' ? `Édition du ${dateFr}` : `Semaine du ${dateFr}`;

  const grouped = new Map<string, VeilleItem[]>();
  for (const item of items) {
    const list = grouped.get(item.domain) ?? [];
    list.push(item);
    grouped.set(item.domain, list);
  }

  let md = `# ${title}\n\n`;
  md += `**Période :** ${periodLabel}  \n`;
  md += `**Opportunités sélectionnées :** ${items.length} (score minimal : ${params.minRelevance}/100)\n\n---\n\n`;

  for (const [domain, list] of grouped.entries()) {
    md += `## ${domain} (${list.length})\n\n`;
    for (const item of list) {
      const pubDate = new Date(item.publishedAt).toLocaleDateString('fr-FR');
      md += `### ${item.title}\n`;
      md += `- **Source :** ${item.sourceName} | **Type :** ${item.opportunityType} | **Date :** ${pubDate} | **Pertinence :** ${item.relevanceScore}/100\n`;
      md += `- **Résumé IA :** ${item.aiSummary}\n`;
      if (item.keyPoints.length > 0) {
        md += `- **Points clés :** ${item.keyPoints.join(' · ')}\n`;
      }
      md += `- **Lien d'origine :** ${item.originalUrl}\n\n`;
    }
  }

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let htmlSections = '';
  for (const [domain, list] of grouped.entries()) {
    htmlSections += `<section style="margin-bottom:28px;">
      <h2 style="font-size:18px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;color:#0f172a;">${escapeHtml(domain)} (${list.length})</h2>`;
    for (const item of list) {
      const pubDate = new Date(item.publishedAt).toLocaleDateString('fr-FR');
      htmlSections += `<article style="margin:16px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${escapeHtml(item.sourceName)} · ${escapeHtml(item.opportunityType)} · ${escapeHtml(pubDate)} · Score ${item.relevanceScore}/100</div>
        <h3 style="margin:0 0 8px 0;font-size:16px;color:#0f172a;">${escapeHtml(item.title)}</h3>
        <p style="margin:0 0 8px 0;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(item.aiSummary)}</p>
        <a href="${escapeHtml(item.originalUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:#1d4ed8;text-decoration:none;">Consulter la source d'origine →</a>
      </article>`;
    }
    htmlSections += `</section>`;
  }

  const htmlContent = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:840px;margin:40px auto;padding:0 20px;background:#f8fafc;color:#0f172a;">
  <header style="margin-bottom:32px;border-bottom:2px solid #0f172a;padding-bottom:16px;">
    <div style="font-size:12px;color:#475569;margin-bottom:6px;">VigieLab — Bulletin de veille technologique</div>
    <h1 style="margin:0 0 8px 0;font-size:26px;">${escapeHtml(title)}</h1>
    <div style="font-size:13px;color:#475569;">${escapeHtml(periodLabel)} · ${items.length} publications retenues</div>
  </header>
  ${htmlSections}
</body>
</html>`;

  const record: BulletinRecord = {
    id: `bul-${crypto.randomUUID().slice(0, 8)}`,
    title,
    cadence: params.cadence,
    periodLabel,
    createdAt: now.toISOString(),
    itemIds: items.map((i) => i.id),
    markdownContent: md,
    htmlContent,
  };

  db.prepare(`
    INSERT INTO bulletins (id, title, cadence, period_label, created_at, item_ids_json, markdown_content, html_content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.title,
    record.cadence,
    record.periodLabel,
    record.createdAt,
    JSON.stringify(record.itemIds),
    record.markdownContent,
    record.htmlContent
  );

  return record;
}

export function buildN8nWorkflowJson(sources: VeilleSource[]): string {
  const rssNodes = sources.slice(0, 5).map((s, idx) => ({
    parameters: { url: s.url },
    id: `rss-${idx + 1}`,
    name: `RSS ${s.name}`,
    type: 'n8n-nodes-base.rssFeedRead',
    typeVersion: 1,
    position: [320, 120 + idx * 140],
  }));

  const workflow = {
    name: 'VigieLab - Collecte RSS, Déduplication & Synthèse Ollama',
    nodes: [
      {
        parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 24 }] } },
        id: 'schedule-trigger',
        name: 'Déclencheur Quotidien',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [80, 320],
      },
      ...rssNodes,
      {
        parameters: { mode: 'append' },
        id: 'merge-feeds',
        name: 'Fusion des Flux',
        type: 'n8n-nodes-base.merge',
        typeVersion: 3,
        position: [600, 320],
      },
      {
        parameters: {
          jsCode:
            '// Normalisation URL & empreinte SHA-256 pour déduplication\nconst seen = new Set();\nreturn items.filter(item => {\n  const url = (item.json.link || "").split("?")[0].replace(/\\/$/, "");\n  if (seen.has(url)) return false;\n  seen.add(url);\n  item.json.canonicalUrl = url;\n  return true;\n});',
        },
        id: 'dedup-code',
        name: 'Déduplication Canonique',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [840, 320],
      },
      {
        parameters: {
          method: 'POST',
          url: 'http://localhost:11434/api/generate',
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: 'model', value: 'mistral' },
              {
                name: 'prompt',
                value:
                  '={{ "Résume en 2 phrases en français et classe dans [IA, Cybersécurité, Cloud, Développement, Appels à projets] : " + $json.title + " - " + $json.contentSnippet }}',
              },
              { name: 'stream', value: false },
            ],
          },
        },
        id: 'ollama-summarize',
        name: 'Synthèse Ollama (Local)',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [1080, 320],
      },
    ],
    connections: {
      'Déclencheur Quotidien': {
        main: [rssNodes.map((n) => ({ node: n.name, type: 'main', index: 0 }))],
      },
      ...Object.fromEntries(
        rssNodes.map((n, i) => [n.name, { main: [[{ node: 'Fusion des Flux', type: 'main', index: i === 0 ? 0 : 1 }]] }])
      ),
      'Fusion des Flux': { main: [[{ node: 'Déduplication Canonique', type: 'main', index: 0 }]] },
      'Déduplication Canonique': { main: [[{ node: 'Synthèse Ollama (Local)', type: 'main', index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: 'v1' },
  };

  return JSON.stringify(workflow, null, 2);
}

export function buildPythonCollectorScript(): string {
  return `#!/usr/bin/env python3
"""
Script de collecte, déduplication SQLite et synthèse Ollama
Projet : Plateforme de veille intelligente (VigieLab)
Dépendances : pip install feedparser requests
"""
import hashlib
import json
import sqlite3
from datetime import datetime
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import feedparser
import requests

DB_PATH = "veille.db"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"

SOURCES = [
    ("CERT-FR", "https://www.cert.ssi.gouv.fr/avis/feed/", "Cybersécurité"),
    ("Inria", "https://www.inria.fr/fr/rss.xml", "Recherche"),
    ("arXiv cs.AI", "https://rss.arxiv.org/rss/cs.AI", "IA"),
    ("CNCF", "https://www.cncf.io/blog/feed/", "Cloud"),
]

def canonical_url(url: str) -> str:
    p = urlparse(url.strip())
    q = [(k, v) for k, v in parse_qsl(p.query) if not k.startswith("utm_")]
    return urlunparse((p.scheme, p.netloc.lower().lstrip("www."), p.path.rstrip("/"), "", urlencode(q), ""))

def title_hash(title: str) -> str:
    norm = " ".join(title.lower().split())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()

def summarize_with_ollama(title: str, excerpt: str) -> dict:
    prompt = (
        "Réponds en JSON avec les clés summary (2 phrases en français) et domain "
        "(IA, Cybersécurité, Cloud, Développement, Appels à projets, Recherche).\\n"
        f"Titre: {title}\\nExtrait: {excerpt[:600]}"
    )
    resp = requests.post(
        OLLAMA_URL,
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "format": "json"},
        timeout=20,
    )
    resp.raise_for_status()
    return json.loads(resp.json()["response"])

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS veille_py (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT, canonical_url TEXT UNIQUE, title_hash TEXT UNIQUE,
            source TEXT, domain TEXT, summary TEXT, published_at TEXT
        )
    """)
    for source_name, feed_url, default_domain in SOURCES:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries[:5]:
            c_url = canonical_url(entry.link)
            t_hash = title_hash(entry.title)
            if cur.execute("SELECT 1 FROM veille_py WHERE canonical_url=? OR title_hash=?", (c_url, t_hash)).fetchone():
                continue
            try:
                ai = summarize_with_ollama(entry.title, getattr(entry, "summary", ""))
            except Exception:
                ai = {"summary": getattr(entry, "summary", entry.title)[:240], "domain": default_domain}
            cur.execute(
                "INSERT INTO veille_py (title, canonical_url, title_hash, source, domain, summary, published_at) VALUES (?,?,?,?,?,?,?)",
                (entry.title, c_url, t_hash, source_name, ai.get("domain", default_domain), ai.get("summary", ""), datetime.utcnow().isoformat()),
            )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
`;
}
