'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil, Store, Loader2, Check } from 'lucide-react';

export interface EditPartnerNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  role?: string;
  themeColor?: 'purple' | 'emerald' | 'amber';
  onSave: (newName: string) => Promise<void> | void;
}

export function EditPartnerNameModal({
  isOpen,
  onClose,
  currentName,
  role = 'loja',
  themeColor = 'purple',
  onSave
}: EditPartnerNameModalProps) {
  const [name, setName] = useState(currentName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName || '');
      setError(null);
      setLoading(false);
      // Focar o campo de texto ao abrir o modal
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const roleTitle = role === 'loja' 
    ? 'Nome da Loja' 
    : role === 'fornecedor' 
    ? 'Nome do Fornecedor' 
    : 'Nome do Estabelecimento';

  const themeStyles = {
    purple: {
      headerBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
      iconBg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300',
      focusRing: 'focus:ring-purple-500 focus:border-purple-500',
      saveBtn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20',
    },
    emerald: {
      headerBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300',
      focusRing: 'focus:ring-emerald-500 focus:border-emerald-500',
      saveBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    },
    amber: {
      headerBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300',
      focusRing: 'focus:ring-amber-500 focus:border-amber-500',
      saveBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    }
  }[themeColor] || {
    headerBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300',
    focusRing: 'focus:ring-purple-500 focus:border-purple-500',
    saveBtn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20',
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setError('Por favor, informe o nome do estabelecimento.');
      return;
    }

    if (cleanName.length < 2) {
      setError('O nome deve conter pelo menos 2 caracteres.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(cleanName);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar nome:', err);
      setError(err?.message || 'Erro ao salvar. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className={`p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center ${themeStyles.headerBg}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${themeStyles.iconBg}`}>
              <Pencil size={18} />
            </div>
            <div>
              <h3 id="modal-title" className="font-black text-zinc-900 dark:text-zinc-100 text-base leading-tight">
                Editar {roleTitle}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Altere o nome exibido aos seus clientes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition cursor-pointer disabled:opacity-50"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div>
            <label htmlFor="store-name-input" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {roleTitle} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="store-name-input"
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                maxLength={60}
                placeholder="Ex: Ponto do Açaí"
                className={`w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm font-semibold placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 ${themeStyles.focusRing} transition`}
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-bold text-zinc-400">
                {name.length}/60
              </span>
            </div>
            {error && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                ⚠️ {error}
              </p>
            )}
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
            <p className="flex items-start gap-1.5">
              <span className="text-purple-500 font-bold shrink-0">💡</span>
              <span>Este nome aparecerá no cabeçalho do seu painel, no catálogo e na comanda dos pedidos.</span>
            </p>
          </div>

          {/* Footer com botões */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || name.trim() === currentName?.trim()}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${themeStyles.saveBtn}`}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Salvar Nome</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
