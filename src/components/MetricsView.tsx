import React from 'react';
import { Download } from 'lucide-react';
import type { ScientificMetrics } from '../types/veille';

interface MetricsViewProps {
  metrics: ScientificMetrics | null;
}

export const MetricsView: React.FC<MetricsViewProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        Chargement des indicateurs scientifiques...
      </div>
    );
  }

  const maxRatingCount = Math.max(
    1,
    ...metrics.ratingDistribution.map((d) => d.count)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Indicateurs expérimentaux pour le rapport scientifique
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Calculés en temps réel à partir des enregistrements SQLite et de vos annotations humaines sur la pertinence et la qualité des synthèses.
          </p>
        </div>
        <a
          href="/api/export/metrics-csv"
          download="evaluation-scientifique-veille.csv"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exporter jeu d&apos;évaluation (.csv)</span>
        </a>
      </div>

      {/* Primary Scientific Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Taux de déduplication global</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.deduplicationRate} %
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.duplicatesRemoved} / {metrics.totalRawCollected} flux bruts
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Précision (pertinence validée)</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {metrics.precisionRate !== null ? `${metrics.precisionRate} %` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.evaluatedCount > 0
              ? `${metrics.relevantCount} / ${metrics.evaluatedCount} annotés`
              : 'Annotez des articles dans le tableau'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Qualité moyenne des résumés</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {metrics.avgSummaryRating !== null ? `${metrics.avgSummaryRating} / 5` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Échelle de Likert (1 à 5)
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Opportunités uniques retenues</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.uniqueRetained}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Après filtrage inter-sources
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deduplication methods breakdown */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Répartition des doublons par mécanisme
          </h3>
          <div className="space-y-3">
            {[
              {
                label: '1. Normalisation URL canonique (UTM/ancres)',
                count: metrics.dedupByMethod.url_canonique,
              },
              {
                label: '2. Hachage SHA-256 du titre normalisé',
                count: metrics.dedupByMethod.hash_sha256,
              },
              {
                label: '3. Similarité lexicale Jaccard (inter-sources)',
                count: metrics.dedupByMethod.similarite_jaccard,
              },
            ].map((row) => {
              const pct =
                metrics.duplicatesRemoved > 0
                  ? Math.round((row.count / metrics.duplicatesRemoved) * 100)
                  : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{row.label}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-medium">
                      {row.count} ({pct} %)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-700 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Quality Distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Distribution des notes de qualité des synthèses IA
          </h3>
          <div className="space-y-2.5">
            {metrics.ratingDistribution.map((entry) => {
              const widthPct = Math.round((entry.count / maxRatingCount) * 100);
              return (
                <div key={entry.rating} className="flex items-center gap-3 text-xs">
                  <span className="font-mono tabular-nums w-12 text-slate-600">
                    {entry.rating} / 5
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full"
                      style={{ width: `${entry.count > 0 ? Math.max(8, widthPct) : 0}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums w-8 text-right text-slate-700">
                    {entry.count}
                  </span>
                </div>
              );
            })}
          </div>
          {metrics.evaluatedCount === 0 && (
            <p className="text-xs text-slate-500 pt-1">
              Ouvrez des articles dans « Tableau de veille » et attribuez une note de 1 à 5 pour alimenter ce graphique expérimental.
            </p>
          )}
        </div>
      </div>

      {/* Per-source & Per-domain tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Performance par source publique
            </h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4 text-right">Bruts</th>
                <th className="py-2.5 px-4 text-right">Uniques</th>
                <th className="py-2.5 px-4 text-right">Taux dédup.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {metrics.sourceStats.map((s) => (
                <tr key={s.sourceName}>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{s.sourceName}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{s.total}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{s.uniqueCount}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                    {s.dedupRate} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Répartition par domaine classifié
            </h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Domaine</th>
                <th className="py-2.5 px-4 text-right">Publications</th>
                <th className="py-2.5 px-4 text-right">Pertinence moy.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {metrics.domainBreakdown.map((d) => (
                <tr key={d.domain}>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{d.domain}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{d.count}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700">
                    {d.avgRelevance}/100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
