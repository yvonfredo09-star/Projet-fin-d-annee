import React, { useMemo, useState } from 'react';
import {
  Search,
  ExternalLink,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Star,
  RotateCw,
  ArrowUpDown,
} from 'lucide-react';
import type { VeilleDomain, VeilleItem } from '../types/veille';

interface WatchDashboardProps {
  items: VeilleItem[];
  loading: boolean;
  onEvaluate: (id: string, humanRelevant: number | null, summaryRating: number | null) => Promise<void>;
  onResummarize: (id: string) => Promise<void>;
  onNavigateSources: () => void;
}

const DOMAINS: Array<'Tous' | VeilleDomain> = [
  'Tous',
  'Appels à projets',
  'IA',
  'Cybersécurité',
  'Cloud',
  'Développement',
  'Recherche',
];

function formatDateFr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export const WatchDashboard: React.FC<WatchDashboardProps> = ({
  items,
  loading,
  onEvaluate,
  onResummarize,
  onNavigateSources,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<'Tous' | VeilleDomain>('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [minRelevance, setMinRelevance] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('score');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resummarizingId, setResummarizingId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      if (selectedDomain !== 'Tous' && item.domain !== selectedDomain) return false;
      if (item.relevanceScore < minRelevance) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.aiSummary.toLowerCase().includes(q) ||
        item.sourceName.toLowerCase().includes(q) ||
        item.matchedKeywords.some((k) => k.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'score') {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [items, selectedDomain, searchQuery, minRelevance, sortBy]);

  const activeItem = useMemo(() => {
    if (selectedId) {
      const found = filteredItems.find((i) => i.id === selectedId);
      if (found) return found;
    }
    return filteredItems[0] ?? null;
  }, [filteredItems, selectedId]);

  const avgScore = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(items.reduce((acc, i) => acc + i.relevanceScore, 0) / items.length);
  }, [items]);

  const callsCount = useMemo(
    () =>
      items.filter(
        (i) =>
          i.opportunityType === 'Appel à projets' ||
          i.opportunityType === "Appel d'offres" ||
          i.opportunityType === 'Partenariat'
      ).length,
    [items]
  );

  const handleResummarize = async (id: string) => {
    setResummarizingId(id);
    try {
      await onResummarize(id);
    } finally {
      setResummarizingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compact KPI summary bar (flat single-elevation row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Publications uniques</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {items.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Appels &amp; partenariats</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {callsCount}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Score moyen de pertinence</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {avgScore}/100
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Évaluations annotées</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {items.filter((i) => i.humanRelevant !== null).length}/{items.length}
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par titre, résumé, source ou mot-clé..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 whitespace-nowrap">
              <span>Score min.</span>
              <select
                value={minRelevance}
                onChange={(e) => setMinRelevance(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-700"
              >
                <option value={0}>0+</option>
                <option value={50}>50+</option>
                <option value={70}>70+</option>
                <option value={85}>85+</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setSortBy((prev) => (prev === 'score' ? 'date' : 'score'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Tri : {sortBy === 'score' ? 'Pertinence' : 'Date'}</span>
            </button>
          </div>
        </div>

        {/* Interactive segmented domain filter */}
        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100">
          {DOMAINS.map((domain) => {
            const active = selectedDomain === domain;
            const count =
              domain === 'Tous'
                ? items.length
                : items.filter((i) => i.domain === domain).length;
            return (
              <button
                key={domain}
                type="button"
                onClick={() => setSelectedDomain(domain)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {domain} <span className="font-mono tabular-nums opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main split workspace: High-density table + Reading/Evaluation Inspector */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="p-4 animate-pulse flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-slate-100 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
              </div>
              <div className="h-5 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <h3 className="text-base font-semibold text-slate-900">
            Aucune publication ne correspond aux filtres actuels
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Modifiez vos critères de recherche ou lancez une collecte depuis les sources configurées.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedDomain('Tous');
              setSearchQuery('');
              setMinRelevance(0);
              if (items.length === 0) onNavigateSources();
            }}
            className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            {items.length === 0 ? 'Configurer les sources' : 'Réinitialiser les filtres'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Structured list of publications */}
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
            {filteredItems.map((item) => {
              const isSelected = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-4 transition-colors block focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="truncate">
                      <span className="font-medium text-slate-700">{item.domain}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.opportunityType}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.sourceName}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-500 shrink-0">
                      {formatDateFr(item.publishedAt)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-start justify-between gap-4">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                        item.relevanceScore >= 80
                          ? 'text-emerald-700'
                          : item.relevanceScore >= 60
                          ? 'text-blue-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {item.relevanceScore}/100
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.aiSummary}
                  </p>

                  {(item.matchedKeywords.length > 0 || item.humanRelevant !== null) && (
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">
                        {item.matchedKeywords.length > 0
                          ? `Mots-clés : ${item.matchedKeywords.slice(0, 4).join(', ')}`
                          : ''}
                      </span>
                      {item.humanRelevant !== null && (
                        <span
                          className={`font-medium shrink-0 ${
                            item.humanRelevant === 1 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {item.humanRelevant === 1 ? 'Validé pertinent' : 'Écarté (bruit)'}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Detail & Scientific Evaluation Inspector */}
          {activeItem && (
            <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 xl:sticky xl:top-20 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {activeItem.domain} · {activeItem.opportunityType}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatDateFr(activeItem.publishedAt)}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-900 leading-snug">
                  {activeItem.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Source : {activeItem.sourceName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Pertinence : {activeItem.relevanceScore}/100
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Moteur : {activeItem.aiEngine}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                    <span>Synthèse générée</span>
                  </h3>
                  <button
                    type="button"
                    disabled={resummarizingId === activeItem.id}
                    onClick={() => handleResummarize(activeItem.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    <RotateCw
                      className={`w-3 h-3 ${
                        resummarizingId === activeItem.id ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Régénérer</span>
                  </button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{activeItem.aiSummary}</p>

                {activeItem.keyPoints.length > 0 && (
                  <ul className="mt-2 space-y-1.5 pt-2">
                    {activeItem.keyPoints.map((pt, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="font-mono text-slate-400 select-none">–</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-1.5">
                <h3 className="text-xs font-semibold text-slate-700">Extrait d&apos;origine</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{activeItem.rawExcerpt}</p>
              </div>

              {activeItem.matchedKeywords.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    Mots-clés détectés
                  </div>
                  <div className="text-xs text-slate-600">
                    {activeItem.matchedKeywords.join(' · ')}
                  </div>
                </div>
              )}

              {/* Scientific Annotation for Report */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="text-xs font-semibold text-slate-900">
                  Annotation scientifique (pour le rapport)
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Pertinence réelle :</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onEvaluate(
                          activeItem.id,
                          activeItem.humanRelevant === 1 ? null : 1,
                          activeItem.summaryRating
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                        activeItem.humanRelevant === 1
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Pertinent</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onEvaluate(
                          activeItem.id,
                          activeItem.humanRelevant === 0 ? null : 0,
                          activeItem.summaryRating
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                        activeItem.humanRelevant === 0
                          ? 'bg-red-50 border-red-300 text-red-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>Non pertinent</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">Qualité du résumé (1–5) :</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((score) => {
                      const active = (activeItem.summaryRating ?? 0) >= score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() =>
                            onEvaluate(
                              activeItem.id,
                              activeItem.humanRelevant,
                              activeItem.summaryRating === score ? null : score
                            )
                          }
                          aria-label={`Noter ${score} sur 5`}
                          className={`p-1 rounded transition-colors ${
                            active ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${active ? 'fill-current' : ''}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="font-mono text-[11px] text-slate-400 truncate max-w-[180px]">
                  SHA-256: {activeItem.contentHash.slice(0, 12)}
                </span>
                <a
                  href={activeItem.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Source d&apos;origine</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
