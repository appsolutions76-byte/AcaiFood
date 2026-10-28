"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '@/store/useAppStore';

/**
 * R34 — Modos de pagamento dos saques dos parceiros:
 * 1. Saque na hora: paga assim que o parceiro pede.
 * 2. Pagamento no horário: paga sozinho, no horário marcado, o que ficou pendente.
 * 3. Sem nenhum ligado: só com a aprovação manual do admin.
 * Parceiro que trocou a chave Pix ou o CPF/CNPJ fica com os saques suspensos até o admin liberar.
 */

type Settings = {
  instant_payout_enabled: boolean;
  auto_payout_enabled: boolean;
  auto_payout_time: string;
  last_auto_payout_run_at: string | null;
};

type Hold = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  pix_key?: string;
  pix_key_type?: string;
  cpf_cnpj?: string;
  payout_hold_reason?: string;
  payout_hold_at?: string;
};

async function api(url: string, body?: any) {
  const res = await fetch(url, body === undefined
    ? { headers: await getAuthHeaders() }
    : { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

function Switch({ on, disabled, onClick, title }: { on: boolean; disabled?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition disabled:opacity-40 cursor-pointer ${on ? 'bg-emerald-600' : 'bg-zinc-400 dark:bg-zinc-600'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? 'translate-x-8' : 'translate-x-1'}`} />
    </button>
  );
}

export function PayoutModesPanel({ showToast, onChanged }: { showToast?: (m: string) => void; onChanged?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [time, setTime] = useState('18:00');
  const [holds, setHolds] = useState<Hold[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useCallback((m: string) => { if (showToast) showToast(m); else alert(m); }, [showToast]);

  const load = useCallback(async () => {
    try {
      const d = await api('/api/admin/payout-settings');
      if (d?.settings) {
        setSettings({
          instant_payout_enabled: d.settings.instant_payout_enabled === true,
          auto_payout_enabled: d.settings.auto_payout_enabled === true,
          auto_payout_time: d.settings.auto_payout_time || '18:00',
          last_auto_payout_run_at: d.settings.last_auto_payout_run_at || null
        });
        setTime(d.settings.auto_payout_time || '18:00');
      }
    } catch (e: any) {
      toast('Erro ao carregar os modos de saque: ' + (e?.message || ''));
    }
    try {
      const h = await api('/api/admin/payout-hold');
      setHolds(Array.isArray(h?.holds) ? h.holds : []);
    } catch (_e) {}
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (body: any, okMsg: string) => {
    setSaving(true);
    try {
      const d = await api('/api/admin/payout-settings', body);
      toast('⚙️ ' + (d?.message || okMsg));
      await load();
      if (onChanged) onChanged();
    } catch (e: any) {
      toast('❌ ' + (e?.message || 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const toggleInstant = () => {
    if (!settings) return;
    const next = !settings.instant_payout_enabled;
    const msg = next
      ? 'LIGAR o saque na hora?\n\nO Pix sai assim que o parceiro pedir, sem a sua aprovação, até o saldo livre dele (sem pedidos em andamento e corridas a pagar). Parceiro com chave Pix trocada continua bloqueado.'
      : 'DESLIGAR o saque na hora?\n\nOs novos pedidos de saque vão aguardar a sua aprovação (ou o pagamento no horário, se estiver ligado).';
    if (!window.confirm(msg)) return;
    save({ instant_payout_enabled: next }, next ? 'Saque na hora ligado.' : 'Saque na hora desligado.');
  };

  const toggleSchedule = () => {
    if (!settings) return;
    const next = !settings.auto_payout_enabled;
    const msg = next
      ? `LIGAR o pagamento no horário?\n\nTodo dia, a partir das ${time}, o app paga sozinho os saques que ainda estiverem pendentes.`
      : 'DESLIGAR o pagamento no horário?\n\nOs saques pendentes vão aguardar a sua aprovação.';
    if (!window.confirm(msg)) return;
    save({ auto_payout_enabled: next, auto_payout_time: time }, next ? 'Pagamento no horário ligado.' : 'Pagamento no horário desligado.');
  };

  const saveTime = () => {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) { toast('Horário inválido. Use HH:MM.'); return; }
    save({ auto_payout_time: time }, 'Horário salvo.');
  };

  const release = async (h: Hold) => {
    const note = window.prompt(
      `Liberar os saques de ${h.name || 'parceiro'}?\n\nChave Pix atual: ${h.pix_key || '—'}\nCPF/CNPJ atual: ${h.cpf_cnpj || '—'}\n\nSó libere se o parceiro confirmou a troca por e-mail ou pelo suporte.\nComo foi confirmado?`,
      'Confirmado por e-mail em ' + new Date().toLocaleDateString('pt-BR')
    );
    if (note === null) return;
    setSaving(true);
    try {
      const d = await api('/api/admin/payout-hold', { userId: h.id, note });
      toast('✅ ' + (d?.message || 'Saques liberados.'));
      await load();
      if (onChanged) onChanged();
    } catch (e: any) {
      toast('❌ ' + (e?.message || 'Erro ao liberar'));
    } finally {
      setSaving(false);
    }
  };

  const instantOn = settings?.instant_payout_enabled === true;
  const scheduleOn = settings?.auto_payout_enabled === true;
  const box = 'flex-1 min-w-[240px] bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">⚙️ Como os saques são pagos</h3>
        <p className="text-xs text-zinc-500">
          O Pix sai da subconta Asaas do próprio parceiro para a chave do CPF/CNPJ dele, até o saldo livre. A tarifa Pix sai do valor do saque.
          {(!instantOn && !scheduleOn) && ' Com os dois desligados, os saques só saem com a sua aprovação.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className={box}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-sm text-zinc-900 dark:text-white">⚡ Saque na hora</span>
            <Switch on={instantOn} disabled={saving || !settings} onClick={toggleInstant} title="Ligar/desligar saque na hora" />
          </div>
          <p className="text-[11px] text-zinc-500">
            {instantOn ? 'Ligado: o Pix sai assim que o parceiro pede.' : 'Desligado: o pedido fica em "Pendentes" para você aprovar.'}
          </p>
        </div>

        <div className={box}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-sm text-zinc-900 dark:text-white">🕕 Pagamento no horário</span>
            <Switch on={scheduleOn} disabled={saving || !settings} onClick={toggleSchedule} title="Ligar/desligar pagamento no horário" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="px-2 py-1.5 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            />
            <button disabled={saving} onClick={saveTime} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white cursor-pointer disabled:opacity-50">Salvar horário</button>
          </div>
          <p className="text-[11px] text-zinc-500">
            {scheduleOn
              ? 'Ligado: o que você não aprovar é pago sozinho uma vez por dia. A conferência roda por volta das 19h (Belém); horário depois disso fica para o dia seguinte.'
              : 'Desligado: os pendentes esperam a sua aprovação.'}
            {settings?.last_auto_payout_run_at && ` Última execução: ${new Date(settings.last_auto_payout_run_at).toLocaleString('pt-BR')}.`}
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2">
        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">🔒 Saques suspensos por troca de chave Pix ou CPF/CNPJ ({holds.length})</p>
        {holds.length === 0 ? (
          <p className="text-[11px] text-zinc-500">Nenhum parceiro com saque suspenso. Se alguém trocar a chave Pix ou o CPF/CNPJ, os saques dele param até você liberar aqui.</p>
        ) : (
          <ul className="space-y-2">
            {holds.map(h => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-zinc-900 dark:text-white">{h.name || 'Parceiro'} <span className="font-normal text-zinc-500">({h.role})</span></p>
                  <p className="text-zinc-600 dark:text-zinc-300">Chave Pix: {h.pix_key || '—'} · CPF/CNPJ: {h.cpf_cnpj || '—'}</p>
                  <p className="text-zinc-500">{h.payout_hold_reason || 'Chave alterada'} · {h.email || ''} {h.phone ? `· ${h.phone}` : ''}</p>
                </div>
                <button disabled={saving} onClick={() => release(h)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50">
                  Confirmado — liberar saques
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default PayoutModesPanel;
