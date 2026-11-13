import React, { useState } from 'react';
import { FileDown, Printer, PlusCircle } from 'lucide-react';
import type { BulletinRecord, VeilleDomain } from '../types/veille';

interface BulletinViewProps {
  bulletins: BulletinRecord[];
  onGenerateBulletin: (payload: {
    cadence: 'quotidien' | 'hebdomadaire';
    domains: string[];
    minRelevance: number;
    title?: string;
  }) => Promise<BulletinRecord>;
}

const ALL_DOMAINS: VeilleDomain[] = [
  'Appels à projets',
  'IA',
  'Cybersécurité',
  'Cloud',
  'Développement',
  'Recherche',
];

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const BulletinView: React.FC<BulletinViewProps> = ({
  bulletins,
  onGenerateBulletin,
}) => {
  const [cadence, setCadence] = useState<'quotidien' | 'hebdomadaire'>('hebdomadaire');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([...ALL_DOMAINS]);
  const [minRelevance, setMinRelevance] = useState<number>(50);
  const [customTitle, setCustomTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [activeBulletinId, setActiveBulletinId] = useState<string | null>(null);

  const activeBulletin =
    bulletins.find((b) => b.id === activeBulletinId) ?? bulletins[0] ?? null;

  const toggleDomain = (d: string) => {
    setSelectedDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const created = await onGenerateBulletin({
        cadence,
        domains: selectedDomains,
        minRelevance,
        title: customTitle.trim() || undefined,
      });
      setActiveBulletinId(created.id);
      setCustomTitle('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 no-print"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Générateur de bulletin de veille
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compile les opportunités classées (titre, résumé IA, date, source et lien d&apos;origine) au format HTML, Markdown ou PDF.
            </p>
          </div>
          <button
            type="submit"
            disabled={generating || selectedDomains.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{generating ? 'Génération...' : 'Générer le bulletin'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Périodicité du bulletin
            </label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['quotidien', 'hebdomadaire'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCadence(c)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded capitalize transition-colors ${
                    cadence === c
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Score minimal de pertinence ({minRelevance}/100)
            </label>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minRelevance}
              onChange={(e) => setMinRelevance(Number(e.target.value))}
              className="w-full accent-blue-700 mt-2"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Titre personnalisé (optionnel)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="ex: Synthèse R&D Semaine 46"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 mr-1">Domaines inclus :</span>
          {ALL_DOMAINS.map((d) => {
            const active = selectedDomains.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDomain(d)}
                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </form>

      {/* Archive + Preview */}
      {activeBulletin ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden no-print">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Bulletins archivés ({bulletins.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {bulletins.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveBulletinId(b.id)}
                  className={`w-full text-left p-3.5 transition-colors block ${
                    activeBulletin.id === b.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-medium text-slate-900 line-clamp-1">{b.title}</div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    {b.cadence} · {b.itemIds.length} articles ·{' '}
                    {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 no-print">
              <div className="text-xs font-medium text-slate-700">
                Aperçu du bulletin ({activeBulletin.itemIds.length} opportunités)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      `bulletin-veille-${activeBulletin.id}.md`,
                      activeBulletin.markdownContent,
                      'text/markdown;charset=utf-8'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-700" />
                  <span>Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      `bulletin-veille-${activeBulletin.id}.html`,
                      activeBulletin.htmlContent,
                      'text/html;charset=utf-8'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-700" />
                  <span>Page HTML (.html)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer / PDF</span>
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{
                  __html: activeBulletin.htmlContent
                    .replace(/<!doctype html>[\s\S]*?<body[^>]*>/i, '')
                    .replace(/<\/body>[\s\S]*$/i, ''),
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <h3 className="text-base font-semibold text-slate-900">
            Aucun bulletin généré pour le moment
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Sélectionnez une périodicité et cliquez sur « Générer le bulletin » pour produire votre première édition exportable.
          </p>
        </div>
      )}
    </div>
  );
};
