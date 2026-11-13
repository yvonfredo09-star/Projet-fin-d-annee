import React, { useState } from 'react';
import {
  LayoutList,
  Rss,
  GitCompareArrows,
  FileText,
  BarChart3,
  Users,
  LogOut,
  X,
} from 'lucide-react';
import avatarImg from '../assets/images/avatar_research_lead_1794558884329.jpg';
import type { UserAccount } from '../types/veille';

export type ActiveTab = 'veille' | 'sources' | 'dedup' | 'bulletins' | 'metriques' | 'comptes';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  uniqueCount: number;
  duplicateCount: number;
  usersCount: number;
  currentUser: UserAccount;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'veille', label: 'Tableau de veille', icon: LayoutList },
  { id: 'sources', label: 'Sources & Collecte', icon: Rss },
  { id: 'dedup', label: 'Déduplication & n8n', icon: GitCompareArrows },
  { id: 'bulletins', label: 'Bulletins', icon: FileText },
  { id: 'metriques', label: 'Évaluation rapport', icon: BarChart3 },
  { id: 'comptes', label: 'Comptes & Profil', icon: Users },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  uniqueCount,
  duplicateCount,
  usersCount,
  currentUser,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const [imgError, setImgError] = useState(false);

  const initials = currentUser.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const showDemoAvatar =
    !imgError && currentUser.email.toLowerCase() === 'claire.moreau@vigielab.fr';

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 w-64 shrink-0">
      <div>
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            VigieLab
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const countText =
              item.id === 'veille'
                ? uniqueCount
                : item.id === 'dedup'
                ? duplicateCount
                : item.id === 'comptes'
                ? usersCount
                : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {countText !== null && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-blue-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {countText}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-3">
          {showDemoAvatar ? (
            <img
              src={avatarImg}
              alt={currentUser.fullName}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
              {initials || 'VL'}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">
              {currentUser.fullName}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {currentUser.role}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Se déconnecter</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-screen sticky top-0 no-print">
        {navContent}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};

