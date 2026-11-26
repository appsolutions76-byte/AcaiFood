'use client';
import { useEffect, useState } from 'react';

const ALERT_KEY = 'location_alert_shown_v1';
const TARGET_ROLES = ['loja', 'fornecedor'];

interface LocationAlertModalProps {
  userRole?: string;
  onUpdateGPS?: () => void;
}

export function LocationAlertModal({ userRole, onUpdateGPS }: LocationAlertModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userRole) return;
    if (!TARGET_ROLES.includes(String(userRole).toLowerCase())) return;
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(ALERT_KEY) === 'true') return;
    } catch {
      return;
    }
    setVisible(true);
  }, [userRole]);

  function dismiss() {
    try { localStorage.setItem(ALERT_KEY, 'true'); } catch {}
    setVisible(false);
  }

  function handleUpdate() {
    dismiss();
    if (onUpdateGPS) onUpdateGPS();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="text-4xl mb-3 text-center">📍</div>
        <h2 className="text-lg font-bold text-center text-zinc-900 dark:text-white mb-2">
          Confirme sua localização
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-2">
          Você está no seu <strong>estabelecimento agora</strong>?
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-5">
          Para que clientes e motoboys te encontrem corretamente, atualize sua
          localização <strong>estando presente fisicamente no estabelecimento</strong>.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleUpdate}
            className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold py-3 rounded-xl text-sm transition"
          >
            📍 Estou aqui — Atualizar agora
          </button>
          <button
            onClick={dismiss}
            className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium py-3 rounded-xl text-sm transition"
          >
            Lembrar depois
          </button>
        </div>
      </div>
    </div>
  );
}
