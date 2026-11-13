import { useCallback, useEffect, useState } from 'react';
import { Menu, RefreshCw } from 'lucide-react';
import { Sidebar, type ActiveTab } from './components/Sidebar';
import { WatchDashboard } from './components/WatchDashboard';
import { SourcesAndScheduleView } from './components/SourcesAndScheduleView';
import { DeduplicationView } from './components/DeduplicationView';
import { BulletinView } from './components/BulletinView';
import { MetricsView } from './components/MetricsView';
import { AuthGate } from './components/AuthGate';
import { AccountCrudView } from './components/AccountCrudView';
import type {
  BulletinRecord,
  CollectionRun,
  PipelineSettings,
  ScientificMetrics,
  UserAccount,
  VeilleDomain,
  VeilleItem,
  VeilleSource,
  WatchKeyword,
} from './types/veille';

const SESSION_STORAGE_KEY = 'vigielab_session_token';

const TAB_TITLES: Record<ActiveTab, string> = {
  veille: 'Tableau de veille',
  sources: 'Sources & Collecte',
  dedup: 'Déduplication & Workflow n8n',
  bulletins: 'Génération de bulletins',
  metriques: 'Évaluation scientifique',
  comptes: 'Comptes & Profil',
};

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem(SESSION_STORAGE_KEY)
  );
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [users, setUsers] = useState<UserAccount[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('veille');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [items, setItems] = useState<VeilleItem[]>([]);
  const [duplicates, setDuplicates] = useState<VeilleItem[]>([]);
  const [sources, setSources] = useState<VeilleSource[]>([]);
  const [keywords, setKeywords] = useState<WatchKeyword[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [metrics, setMetrics] = useState<ScientificMetrics | null>(null);
  const [settings, setSettings] = useState<PipelineSettings>({
    scheduleCadence: 'daily',
    dedupThreshold: 0.72,
    collectionMode: 'snapshot',
    ollamaEndpoint: 'http://localhost:11434',
    ollamaModel: 'mistral',
    preferLocalOllama: false,
  });

  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // Verify existing session token on mount
  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      if (!sessionToken) {
        if (active) {
          setCurrentUser(null);
          setAuthChecking(false);
        }
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          if (active) {
            setSessionToken(null);
            setCurrentUser(null);
          }
        } else {
          const data = await res.json();
          if (active) setCurrentUser(data.user);
        }
      } catch {
        if (active) setCurrentUser(null);
      } finally {
        if (active) setAuthChecking(false);
      }
    };
    checkSession();
    return () => {
      active = false;
    };
  }, [sessionToken]);

  const fetchAllData = useCallback(async () => {
    if (!sessionToken || !currentUser) return;
    try {
      const authHeaders = { Authorization: `Bearer ${sessionToken}` };
      const [
        itemsRes,
        dupsRes,
        sourcesRes,
        kwRes,
        runsRes,
        bulRes,
        metRes,
        setRes,
        usersRes,
      ] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/items?onlyDuplicates=true'),
        fetch('/api/sources'),
        fetch('/api/keywords'),
        fetch('/api/runs'),
        fetch('/api/bulletins'),
        fetch('/api/metrics'),
        fetch('/api/settings'),
        fetch('/api/users', { headers: authHeaders }),
      ]);

      const [
        itemsJson,
        dupsJson,
        sourcesJson,
        kwJson,
        runsJson,
        bulJson,
        metJson,
        setJson,
        usersJson,
      ] = await Promise.all([
        itemsRes.json(),
        dupsRes.json(),
        sourcesRes.json(),
        kwRes.json(),
        runsRes.json(),
        bulRes.json(),
        metRes.json(),
        setRes.json(),
        usersRes.ok ? usersRes.json() : Promise.resolve({ users: [] }),
      ]);

      setItems(itemsJson.items ?? []);
      setDuplicates(dupsJson.items ?? []);
      setSources(sourcesJson.sources ?? []);
      setKeywords(kwJson.keywords ?? []);
      setRuns(runsJson.runs ?? []);
      setBulletins(bulJson.bulletins ?? []);
      setMetrics(metJson.metrics ?? null);
      if (setJson.settings) setSettings(setJson.settings);
      setUsers(usersJson.users ?? []);
    } catch {
      setFeedback({ type: 'err', text: 'Impossible de charger les données de veille.' });
    } finally {
      setLoading(false);
    }
  }, [sessionToken, currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser, fetchAllData]);

  const handleAuthenticated = (token: string, user: UserAccount) => {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
    setSessionToken(token);
    setCurrentUser(user);
    setAuthChecking(false);
    setLoading(true);
  };

  const handleLogout = async () => {
    if (sessionToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionToken(null);
    setCurrentUser(null);
    setActiveTab('veille');
  };

  // User CRUD handlers
  const handleCreateUser = async (payload: {
    fullName: string;
    email: string;
    password: string;
    role: string;
    organization: string;
  }) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('err', data.error || 'Création du compte impossible.');
      return;
    }
    await fetchAllData();
    showNotice('ok', `Compte créé pour ${data.user.fullName}.`);
  };

  const handleUpdateUser = async (
    id: string,
    payload: {
      fullName: string;
      email: string;
      role: string;
      organization: string;
      password?: string;
    }
  ) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('err', data.error || 'Mise à jour impossible.');
      return;
    }
    if (currentUser && id === currentUser.id) {
      setCurrentUser(data.user);
    }
    await fetchAllData();
    showNotice('ok', `Profil mis à jour pour ${data.user.fullName}.`);
  };

  const handleDeleteUser = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('err', data.error || 'Suppression impossible.');
      return;
    }
    if (data.deletedSelf) {
      await handleLogout();
      return;
    }
    await fetchAllData();
    showNotice('ok', 'Compte supprimé.');
  };

  const handleRunCollect = async (
    mode: 'live_rss' | 'snapshot' | 'hybride',
    resetDemo = false
  ) => {
    setCollecting(true);
    try {
      const res = await fetch('/api/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, resetDemo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de la collecte');
      await fetchAllData();
      showNotice('ok', data.run?.logSummary || 'Collecte terminée avec succès.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setCollecting(false);
    }
  };

  const handleEvaluate = async (
    id: string,
    humanRelevant: number | null,
    summaryRating: number | null
  ) => {
    const res = await fetch(`/api/items/${id}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ humanRelevant, summaryRating }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
      const metRes = await fetch('/api/metrics');
      if (metRes.ok) {
        const metJson = await metRes.json();
        setMetrics(metJson.metrics);
      }
    }
  };

  const handleResummarize = async (id: string) => {
    const res = await fetch(`/api/items/${id}/resummarize`, { method: 'POST' });
    if (res.ok) {
      const { item } = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
      showNotice('ok', `Synthèse régénérée via ${item.aiEngine}.`);
    } else {
      showNotice('err', 'Impossible de régénérer la synthèse.');
    }
  };

  const handleAddSource = async (payload: {
    name: string;
    url: string;
    defaultDomain: VeilleDomain;
    sourceType: 'RSS' | 'Atom' | 'OpenData';
  }) => {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await fetchAllData();
      showNotice('ok', `Source « ${payload.name} » ajoutée.`);
    }
  };

  const handleToggleSource = async (id: string, enabled: boolean) => {
    await fetch(`/api/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  };

  const handleDeleteSource = async (id: string) => {
    await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    await fetchAllData();
  };

  const handleAddKeyword = async (payload: {
    term: string;
    domain: VeilleDomain;
    weight: number;
  }) => {
    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchAllData();
  };

  const handleDeleteKeyword = async (id: number) => {
    await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
    await fetchAllData();
  };

  const handleUpdateSettings = async (partial: Partial<PipelineSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    showNotice('ok', 'Configuration enregistrée dans SQLite.');
  };

  const handleGenerateBulletin = async (payload: {
    cadence: 'quotidien' | 'hebdomadaire';
    domains: string[];
    minRelevance: number;
    title?: string;
  }) => {
    const res = await fetch('/api/bulletins/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    await fetchAllData();
    showNotice('ok', 'Nouveau bulletin généré et archivé.');
    return data.bulletin as BulletinRecord;
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Vérification de la session...
      </div>
    );
  }

  if (!currentUser) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        uniqueCount={items.length}
        duplicateCount={duplicates.length}
        usersCount={users.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary CTA on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">Veille Technologique</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <button
            type="button"
            disabled={collecting}
            onClick={() => handleRunCollect(settings.collectionMode, false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`} />
            <span>{collecting ? 'Collecte en cours...' : 'Lancer la collecte'}</span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto space-y-5">
          {feedback && (
            <div
              role="status"
              className={`px-4 py-2.5 text-xs font-medium rounded-md border no-print ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {activeTab === 'veille' && (
            <WatchDashboard
              items={items}
              loading={loading}
              onEvaluate={handleEvaluate}
              onResummarize={handleResummarize}
              onNavigateSources={() => setActiveTab('sources')}
            />
          )}

          {activeTab === 'sources' && (
            <SourcesAndScheduleView
              sources={sources}
              keywords={keywords}
              runs={runs}
              settings={settings}
              collecting={collecting}
              onAddSource={handleAddSource}
              onToggleSource={handleToggleSource}
              onDeleteSource={handleDeleteSource}
              onAddKeyword={handleAddKeyword}
              onDeleteKeyword={handleDeleteKeyword}
              onUpdateSettings={handleUpdateSettings}
              onRunCollect={handleRunCollect}
            />
          )}

          {activeTab === 'dedup' && (
            <DeduplicationView
              duplicates={duplicates}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onResetDemo={() => handleRunCollect('snapshot', true)}
            />
          )}

          {activeTab === 'bulletins' && (
            <BulletinView
              bulletins={bulletins}
              onGenerateBulletin={handleGenerateBulletin}
            />
          )}

          {activeTab === 'metriques' && <MetricsView metrics={metrics} />}

          {activeTab === 'comptes' && (
            <AccountCrudView
              currentUser={currentUser}
              users={users}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>
    </div>
  );
}
