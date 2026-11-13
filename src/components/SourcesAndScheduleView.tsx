import React, { useState } from 'react';
import { Plus, Trash2, Play, RotateCcw, Clock } from 'lucide-react';
import type {
  CollectionRun,
  PipelineSettings,
  VeilleDomain,
  VeilleSource,
  WatchKeyword,
} from '../types/veille';

interface SourcesAndScheduleViewProps {
  sources: VeilleSource[];
  keywords: WatchKeyword[];
  runs: CollectionRun[];
  settings: PipelineSettings;
  collecting: boolean;
  onAddSource: (payload: {
    name: string;
    url: string;
    defaultDomain: VeilleDomain;
    sourceType: 'RSS' | 'Atom' | 'OpenData';
  }) => Promise<void>;
  onToggleSource: (id: string, enabled: boolean) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onAddKeyword: (payload: { term: string; domain: VeilleDomain; weight: number }) => Promise<void>;
  onDeleteKeyword: (id: number) => Promise<void>;
  onUpdateSettings: (partial: Partial<PipelineSettings>) => Promise<void>;
  onRunCollect: (mode: 'live_rss' | 'snapshot' | 'hybride', resetDemo?: boolean) => Promise<void>;
}

const DOMAIN_OPTIONS: VeilleDomain[] = [
  'IA',
  'Cybersécurité',
  'Cloud',
  'Développement',
  'Appels à projets',
  'Recherche',
];

export const SourcesAndScheduleView: React.FC<SourcesAndScheduleViewProps> = ({
  sources,
  keywords,
  runs,
  settings,
  collecting,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onAddKeyword,
  onDeleteKeyword,
  onUpdateSettings,
  onRunCollect,
}) => {
  const [srcName, setSrcName] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcDomain, setSrcDomain] = useState<VeilleDomain>('IA');
  const [kwTerm, setKwTerm] = useState('');
  const [kwDomain, setKwDomain] = useState<VeilleDomain>('IA');
  const [kwWeight, setKwWeight] = useState(2);

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srcName.trim() || !srcUrl.trim()) return;
    await onAddSource({
      name: srcName.trim(),
      url: srcUrl.trim(),
      defaultDomain: srcDomain,
      sourceType: 'RSS',
    });
    setSrcName('');
    setSrcUrl('');
  };

  const handleCreateKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kwTerm.trim()) return;
    await onAddKeyword({ term: kwTerm.trim(), domain: kwDomain, weight: kwWeight });
    setKwTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Execution Mode & Schedule Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Orchestration et mode de collecte
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Choisissez entre le jeu de données enregistré (démonstration reproductible hors ligne), la lecture RSS en direct ou le mode hybride.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={collecting}
              onClick={() => onRunCollect(settings.collectionMode, false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{collecting ? 'Collecte...' : 'Exécuter maintenant'}</span>
            </button>
            <button
              type="button"
              disabled={collecting}
              onClick={() => onRunCollect('snapshot', true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser jeu enregistré</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Source de collecte active
            </label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {[
                { id: 'snapshot' as const, label: 'Jeu enregistré' },
                { id: 'hybride' as const, label: 'Hybride (RSS + Repli)' },
                { id: 'live_rss' as const, label: 'RSS temps réel' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateSettings({ collectionMode: m.id })}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    settings.collectionMode === m.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Planification automatique (équivalent Cron / n8n)
            </label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={settings.scheduleCadence}
                onChange={(e) =>
                  onUpdateSettings({
                    scheduleCadence: e.target.value as PipelineSettings['scheduleCadence'],
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-700"
              >
                <option value="manual">Déclenchement manuel uniquement</option>
                <option value="hourly">Toutes les heures</option>
                <option value="daily">Quotidienne (toutes les 24 h)</option>
                <option value="weekly">Hebdomadaire (tous les 7 jours)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* RSS Sources Management */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Sources publiques RSS / Atom configurées ({sources.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Activez, testez ou ajoutez vos propres flux publics pour alimenter le pipeline.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Actif</th>
                <th className="py-2.5 px-4">Nom de la source</th>
                <th className="py-2.5 px-4">Domaine</th>
                <th className="py-2.5 px-4">Dernier statut</th>
                <th className="py-2.5 px-4 text-right">Articles</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sources.map((src) => (
                <tr key={src.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={src.enabled}
                      onChange={(e) => onToggleSource(src.id, e.target.checked)}
                      aria-label={`Activer ${src.name}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{src.name}</div>
                    <div className="font-mono text-xs text-slate-500 truncate max-w-xs">
                      {src.url}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                    {src.defaultDomain}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {src.lastStatus}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-900">
                    {src.itemCount}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteSource(src.id)}
                      aria-label={`Supprimer ${src.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-700 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={handleCreateSource}
          className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
            <input
              type="text"
              required
              value={srcName}
              onChange={(e) => setSrcName(e.target.value)}
              placeholder="ex: LinuxFr"
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">URL du flux RSS</label>
            <input
              type="url"
              required
              value={srcUrl}
              onChange={(e) => setSrcUrl(e.target.value)}
              placeholder="https://linuxfr.org/news.atom"
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Domaine</label>
            <select
              value={srcDomain}
              onChange={(e) => setSrcDomain(e.target.value as VeilleDomain)}
              className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            >
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter flux</span>
            </button>
          </div>
        </form>
      </div>

      {/* Keywords Watchlist & Execution Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Mots-clés &amp; thèmes prioritaires
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chaque correspondance pondère le score de pertinence des opportunités collectées.
            </p>
          </div>

          <form onSubmit={handleCreateKeyword} className="flex flex-wrap gap-2">
            <input
              type="text"
              required
              value={kwTerm}
              onChange={(e) => setKwTerm(e.target.value)}
              placeholder="Nouveau mot-clé..."
              className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
            <select
              value={kwDomain}
              onChange={(e) => setKwDomain(e.target.value as VeilleDomain)}
              className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md"
            >
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={kwWeight}
              onChange={(e) => setKwWeight(Number(e.target.value))}
              className="px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
              aria-label="Poids du mot-clé"
            >
              <option value={1}>Poids 1</option>
              <option value={2}>Poids 2</option>
              <option value={3}>Poids 3</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
            >
              Ajouter
            </button>
          </form>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {keywords.map((kw) => (
              <div key={kw.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-slate-900">{kw.term}</span>
                  <span className="text-slate-400"> · {kw.domain} · Poids </span>
                  <span className="font-mono tabular-nums text-slate-700">{kw.weight}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteKeyword(kw.id)}
                  className="text-slate-400 hover:text-red-700 p-1"
                  aria-label={`Supprimer ${kw.term}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Journal traçable des collectes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historique SQLite des exécutions manuelles et planifiées.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Horodatage</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4 text-right">Bruts</th>
                  <th className="py-2.5 px-4 text-right">Doublons</th>
                  <th className="py-2.5 px-4 text-right">Retenus</th>
                  <th className="py-2.5 px-4 text-right">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {new Date(r.startedAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {r.mode === 'snapshot'
                        ? 'Jeu enregistré'
                        : r.mode === 'hybride'
                        ? 'Hybride'
                        : 'RSS direct'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {r.rawFetched}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {r.duplicatesRemoved}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {r.newItems}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                      {r.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
