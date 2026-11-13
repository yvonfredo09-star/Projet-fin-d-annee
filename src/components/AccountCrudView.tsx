import React, { useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { UserAccount } from '../types/veille';

interface AccountCrudViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  onCreateUser: (payload: {
    fullName: string;
    email: string;
    password: string;
    role: string;
    organization: string;
  }) => Promise<void>;
  onUpdateUser: (
    id: string,
    payload: {
      fullName: string;
      email: string;
      role: string;
      organization: string;
      password?: string;
    }
  ) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

export const AccountCrudView: React.FC<AccountCrudViewProps> = ({
  currentUser,
  users,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  // New User (Create)
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Analyste Veille');
  const [newOrg, setNewOrg] = useState('Cellule Veille R&D');

  // Edit User (Update)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Inline Delete Confirmation (no window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEditing = (u: UserAccount) => {
    setEditingId(u.id);
    setEditName(u.fullName);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditOrg(u.organization);
    setEditPassword('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 6) return;
    await onCreateUser({
      fullName: newName.trim(),
      email: newEmail.trim(),
      password: newPassword,
      role: newRole,
      organization: newOrg.trim() || 'Laboratoire R&D',
    });
    setNewName('');
    setNewEmail('');
    setNewPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    await onUpdateUser(editingId, {
      fullName: editName.trim(),
      email: editEmail.trim(),
      role: editRole.trim(),
      organization: editOrg.trim(),
      password: editPassword.trim() || undefined,
    });
    setEditingId(null);
    setEditPassword('');
  };

  return (
    <div className="space-y-6">
      {/* Current Authenticated Profile Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">Session active</div>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">
            {currentUser.fullName} · {currentUser.role}
          </h2>
          <div className="mt-1 text-xs text-slate-600 font-mono">
            {currentUser.email} · {currentUser.organization}
          </div>
        </div>
        <button
          type="button"
          onClick={() => startEditing(currentUser)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Modifier mon profil</span>
        </button>
      </div>

      {/* Inline Update Form when editing any user */}
      {editingId && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-white border border-blue-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Modification du compte utilisateur
            </h3>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="p-1 text-slate-400 hover:text-slate-700"
              aria-label="Annuler la modification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adresse e-mail
              </label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Organisation
              </label>
              <input
                type="text"
                required
                value={editOrg}
                onChange={(e) => setEditOrg(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rôle</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              >
                <option value="Analyste Veille">Analyste Veille</option>
                <option value="Responsable Veille R&D">Responsable Veille R&amp;D</option>
                <option value="Ingénieur Cybersécurité">Ingénieur Cybersécurité</option>
                <option value="Chercheur">Chercheur</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nouveau mot de passe (laisser vide pour conserver l&apos;actuel)
              </label>
              <input
                type="password"
                minLength={6}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="6 caractères minimum si modifié"
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer les modifications</span>
            </button>
          </div>
        </form>
      )}

      {/* Users CRUD Directory Table + Create Form */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Gestion CRUD des comptes utilisateurs ({users.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Créez, consultez, modifiez ou supprimez les comptes analystes stockés dans SQLite.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Utilisateur</th>
                <th className="py-2.5 px-4">Rôle</th>
                <th className="py-2.5 px-4">Organisation</th>
                <th className="py-2.5 px-4">Création</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                const isConfirmingDelete = confirmDeleteId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {u.fullName}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-blue-700">
                            (vous)
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {u.role}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {u.organization}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isConfirmingDelete ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteUser(u.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded hover:bg-red-800"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-500 hover:text-slate-900"
                          >
                            Annuler
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditing(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded transition-colors"
                            aria-label={`Modifier ${u.fullName}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={users.length <= 1}
                            onClick={() => setConfirmDeleteId(u.id)}
                            className="p-1.5 text-slate-400 hover:text-red-700 disabled:opacity-30 rounded transition-colors"
                            aria-label={`Supprimer ${u.fullName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Create User Form */}
        <form
          onSubmit={handleCreate}
          className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom complet</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Alice Martin"
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="alice@vigielab.fr"
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6+ car."
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
            >
              <option value="Analyste Veille">Analyste Veille</option>
              <option value="Responsable Veille R&D">Responsable Veille R&amp;D</option>
              <option value="Ingénieur Cybersécurité">Ingénieur Cybersécurité</option>
              <option value="Chercheur">Chercheur</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Équipe</label>
            <input
              type="text"
              value={newOrg}
              onChange={(e) => setNewOrg(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer compte</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
