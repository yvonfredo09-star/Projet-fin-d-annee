import React, { useState } from 'react';
import { Download, SlidersHorizontal, Code2 } from 'lucide-react';
import type { PipelineSettings, VeilleItem } from '../types/veille';

interface DeduplicationViewProps {
  duplicates: VeilleItem[];
  settings: PipelineSettings;
  onUpdateSettings: (partial: Partial<PipelineSettings>) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

const METHOD_LABELS: Record<string, string> = {
  url_canonique: 'URL canonique (suppression UTM)',
  hash_sha256: 'Empreinte SHA-256 identique',
  similarite_jaccard: 'Similarité lexicale Jaccard',
};

export const DeduplicationView: React.FC<DeduplicationViewProps> = ({
  duplicates,
  settings,
  onUpdateSettings,
  onResetDemo,
}) => {
  const [thresholdDraft, setThresholdDraft] = useState(settings.dedupThreshold);
  const [ollamaUrlDraft, setOllamaUrlDraft] = useState(settings.ollamaEndpoint);
  const [ollamaModelDraft, setOllamaModelDraft] = useState(settings.ollamaModel);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings({
      dedupThreshold: thresholdDraft,
      ollamaEndpoint: ollamaUrlDraft,
      ollamaModel: ollamaModelDraft,
    });
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveThresholds}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Paramètres de déduplication et connecteur Ollama
            </h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Le pipeline applique trois filtres séquentiels avant toute synthèse IA : normalisation des URL canoniques (retrait des paramètres de suivi), hachage SHA-256 des titres normalisés, puis calcul de similarité Jaccard sur les lemmes.
          </p>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="dedup-slider" className="font-medium text-slate-700">
                Seuil de similarité lexicale Jaccard
              </label>
              <span className="font-mono font-semibold text-blue-700 tabular-nums">
                {Math.round(thresholdDraft * 100)} % ({thresholdDraft.toFixed(2)})
              </span>
            </div>
            <input
              id="dedup-slider"
              type="range"
              min={0.5}
              max={0.95}
              step={0.02}
              value={thresholdDraft}
              onChange={(e) => setThresholdDraft(Number(e.target.value))}
              className="w-full accent-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Endpoint Ollama local (optionnel)
              </label>
              <input
                type="url"
                value={ollamaUrlDraft}
                onChange={(e) => setOllamaUrlDraft(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Modèle Ollama cible
              </label>
              <input
                type="text"
                value={ollamaModelDraft}
                onChange={(e) => setOllamaModelDraft(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={settings.preferLocalOllama}
                onChange={(e) => onUpdateSettings({ preferLocalOllama: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              <span>Prioriser Ollama local si joignable (sinon synthèse serveur)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetDemo}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Rejouer sur le jeu enregistré
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </form>

        {/* Export n8n & Python Stack */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Export de la stack n8n &amp; Python
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Téléchargez le graphe d&apos;automatisation n8n préconfiguré avec vos sources RSS actives ainsi que le script Python autonome (feedparser + SQLite + Ollama) pour le déploiement local.
            </p>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <a
              href="/api/export/n8n"
              download="workflow-n8n-vigielab.json"
              className="w-full inline-flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              <span>Workflow n8n prêt à importer (.json)</span>
              <Download className="w-4 h-4 text-blue-700 shrink-0" />
            </a>

            <a
              href="/api/export/python"
              download="collecte_ollama.py"
              className="w-full inline-flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              <span>Script Python + SQLite + Ollama (.py)</span>
              <Download className="w-4 h-4 text-blue-700 shrink-0" />
            </a>
          </div>
        </div>
      </div>

      {/* Caught Duplicates Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Doublons interceptés ({duplicates.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Publications écartées automatiquement avant la génération de résumés pour éviter les synthèses redondantes.
            </p>
          </div>
        </div>

        {duplicates.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Aucun doublon enregistré pour le moment. Exécutez une collecte avec le jeu de données enregistré pour observer la détection inter-sources.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Document écarté</th>
                  <th className="py-2.5 px-4">Article conservé (référence)</th>
                  <th className="py-2.5 px-4">Méthode de détection</th>
                  <th className="py-2.5 px-4 text-right">Similarité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {duplicates.map((dup) => (
                  <tr key={dup.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-900">{dup.title}</div>
                      <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                        {dup.sourceName} · {dup.originalUrl}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-sm text-slate-700">
                      {dup.duplicateOfTitle ?? dup.duplicateOfId ?? 'Référence archivée'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {dup.dedupMethod ? METHOD_LABELS[dup.dedupMethod] ?? dup.dedupMethod : 'Doublon'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                      {dup.similarityScore !== null ? `${Math.round(dup.similarityScore * 100)} %` : '100 %'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
