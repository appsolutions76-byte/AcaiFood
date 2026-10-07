"use client";

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ExternalLink, FileText, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Upload } from 'lucide-react';
import { getAuthHeaders, supabase } from '@/lib/supabase';

// "Minha conta Asaas": abertura da subconta com dados reais (cl. 8.2.3), envio de
// documentos pelo fluxo do Asaas (onboardingUrl) ou upload, e situação da conta.

type DocGroup = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  onboardingUrl?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_DOCUMENTS: 'Documentos pendentes',
  PENDING: 'Cadastro pendente',
  AWAITING_APPROVAL: 'Em análise pelo Asaas',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
  NEEDS_ADMIN: 'Aguardando a equipe AçaíFood'
};

function onlyDigits(v: any) {
  return String(v || '').replace(/\D/g, '');
}

export function AsaasAccountStatusCard() {
  const currentUser = useAppStore((state: any) => state.currentUser);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [docs, setDocs] = useState<DocGroup[]>([]);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Formulário de abertura (só os dados que o Asaas exige e que ainda faltam)
  const [form, setForm] = useState({
    birthDate: '',
    monthlyIncome: '',
    companyType: 'MEI',
    postalCode: '',
    endereco: '',
    addressNumber: '',
    bairro: '',
    phone: ''
  });

  const cpfCnpj = onlyDigits(currentUser?.cpfCnpj);
  const isCnpj = cpfCnpj.length === 14;

  const fetchDocStatus = async (resync = false) => {
    if (!currentUser?.id) return;
    setLoading(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      if (resync) {
        await fetch('/api/asaas/account-status-sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId: currentUser.id })
        }).catch(() => null);
      }
      const res = await fetch(`/api/asaas/documents?userId=${currentUser.id}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        const st = data.hasAccount ? String(data.status || 'PENDING_DOCUMENTS') : 'NO_ACCOUNT';
        setStatus(st);
        if (st && currentUser?.asaas_account_status !== st) {
          useAppStore.setState((state: any) => ({
            currentUser: state.currentUser ? { ...state.currentUser, asaas_account_status: st } : state.currentUser
          }));
        }
        const groups: DocGroup[] = Array.isArray(data.documents) ? data.documents : [];
        setDocs(groups.filter(g => String(g?.status || '').toUpperCase() !== 'APPROVED'));
        setOnboardingUrl(data.onboardingUrl || null);
      } else {
        setMessage(data?.error || 'Não foi possível consultar sua conta Asaas agora.');
      }
    } catch (_err) {
      setMessage('Não foi possível consultar sua conta Asaas agora.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Pré-preenche o formulário com o perfil do próprio usuário
  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.rpc('get_my_profile_json').then(({ data }: any) => {
      if (!data) return;
      setForm(f => ({
        ...f,
        birthDate: data.birth_date || f.birthDate,
        monthlyIncome: data.monthly_income ? String(data.monthly_income) : f.monthlyIncome,
        companyType: data.company_type || f.companyType,
        postalCode: data.postal_code || f.postalCode,
        endereco: data.endereco || f.endereco,
        addressNumber: data.address_number || f.addressNumber,
        bairro: data.bairro || data.province || f.bairro,
        phone: data.phone || data.telefone || f.phone
      }));
    });
  }, [currentUser?.id]);

  if (!currentUser) return null;

  const handleOpenSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const income = Number(String(form.monthlyIncome).replace(',', '.'));
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      setMessage('Seu cadastro está sem CPF/CNPJ válido. Fale com o suporte.');
      return;
    }
    if (isNaN(income) || income < 100) {
      setMessage(isCnpj ? 'Informe o faturamento mensal (mínimo R$ 100).' : 'Informe sua renda mensal (mínimo R$ 100).');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/asaas/subaccount', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          cpfCnpj,
          phone: form.phone,
          endereco: form.endereco,
          addressNumber: form.addressNumber,
          bairro: form.bairro,
          cidade: currentUser.cidade,
          postalCode: onlyDigits(form.postalCode),
          birthDate: isCnpj ? undefined : form.birthDate,
          monthlyIncome: income,
          companyType: isCnpj ? form.companyType : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setMessage('Conta de pagamento aberta. Em alguns segundos os documentos pendentes aparecem aqui.');
        // O Asaas recomenda aguardar ~15 s antes de consultar os documentos da subconta nova
        setTimeout(() => fetchDocStatus(false), 15000);
      } else {
        setMessage(data?.error || 'Não foi possível abrir a conta de pagamento.');
      }
    } catch (_err) {
      setMessage('Erro de conexão ao abrir a conta de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (group: DocGroup, file: File | null) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setMessage('Envie PDF, JPG ou PNG.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('O arquivo deve ter no máximo 10 MB.');
      return;
    }
    setUploadingId(group.id);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      delete (headers as any)['Content-Type']; // o navegador define o boundary do multipart
      const fd = new FormData();
      fd.append('userId', currentUser.id);
      fd.append('documentId', group.id);
      fd.append('type', String(group.type || 'CUSTOM'));
      fd.append('documentFile', file);
      const res = await fetch('/api/asaas/documents', { method: 'POST', headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setMessage('Documento enviado. A análise do Asaas pode levar até 48 horas.');
        await fetchDocStatus(false);
      } else {
        setMessage(data?.error || 'Não foi possível enviar o documento.');
      }
    } catch (_err) {
      setMessage('Erro de conexão ao enviar o documento.');
    } finally {
      setUploadingId(null);
    }
  };

  const shell = 'bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-900/60 p-4 sm:p-5 rounded-2xl shadow-md space-y-3';
  const input = 'mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none';
  const label = 'block text-[11px] font-bold text-zinc-700 dark:text-zinc-300';

  const legalNote = (
    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
      Sua conta de pagamento é aberta e mantida pelo <strong>Asaas Gestão Financeira Instituição de Pagamento S.A.</strong> A análise pode levar até 48 horas.
    </p>
  );

  if (!status && loading) {
    return <div className={shell}><p className="text-xs text-zinc-500">Consultando sua conta Asaas…</p></div>;
  }

  // 1) Ainda sem subconta: formulário de abertura
  if (status === 'NO_ACCOUNT' || status === '') {
    return (
      <form onSubmit={handleOpenSubaccount} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <span>Abra sua conta de pagamento Asaas para receber os repasses</span>
        </div>
        <p className="text-xs text-amber-800/80 dark:text-amber-300">Use seus dados verdadeiros: eles vão para o Asaas e o Banco Central.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isCnpj ? (
            <div>
              <label className={label}>Tipo de empresa</label>
              <select className={input} value={form.companyType} onChange={e => setForm({ ...form, companyType: e.target.value })}>
                <option value="MEI">MEI</option>
                <option value="LIMITED">Sociedade Limitada</option>
                <option value="INDIVIDUAL">Empresário Individual</option>
                <option value="ASSOCIATION">Associação</option>
              </select>
            </div>
          ) : (
            <div>
              <label className={label}>Data de nascimento</label>
              <input type="date" required className={input} value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
            </div>
          )}
          <div>
            <label className={label}>{isCnpj ? 'Faturamento mensal (R$)' : 'Renda mensal (R$)'}</label>
            <input type="number" min={100} required className={input} value={form.monthlyIncome} onChange={e => setForm({ ...form, monthlyIncome: e.target.value })} placeholder="Ex.: 2500" />
          </div>
          <div>
            <label className={label}>Celular com DDD</label>
            <input type="tel" required className={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="91 98888-7777" />
          </div>
          <div>
            <label className={label}>CEP</label>
            <input type="text" required inputMode="numeric" className={input} value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} placeholder="66000-000" />
          </div>
          <div>
            <label className={label}>Rua</label>
            <input type="text" required className={input} value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
          </div>
          <div>
            <label className={label}>Número</label>
            <input type="text" required className={input} value={form.addressNumber} onChange={e => setForm({ ...form, addressNumber: e.target.value })} />
          </div>
          <div>
            <label className={label}>Bairro</label>
            <input type="text" required className={input} value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} />
          </div>
        </div>

        {message && <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{message}</p>}

        <div className="flex items-center justify-between gap-2 pt-1">
          {legalNote}
          <button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shrink-0 cursor-pointer">
            <FileText size={14} />
            <span>{loading ? 'Enviando…' : 'Abrir conta de pagamento'}</span>
          </button>
        </div>
      </form>
    );
  }

  // 2) Aprovada
  if (status === 'APPROVED') {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3.5 rounded-2xl flex items-center gap-2.5 shadow-sm">
        <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm"><ShieldCheck size={18} /></div>
        <div>
          <span className="font-extrabold text-sm text-emerald-900 dark:text-emerald-100">Conta de pagamento Asaas aprovada</span>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Seus saques são pagos na sua subconta Asaas.</p>
        </div>
      </div>
    );
  }

  // 3) Em andamento / recusada / aguardando equipe
  return (
    <div className={shell}>
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
            {status === 'REJECTED' ? <AlertTriangle size={20} /> : <Clock size={20} />}
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Minha conta Asaas</h3>
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">{STATUS_LABEL[status] || status}</span>
          </div>
        </div>
        <button onClick={() => fetchDocStatus(true)} disabled={loading} className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold">
          {loading ? 'Consultando…' : 'Reconsultar'}
        </button>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px] font-bold">
        <li className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex flex-col items-center gap-1"><CheckCircle2 size={14} />Cadastro enviado</li>
        <li className={`p-2 rounded-xl flex flex-col items-center gap-1 ${status === 'PENDING_DOCUMENTS' || status === 'PENDING' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'}`}><FileText size={14} />Documentos</li>
        <li className={`p-2 rounded-xl flex flex-col items-center gap-1 ${status === 'AWAITING_APPROVAL' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500'}`}><Clock size={14} />Em análise</li>
        <li className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 flex flex-col items-center gap-1"><ShieldCheck size={14} />Aprovada</li>
      </ol>

      {status === 'NEEDS_ADMIN' && (
        <p className="text-xs text-zinc-600 dark:text-zinc-300">Já existe uma conta Asaas com o seu CPF/CNPJ. Nossa equipe vai concluir a vinculação; se precisar, fale com o suporte.</p>
      )}

      {onboardingUrl && (
        <a href={onboardingUrl} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-700 text-white font-black px-4 py-2.5 rounded-xl text-xs inline-flex items-center gap-2">
          Enviar documento com foto e selfie no Asaas <ExternalLink size={14} />
        </a>
      )}

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map(g => (
            <li key={g.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-100">{g.title || g.type || 'Documento'}</p>
                {g.description && <p className="text-zinc-500 dark:text-zinc-400">{g.description}</p>}
                <p className="text-[10px] text-zinc-400 uppercase">{g.status}</p>
              </div>
              {g.onboardingUrl ? (
                <a href={g.onboardingUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 font-bold inline-flex items-center gap-1">Enviar pelo Asaas <ExternalLink size={12} /></a>
              ) : (
                <label className="cursor-pointer text-purple-600 font-bold inline-flex items-center gap-1">
                  <Upload size={12} />
                  {uploadingId === g.id ? 'Enviando…' : 'Enviar arquivo'}
                  <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => handleUpload(g, e.target.files?.[0] || null)} />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{message}</p>}
      {legalNote}
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Você só recebe repasses depois que a sua conta Asaas for aprovada.</p>
    </div>
  );
}

export default AsaasAccountStatusCard;
