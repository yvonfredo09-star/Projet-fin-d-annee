import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import type { UserAccount } from '../types/veille';

interface AuthGateProps {
  onAuthenticated: (token: string, user: UserAccount) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('Cellule Veille R&D');
  const [role, setRole] = useState('Analyste Veille');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setError(null);
  };

  const handleFillDemo = () => {
    setMode('signin');
    setEmail('claire.moreau@vigielab.fr');
    setPassword('VigieLab2026!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'signin'
          ? { email, password }
          : { fullName, email, password, role, organization };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de l’authentification.');
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setError('Impossible de joindre le serveur d’authentification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-2 text-center">
        <div className="font-display text-2xl font-bold tracking-tight text-slate-900">
          VigieLab
        </div>
        <h1 className="text-lg font-semibold text-slate-800 text-balance">
          Plateforme de veille intelligente et détection d&apos;opportunités
        </h1>
        <p className="text-xs text-slate-500">
          Connectez-vous ou créez un compte analyste pour accéder à vos sources RSS et synthèses.
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
          {/* Segmented Sign In / Sign Up Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => handleSwitchMode('signin')}
              className={`py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('signup')}
              className={`py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 text-xs font-medium text-red-900 bg-red-50 border border-red-200 rounded-md"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Nom complet
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ex: Marc Lefèvre"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="auth-org"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Organisation
                    </label>
                    <input
                      id="auth-org"
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auth-role"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Rôle
                    </label>
                    <select
                      id="auth-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white"
                    >
                      <option value="Analyste Veille">Analyste Veille</option>
                      <option value="Responsable Veille R&D">Responsable Veille R&amp;D</option>
                      <option value="Ingénieur Cybersécurité">Ingénieur Cybersécurité</option>
                      <option value="Chercheur">Chercheur</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Adresse e-mail
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@organisation.fr"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Mot de passe
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Confirmer le mot de passe
                </label>
                <input
                  id="auth-confirm"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:bg-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {mode === 'signin' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>
                {submitting
                  ? 'Traitement...'
                  : mode === 'signin'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
              </span>
            </button>
          </form>

          {mode === 'signin' && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Compte de démonstration SQLite :</span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Pré-remplir (claire.moreau@vigielab.fr)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
