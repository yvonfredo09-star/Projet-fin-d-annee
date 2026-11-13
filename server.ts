import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { db, getSettingsMap, hashPassword, initDatabase, verifyPassword } from './server/db.ts';
import {
  buildN8nWorkflowJson,
  buildPythonCollectorScript,
  computeScientificMetrics,
  generateBulletin,
  mapRowToItem,
  runCollectionPipeline,
} from './server/pipeline.ts';
import { analyzeBatchWithAI } from './server/ai.ts';
import type { UserAccount, VeilleSource } from './src/types/veille.ts';

function mapRowToUser(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    role: String(row.role),
    organization: String(row.organization),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function getAuthenticatedUser(req: express.Request): UserAccount | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const session = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as { user_id: string; expires_at: string } | undefined;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as
    | Record<string, unknown>
    | undefined;
  return userRow ? mapRowToUser(userRow) : null;
}

function createSessionToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 3600_000);
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    now.toISOString(),
    expires.toISOString()
  );
  return token;
}

async function startServer() {
  initDatabase();

  // Seed initial reproducible dataset on first boot so the dashboard is immediately populated
  const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number };
  if (itemCount.cnt === 0) {
    await runCollectionPipeline({ mode: 'snapshot' });
  }

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // --- AUTHENTICATION & USERS CRUD ROUTES ---

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Session expirée ou non authentifiée.' });
      return;
    }
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    const { fullName, email, password, role, organization } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      role?: string;
      organization?: string;
    };

    const cleanEmail = email?.trim().toLowerCase() ?? '';
    const cleanName = fullName?.trim() ?? '';

    if (!cleanName || !cleanEmail || !password || password.length < 6) {
      res.status(400).json({
        error: 'Nom complet, adresse e-mail valide et mot de passe (6 caractères min.) requis.',
      });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
      return;
    }

    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, full_name, email, password_hash, role, organization, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      cleanName,
      cleanEmail,
      hashPassword(password),
      role?.trim() || 'Analyste Veille',
      organization?.trim() || 'Laboratoire R&D',
      now,
      now
    );

    const token = createSessionToken(id);
    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({ token, user: mapRowToUser(created) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = email?.trim().toLowerCase() ?? '';
    if (!cleanEmail || !password) {
      res.status(400).json({ error: 'Adresse e-mail et mot de passe requis.' });
      return;
    }

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as
      | Record<string, unknown>
      | undefined;
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      res.status(401).json({ error: 'Identifiants incorrects.' });
      return;
    }

    const user = mapRowToUser(row);
    const token = createSessionToken(user.id);
    res.json({ token, user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.json({ ok: true });
  });

  app.get('/api/users', (req, res) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const rows = db
      .prepare('SELECT * FROM users ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;
    res.json({ users: rows.map(mapRowToUser) });
  });

  app.post('/api/users', (req, res) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const { fullName, email, password, role, organization } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      role?: string;
      organization?: string;
    };
    const cleanEmail = email?.trim().toLowerCase() ?? '';
    const cleanName = fullName?.trim() ?? '';
    if (!cleanName || !cleanEmail || !password || password.length < 6) {
      res.status(400).json({
        error: 'Nom complet, e-mail et mot de passe (6 caractères min.) requis.',
      });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée.' });
      return;
    }

    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, full_name, email, password_hash, role, organization, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      cleanName,
      cleanEmail,
      hashPassword(password),
      role?.trim() || 'Analyste Veille',
      organization?.trim() || 'Laboratoire R&D',
      now,
      now
    );

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({ user: mapRowToUser(created) });
  });

  app.patch('/api/users/:id', (req, res) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Utilisateur introuvable.' });
      return;
    }

    const { fullName, email, role, organization, password } = req.body as {
      fullName?: string;
      email?: string;
      role?: string;
      organization?: string;
      password?: string;
    };

    const nextEmail = email?.trim().toLowerCase() || String(existing.email);
    const conflict = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(nextEmail, id);
    if (conflict) {
      res.status(409).json({ error: 'Cette adresse e-mail appartient déjà à un autre compte.' });
      return;
    }

    if (password && password.length < 6) {
      res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    const now = new Date().toISOString();
    const nextPasswordHash = password ? hashPassword(password) : String(existing.password_hash);

    db.prepare(
      `UPDATE users
       SET full_name = ?, email = ?, role = ?, organization = ?, password_hash = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      fullName?.trim() || String(existing.full_name),
      nextEmail,
      role?.trim() || String(existing.role),
      organization?.trim() || String(existing.organization),
      nextPasswordHash,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ user: mapRowToUser(updated) });
  });

  app.delete('/api/users/:id', (req, res) => {
    const current = getAuthenticatedUser(req);
    if (!current) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const { id } = req.params;
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
    if (totalUsers.cnt <= 1) {
      res.status(400).json({ error: 'Impossible de supprimer le dernier compte administrateur restant.' });
      return;
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ ok: true, deletedSelf: current.id === id });
  });

  // --- API ROUTES ---

  app.get('/api/items', (req, res) => {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : 'Tous';
    const includeDuplicates = req.query.duplicates === 'true';
    const onlyDuplicates = req.query.onlyDuplicates === 'true';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const minScore = Number(req.query.minScore ?? 0) || 0;

    let sql = `
      SELECT items.*, orig.title AS duplicate_of_title
      FROM items
      LEFT JOIN items AS orig ON items.duplicate_of_id = orig.id
      WHERE 1=1
    `;
    const params: Array<string | number> = [];

    if (onlyDuplicates) {
      sql += ' AND items.is_duplicate = 1';
    } else if (!includeDuplicates) {
      sql += ' AND items.is_duplicate = 0';
    }

    if (domain && domain !== 'Tous') {
      sql += ' AND items.domain = ?';
      params.push(domain);
    }

    if (minScore > 0) {
      sql += ' AND items.relevance_score >= ?';
      params.push(minScore);
    }

    sql += ' ORDER BY items.published_at DESC, items.relevance_score DESC';

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    let items = rows.map(mapRowToItem);

    if (search) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(search) ||
          i.aiSummary.toLowerCase().includes(search) ||
          i.sourceName.toLowerCase().includes(search) ||
          i.matchedKeywords.some((k) => k.toLowerCase().includes(search))
      );
    }

    res.json({ items });
  });

  app.post('/api/items/:id/evaluate', (req, res) => {
    const { id } = req.params;
    const { humanRelevant, summaryRating } = req.body as {
      humanRelevant?: number | null;
      summaryRating?: number | null;
    };

    const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Publication introuvable.' });
      return;
    }

    if (humanRelevant !== undefined) {
      db.prepare('UPDATE items SET human_relevant = ? WHERE id = ?').run(
        humanRelevant === null ? null : humanRelevant ? 1 : 0,
        id
      );
    }
    if (summaryRating !== undefined) {
      const clamped = summaryRating === null ? null : Math.min(5, Math.max(1, Math.round(summaryRating)));
      db.prepare('UPDATE items SET summary_rating = ? WHERE id = ?').run(clamped, id);
    }

    const updated = db
      .prepare('SELECT * FROM items WHERE id = ?')
      .get(id) as Record<string, unknown>;
    res.json({ item: mapRowToItem(updated) });
  });

  app.post('/api/items/:id/resummarize', async (req, res) => {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Publication introuvable.' });
      return;
    }

    const settings = getSettingsMap();
    const keywords = (db.prepare('SELECT term FROM keywords').all() as Array<{ term: string }>).map((k) => k.term);
    const aiMap = await analyzeBatchWithAI(
      [
        {
          tempId: id,
          title: String(row.title),
          excerpt: String(row.raw_excerpt),
          sourceName: String(row.source_name),
          fallbackDomain: String(row.domain) as VeilleSource['defaultDomain'],
        },
      ],
      keywords,
      {
        preferLocalOllama: settings.preferLocalOllama === 'true',
        ollamaEndpoint: settings.ollamaEndpoint ?? 'http://localhost:11434',
        ollamaModel: settings.ollamaModel ?? 'mistral',
      }
    );

    const result = aiMap.get(id);
    if (result) {
      db.prepare(
        'UPDATE items SET ai_summary = ?, key_points_json = ?, domain = ?, opportunity_type = ?, ai_engine = ? WHERE id = ?'
      ).run(
        result.aiSummary,
        JSON.stringify(result.keyPoints),
        result.domain,
        result.opportunityType,
        result.aiEngine,
        id
      );
    }

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ item: mapRowToItem(updated) });
  });

  app.get('/api/sources', (_req, res) => {
    const rows = db.prepare('SELECT * FROM sources ORDER BY name ASC').all() as Array<Record<string, unknown>>;
    const sources: VeilleSource[] = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      url: String(r.url),
      defaultDomain: String(r.default_domain) as VeilleSource['defaultDomain'],
      sourceType: String(r.source_type) as VeilleSource['sourceType'],
      enabled: Boolean(r.enabled),
      lastFetchedAt: r.last_fetched_at ? String(r.last_fetched_at) : null,
      lastStatus: String(r.last_status),
      itemCount: Number(r.item_count),
    }));
    res.json({ sources });
  });

  app.post('/api/sources', (req, res) => {
    const { name, url, defaultDomain, sourceType } = req.body as {
      name?: string;
      url?: string;
      defaultDomain?: string;
      sourceType?: string;
    };
    if (!name?.trim() || !url?.trim()) {
      res.status(400).json({ error: 'Nom et URL RSS requis.' });
      return;
    }
    const id = `src-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      'INSERT INTO sources (id, name, url, default_domain, source_type, enabled, last_status, item_count) VALUES (?, ?, ?, ?, ?, 1, ?, 0)'
    ).run(id, name.trim(), url.trim(), defaultDomain ?? 'IA', sourceType ?? 'RSS', 'Ajouté');
    res.status(201).json({ id });
  });

  app.patch('/api/sources/:id', (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    db.prepare('UPDATE sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    res.json({ ok: true });
  });

  app.delete('/api/sources/:id', (req, res) => {
    db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/keywords', (_req, res) => {
    const keywords = db.prepare('SELECT * FROM keywords ORDER BY weight DESC, term ASC').all();
    res.json({ keywords });
  });

  app.post('/api/keywords', (req, res) => {
    const { term, domain, weight } = req.body as { term?: string; domain?: string; weight?: number };
    if (!term?.trim()) {
      res.status(400).json({ error: 'Mot-clé requis.' });
      return;
    }
    db.prepare('INSERT OR REPLACE INTO keywords (term, domain, weight) VALUES (?, ?, ?)').run(
      term.trim(),
      domain ?? 'IA',
      Math.min(5, Math.max(1, Number(weight ?? 2)))
    );
    res.status(201).json({ ok: true });
  });

  app.delete('/api/keywords/:id', (req, res) => {
    db.prepare('DELETE FROM keywords WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/collect', async (req, res) => {
    try {
      const { mode, resetDemo } = (req.body ?? {}) as {
        mode?: 'live_rss' | 'snapshot' | 'hybride';
        resetDemo?: boolean;
      };
      const run = await runCollectionPipeline({ mode, resetDemo });
      res.json({ run });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erreur lors de la collecte.' });
    }
  });

  app.get('/api/runs', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM collection_runs ORDER BY started_at DESC LIMIT 25')
      .all() as Array<Record<string, unknown>>;
    const runs = rows.map((r) => ({
      id: String(r.id),
      startedAt: String(r.started_at),
      finishedAt: String(r.finished_at),
      mode: String(r.mode),
      sourcesCount: Number(r.sources_count),
      rawFetched: Number(r.raw_fetched),
      duplicatesRemoved: Number(r.duplicates_removed),
      newItems: Number(r.new_items),
      durationMs: Number(r.duration_ms),
      status: String(r.status),
      logSummary: String(r.log_summary),
    }));
    res.json({ runs });
  });

  app.get('/api/metrics', (_req, res) => {
    res.json({ metrics: computeScientificMetrics() });
  });

  app.get('/api/bulletins', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM bulletins ORDER BY created_at DESC LIMIT 20')
      .all() as Array<Record<string, unknown>>;
    const bulletins = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      cadence: String(r.cadence),
      periodLabel: String(r.period_label),
      createdAt: String(r.created_at),
      itemIds: JSON.parse(String(r.item_ids_json || '[]')),
      markdownContent: String(r.markdown_content),
      htmlContent: String(r.html_content),
    }));
    res.json({ bulletins });
  });

  app.post('/api/bulletins/generate', (req, res) => {
    const { cadence, domains, minRelevance, title } = req.body as {
      cadence?: 'quotidien' | 'hebdomadaire';
      domains?: string[];
      minRelevance?: number;
      title?: string;
    };
    const bulletin = generateBulletin({
      cadence: cadence === 'hebdomadaire' ? 'hebdomadaire' : 'quotidien',
      domains: Array.isArray(domains) ? domains : [],
      minRelevance: typeof minRelevance === 'number' ? minRelevance : 50,
      title,
    });
    res.status(201).json({ bulletin });
  });

  app.get('/api/settings', (_req, res) => {
    const raw = getSettingsMap();
    res.json({
      settings: {
        scheduleCadence: raw.scheduleCadence ?? 'daily',
        dedupThreshold: Number(raw.dedupThreshold ?? '0.72'),
        collectionMode: raw.collectionMode ?? 'snapshot',
        ollamaEndpoint: raw.ollamaEndpoint ?? 'http://localhost:11434',
        ollamaModel: raw.ollamaModel ?? 'mistral',
        preferLocalOllama: raw.preferLocalOllama === 'true',
      },
    });
  });

  app.patch('/api/settings', (req, res) => {
    const updates = req.body as Record<string, unknown>;
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        upsert.run(key, String(val));
      }
    }
    res.json({ ok: true });
  });

  app.get('/api/export/n8n', (_req, res) => {
    const rows = db.prepare('SELECT * FROM sources').all() as Array<Record<string, unknown>>;
    const sources: VeilleSource[] = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      url: String(r.url),
      defaultDomain: String(r.default_domain) as VeilleSource['defaultDomain'],
      sourceType: String(r.source_type) as VeilleSource['sourceType'],
      enabled: Boolean(r.enabled),
      lastFetchedAt: null,
      lastStatus: '',
      itemCount: 0,
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="workflow-n8n-vigielab.json"');
    res.send(buildN8nWorkflowJson(sources));
  });

  app.get('/api/export/python', (_req, res) => {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="collecte_ollama.py"');
    res.send(buildPythonCollectorScript());
  });

  app.get('/api/export/metrics-csv', (_req, res) => {
    const rows = db.prepare('SELECT * FROM items ORDER BY published_at DESC').all() as Array<Record<string, unknown>>;
    const header =
      'id,titre,source,domaine,type_opportunite,score_pertinence,est_doublon,methode_dedup,similarite,pertinence_humaine,note_resume,date_publication\n';
    const csvRows = rows.map((r) => {
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      return [
        esc(r.id),
        esc(r.title),
        esc(r.source_name),
        esc(r.domain),
        esc(r.opportunity_type),
        r.relevance_score,
        r.is_duplicate ? 1 : 0,
        esc(r.dedup_method ?? ''),
        r.similarity_score ?? '',
        r.human_relevant ?? '',
        r.summary_rating ?? '',
        esc(r.published_at),
      ].join(',');
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="evaluation-scientifique-veille.csv"');
    res.send(header + csvRows.join('\n'));
  });

  // Periodic background scheduler check (every 15 minutes)
  let lastAutoRunAt = Date.now();
  setInterval(async () => {
    const s = getSettingsMap();
    const cadence = s.scheduleCadence ?? 'daily';
    if (cadence === 'manual') return;
    const intervalMs =
      cadence === 'hourly' ? 3600_000 : cadence === 'weekly' ? 7 * 86400_000 : 86400_000;
    if (Date.now() - lastAutoRunAt >= intervalMs) {
      lastAutoRunAt = Date.now();
      await runCollectionPipeline().catch(() => {});
    }
  }, 15 * 60_000);

  // Vite dev middleware or static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VigieLab server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
