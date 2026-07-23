"use client";

import React from "react";
import { User } from "@/store/useAppStore";
import { ShieldCheck, PauseCircle, Ban, CheckCircle, Search } from "lucide-react";

interface UserManagementTableProps {
  users: User[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  roleFilter: string;
  setRoleFilter: (role: string) => void;
  onUpdateStatus: (userId: string, newStatus: 'active' | 'paused' | 'blocked') => void;
}

export function UserManagementTable({
  users,
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  onUpdateStatus,
}: UserManagementTableProps) {
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.bairro?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            👥 Gestão de Usuários e Parceiros
          </h3>
          <p className="text-xs text-zinc-500">
            Aprovação, pausamento e auditoria de perfis cadastrados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="py-2 px-3 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
          >
            <option value="all">Todos os Perfis</option>
            <option value="cliente">Clientes</option>
            <option value="loja">Batedeiras (Lojas)</option>
            <option value="fornecedor">Fornecedores</option>
            <option value="motorista">Motoristas</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
          <thead className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-semibold uppercase text-xs">
            <tr>
              <th className="py-3 px-4 rounded-l-xl">Usuário</th>
              <th className="py-3 px-4">Função</th>
              <th className="py-3 px-4">Cidade / Bairro</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right rounded-r-xl">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-zinc-400">
                  Nenhum usuário encontrado com os filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>{user.icon || '👤'}</span> {user.name}
                    </div>
                    <div className="text-xs text-zinc-400">{user.email}</div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="capitalize px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      {user.role}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div>{user.cidade || 'Belém'}</div>
                    <div className="text-xs text-zinc-400">{user.bairro || '-'}</div>
                  </td>

                  <td className="py-3 px-4">
                    {user.status === 'blocked' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                        <Ban size={12} /> Bloqueado
                      </span>
                    ) : user.status === 'paused' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                        <PauseCircle size={12} /> Pausado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                        <CheckCircle size={12} /> Ativo
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.status !== 'active' && (
                        <button
                          onClick={() => onUpdateStatus(user.id, 'active')}
                          className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 rounded-lg transition"
                          title="Ativar Usuário"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {user.status !== 'paused' && (
                        <button
                          onClick={() => onUpdateStatus(user.id, 'paused')}
                          className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 rounded-lg transition"
                          title="Pausar Usuário"
                        >
                          <PauseCircle size={16} />
                        </button>
                      )}
                      {user.status !== 'blocked' && (
                        <button
                          onClick={() => onUpdateStatus(user.id, 'blocked')}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-lg transition"
                          title="Bloquear Usuário"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
