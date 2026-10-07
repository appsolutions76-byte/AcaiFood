"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase, getAuthHeaders } from '@/lib/supabase';

// Aceite obrigatório dos textos legais na versão vigente (cl. 8.2.4 do contrato BaaS).
// Aparece para quem está logado e ainda não aceitou a versão atual (usuários antigos ou
// quando os textos mudam). O cadastro registra o aceite por conta própria.

const DOC_LABELS: Record<string, React.ReactNode> = {
  acaifood_terms: <>Li e aceito os <a href="/politica-de-privacidade" target="_blank" className="underline font-bold">Termos de Uso do AçaíFood</a>.</>,
  acaifood_privacy: <>Li e aceito a <a href="/politica-de-privacidade" target="_blank" className="underline font-bold">Política de Privacidade do AçaíFood</a>.</>,
  asaas_terms: <>Li e concordo com os <a href="https://www.asaas.com/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline font-bold">Termos de Uso do Asaas</a> (Asaas Gestão Financeira Instituição de Pagamento S.A.), que presta os serviços financeiros.</>,
  asaas_privacy: <>Li e concordo com a <a href="https://www.asaas.com/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline font-bold">Política de Privacidade do Asaas</a>.</>,
  subaccount_mandate: <>Autorizo a <strong>Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)</strong> a solicitar a abertura e a movimentação da minha subconta Asaas para receber os repasses das minhas vendas/entregas.</>,
  pix_random_key_consent: <>Autorizo a criação de uma chave Pix aleatória na minha subconta Asaas para recebimentos.</>
};

const SKIP_PATHS = ['/cadastro', '/login', '/politica-de-privacidade', '/apresentacao'];

export function TermsAcceptanceGate() {
  const pathname = usePathname() || '';
  const [missing, setMissing] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skip = SKIP_PATHS.some(p => pathname.startsWith(p));

  const check = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMissing([]); return; }
      const res = await fetch('/api/terms/status', { headers: await getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setMissing(Array.isArray(data?.missingDocs) ? data.missingDocs : []);
    } catch (_e) {
      // Sem rede: não bloqueia; tenta de novo no próximo login/navegação
    }
  };

  useEffect(() => {
    if (skip) return;
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') check();
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  if (skip || missing.length === 0) return null;

  const allChecked = missing.every(d => checked[d]);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/terms/accept', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ documents: missing })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Não foi possível registrar o aceite. Tente novamente.');
        return;
      }
      await check();
    } catch (_e) {
      setError('Sem conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl max-w-lg w-full p-5 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-extrabold">Atualizamos nossos termos</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Para continuar usando o AçaíFood, leia e aceite os documentos abaixo.</p>
        <ul className="space-y-2">
          {missing.map(doc => (
            <li key={doc} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                id={`terms_${doc}`}
                className="mt-0.5 w-4 h-4 shrink-0"
                checked={!!checked[doc]}
                onChange={e => setChecked({ ...checked, [doc]: e.target.checked })}
              />
              <label htmlFor={`terms_${doc}`} className="leading-relaxed">{DOC_LABELS[doc] || doc}</label>
            </li>
          ))}
        </ul>
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <div className="flex justify-between items-center gap-2 pt-2">
          <button
            type="button"
            className="text-xs text-zinc-500 underline"
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
          >
            Sair
          </button>
          <button
            type="button"
            disabled={!allChecked || saving}
            onClick={accept}
            className="bg-purple-600 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl"
          >
            {saving ? 'Registrando…' : 'Aceitar e continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TermsAcceptanceGate;
