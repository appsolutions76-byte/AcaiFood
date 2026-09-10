"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, Role, User } from "@/store/useAppStore";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, BookOpen, Sparkles, CheckCircle2, QrCode, Copy, ArrowRight, Clock, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams?.get('role') || 'cliente';
  
  const registerUser = useAppStore(state => state.registerUser);
  const linkAsaasAccount = useAppStore(state => state.linkAsaasAccount);
  const cities = useAppStore(state => state.cities);
  const fetchCities = useAppStore(state => state.fetchCities);
  
  const [role, setRole] = useState<Role>(defaultRole as Role);
  const [veiculo, setVeiculo] = useState("Moto"); // Para motoristas
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("Belém");
  const [bairro, setBairro] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [termosModalOpen, setTermosModalOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [isRegisteringAtStore, setIsRegisteringAtStore] = useState(true);
  
  const [step, setStep] = useState(1); // 1 = Formulario, 2 = Ativação / Homologação
  const [newUserId, setNewUserId] = useState("");

  // Estado da cota e taxa de ativação
  const [activationInfo, setActivationInfo] = useState<{
    activationEnabled: boolean;
    activationFee: number;
    freeQuota: number;
    subsidizedCount: number;
    freeSlotsRemaining: number;
    isFree: boolean;
  }>({
    activationEnabled: true,
    activationFee: 13.10,
    freeQuota: 8,
    subsidizedCount: 8,
    freeSlotsRemaining: 0,
    isFree: false
  });

  // Estado de pagamento Pix
  const [pixData, setPixData] = useState<{
    paymentId?: string;
    pixQrCode?: string;
    pixCopiaECola?: string;
    isFreeGranted?: boolean;
  } | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  useEffect(() => {
    fetchCities();
    fetch('/api/asaas/activation')
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          setActivationInfo({
            activationEnabled: Boolean(data.activationEnabled),
            activationFee: Number(data.activationFee || 13.10),
            freeQuota: Number(data.freeQuota || 8),
            subsidizedCount: Number(data.subsidizedCount || 0),
            freeSlotsRemaining: Number(data.freeSlotsRemaining || 0),
            isFree: Boolean(data.isFree)
          });
        }
      })
      .catch(_e => console.warn("Aviso ao carregar info de ativação:", _e));

    const pendingId = searchParams?.get('pendingUserId');
    if (pendingId) {
      setNewUserId(pendingId);
      setStep(2);

      const storeUser = useAppStore.getState().currentUser;
      if (storeUser && storeUser.id === pendingId && storeUser.role) {
        setRole(storeUser.role as any);
      } else {
        supabase.from('users').select('role').eq('id', pendingId).maybeSingle().then(({ data }) => {
          if (data?.role) {
            const r = String(data.role).toLowerCase();
            if (r.includes('partner') || r.includes('loja')) setRole('loja');
            else if (r.includes('supplier') || r.includes('fornecedor')) setRole('fornecedor');
            else if (r.includes('courier') || r.includes('motoboy') || r.includes('motorista')) setRole('motorista');
          }
        });
      }

      fetch('/api/asaas/activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingId })
      })
      .then(r => r.json())
      .then(actData => {
        if (actData?.isFounderSubsidized || actData?.isPaid) {
          setPixData({ isFreeGranted: Boolean(actData?.isFounderSubsidized) });
          setIsPaymentConfirmed(true);
        } else if (actData?.paymentId) {
          setPixData({
            paymentId: actData.paymentId,
            pixQrCode: actData.pixQrCode,
            pixCopiaECola: actData.pixCopiaECola,
            isFreeGranted: false
          });
        }
      })
      .catch(_err => console.warn('Aviso ao carregar ativação pendente:', _err));
    }
  }, [fetchCities, searchParams]);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termosAceitos) {
      alert("Você deve ler e aceitar os Termos de Uso para continuar.");
      return;
    }
    
    let icon = '👤';
    if (role === 'loja') icon = '🏪';
    if (role === 'fornecedor') icon = '👨‍🌾';
    if (role === 'motorista' && veiculo === 'Moto') icon = '🛵';
    if (role === 'motorista' && veiculo === 'Caminhão') icon = '🚚';
    if (role === 'motorista' && veiculo === 'Caçamba') icon = '🚛';

    const cleanCpf = cpfCnpj.replace(/\D/g, "");
    if (role !== 'cliente' && (!cleanCpf || (cleanCpf.length !== 11 && cleanCpf.length !== 14))) {
      alert("Para parceiros, o preenchimento de um CPF (11 dígitos) ou CNPJ (14 dígitos) válido é obrigatório. Ele será utilizado como sua Chave Pix oficial de recebimento de repasses (mesma titularidade).");
      return;
    } else if (cleanCpf && cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      alert("O CPF deve possuir 11 dígitos ou o CNPJ 14 dígitos válidos.");
      return;
    }

    setIsLocating(true);
    let lat = -1.45575;
    let lng = -48.49018;

    if (role === 'cliente' || role === 'motorista' || isRegisteringAtStore) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, enableHighAccuracy: false });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (geoErr) {
        console.warn("GPS não obtido. Utilizando coordenadas padrão da cidade base.", geoErr);
      }
    }

    try {
      const data: Partial<User> = {
        role, name, email, password, telefone, endereco, cidade, bairro, icon, lat, lng, cpfCnpj: cleanCpf
      };
      
      if (role !== 'cliente') {
        data.pixKey = cleanCpf; // A Chave Pix é OBRIGATORIAMENTE o CPF/CNPJ do titular cadastrado
      }
      if (role === 'motorista') {
        data.veiculo = veiculo;
      }
      if (role === 'loja') {
        data.priceB2C = { popular: 18, medio: 25, grosso: 33 };
        data.freteSubsidyPct = 0;
      }
      if (role === 'fornecedor') {
        data.priceB2B = 140;
        data.freteSubsidyPct = 0;
      }

      const newUser = await registerUser(data as Omit<User, "id">);
      setIsLocating(false);
      
      if (newUser) {
        if (role === 'cliente') {
          router.push('/');
        } else {
          setNewUserId(newUser.id);
          
          try {
            const actRes = await fetch('/api/asaas/activation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: newUser.id,
                name,
                email,
                cpfCnpj: cleanCpf,
                phone: telefone
              })
            });
            const actData = await actRes.json();
            if (actData.isFounderSubsidized) {
              setPixData({ isFreeGranted: true });
              setIsPaymentConfirmed(true);
            } else {
              setPixData({
                paymentId: actData.paymentId,
                pixQrCode: actData.pixQrCode,
                pixCopiaECola: actData.pixCopiaECola,
                isFreeGranted: false
              });
            }
          } catch (_e) {
            console.warn("Aviso ao inicializar ativação:", _e);
          }

          setStep(2);
        }
      } else {
        alert("Erro ao criar conta. Verifique os dados informados.");
      }
    } catch (_err) {
      setIsLocating(false);
      alert("Ocorreu um erro no processo de cadastro. Tente novamente.");
    }
  };

  const checkPixStatus = async (silent = false) => {
    if (!newUserId) return;
    if (!silent) setIsCheckingPayment(true);
    try {
      const res = await fetch(`/api/asaas/activation?userId=${newUserId}${pixData?.paymentId ? `&paymentId=${pixData.paymentId}` : ''}`);
      const data = await res.json();
      if (data?.userStatus?.isPaid) {
        setIsPaymentConfirmed(true);
        // Tenta vincular subconta Asaas oficial agora que o pagamento da homologação foi verificado
        try {
          const { data: sessData } = await supabase.auth.getSession();
          const authHeaders: any = { 'Content-Type': 'application/json' };
          if (sessData?.session?.access_token) {
            authHeaders['Authorization'] = `Bearer ${sessData.session.access_token}`;
          }
          fetch('/api/asaas/subaccount', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              userId: newUserId,
              name: name || undefined,
              email: email || undefined,
              cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
              phone: telefone || undefined,
              endereco: endereco || undefined,
              bairro: bairro || undefined,
              cidade: cidade || undefined
            })
          }).catch(_err => console.warn("Aviso ao vincular subconta após Pix:", _err));
        } catch (_sErr) {}
      } else if (!silent) {
        alert("Pagamento ainda em processamento. Aguarde alguns segundos após pagar no seu banco e tente novamente.");
      }
    } catch (_e) {
      if (!silent) alert("Erro ao checar status. Tente novamente.");
    } finally {
      if (!silent) setIsCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (step === 2 && !isPaymentConfirmed && newUserId) {
      const interval = setInterval(() => {
        checkPixStatus(true);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [step, isPaymentConfirmed, newUserId, pixData?.paymentId]);

  const handleCopyPix = () => {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleGoToPartnerPanel = () => {
    const roleStr = String(role || '').toLowerCase();
    const veicStr = String(veiculo || '').toLowerCase();

    if (roleStr === 'loja') router.push('/parceiros/batedeira');
    else if (roleStr === 'fornecedor') router.push('/parceiros/fornecedor');
    else if (roleStr === 'caminhao' || (roleStr === 'motorista' && (veicStr.includes('caminh') || veicStr.includes('caçamb')))) router.push('/parceiros/caminhao');
    else if (roleStr === 'motoboy' || roleStr === 'motorista') router.push('/parceiros/motoboy');
    else router.push('/');
  };

  const getTermosText = () => {
    switch(role) {
      case 'cliente':
        return (
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p><strong>1. Uso da Plataforma:</strong> O AçaíFood atua exclusivamente como intermediador tecnológico entre você (cliente) e as lojas cadastradas.</p>
            <p><strong>2. Responsabilidade do Produto:</strong> A qualidade, o preparo, a integridade e o cumprimento das normas sanitárias do açaí e demais produtos são de inteira e exclusiva responsabilidade da Batedeira (Loja) que preparou o pedido. O AçaíFood não manuseia alimentos.</p>
            <p><strong>3. Entregas:</strong> O tempo de entrega é uma estimativa e pode variar devido a condições climáticas, trânsito ou demanda da loja.</p>
          </div>
        );
      case 'loja':
      case 'fornecedor':
        return (
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p><strong>1. Qualidade e Legalidade:</strong> Você assume total responsabilidade pela qualidade do produto fornecido, garantindo que ele segue todas as normas sanitárias e da vigilância em saúde locais.</p>
            <p><strong>2. Obrigações Fiscais:</strong> A emissão de notas fiscais e o recolhimento de impostos sobre a venda dos produtos é de sua responsabilidade exclusiva. O AçaíFood apenas emite recibos pelas taxas de uso da plataforma.</p>
            <p><strong>3. Vínculo:</strong> A utilização desta plataforma não cria vínculo empregatício, societário ou de franquia entre o Parceiro e o AçaíFood. A plataforma cobra apenas um comissionamento (Split) sobre as vendas intermediadas.</p>
          </div>
        );
      case 'motorista':
        return (
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p><strong>1. Trabalho Autônomo:</strong> Você atua como profissional independente (autônomo), sem qualquer vínculo empregatício, subordinação ou exclusividade com o AçaíFood ou com as Lojas parceiras.</p>
            <p><strong>2. Responsabilidade Veicular:</strong> É de sua inteira responsabilidade a manutenção do veículo utilizado, os custos operacionais (combustível, internet) e a manutenção de sua CNH regularizada.</p>
            <p><strong>3. Acidentes e Infrações:</strong> O AçaíFood é isento de responsabilidades civis ou criminais decorrentes de acidentes de trânsito, infrações ou danos a terceiros ocorridos durante o trajeto. Conduza com prudência.</p>
          </div>
        );
      default:
        return <p className="text-sm text-zinc-500">Ao usar a plataforma, você concorda com nossas políticas de privacidade e conduta.</p>;
    }
  };

  return (
    <>
      <PartnerManualModal isOpen={manualOpen} onClose={() => setManualOpen(false)} role="login" />
      {step === 1 && (
        <>
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="flex flex-col justify-center items-center mb-4 text-center">
              <img src="/banner.png?v=4" alt="Marca Oficial AçaíFood" className="w-36 h-36 rounded-2xl shadow-xl border-2 border-purple-500 object-contain" />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-2 max-w-xs">AçaíFood © 2026 • Tecnologia, Logística e Sustentabilidade da Cadeia do Açaí.</p>
            </div>
            <h2 className="text-center text-3xl font-extrabold text-zinc-900 dark:text-white">
              Crie sua Conta
            </h2>
            <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Ou <Link href="/login" className="font-medium text-purple-600 hover:text-purple-500">faça login se já for cadastrado</Link>
            </p>
          </div>

          <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
            
            {/* Banner de Vagas Promocionais para Parceiros */}
            {role !== 'cliente' && (
              <div className="mb-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-emerald-500/10 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0 shadow-md">
                  <Sparkles size={20} />
                </div>
                <div>
                  {activationInfo.isFree && activationInfo.freeSlotsRemaining > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                          100% Grátis
                        </span>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Vaga Fundador Disponível!</p>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        Restam <strong>{activationInfo.freeSlotsRemaining} de {activationInfo.freeQuota}</strong> vagas com taxa Asaas isenta pelo app.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-800">
                          Ativação Comercial
                        </span>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Homologação Asaas</p>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {activationInfo.freeQuota > 0 && activationInfo.freeSlotsRemaining <= 0 ? (
                          <>Vagas de fundador preenchidas (<strong>0 de {activationInfo.freeQuota} vagas restantes</strong>). Taxa única de homologação bancária de apenas <strong>R$ {activationInfo.activationFee.toFixed(2).replace('.', ',')}</strong> via Pix.</>
                        ) : (
                          <>Taxa única de ativação bancária de apenas <strong>R$ {activationInfo.activationFee.toFixed(2).replace('.', ',')}</strong> via Pix.</>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-zinc-200 dark:border-zinc-800">
              <form className="space-y-4" onSubmit={handleCadastro}>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo de Perfil</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value as Role)}
                    className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none"
                  >
                    <option value="cliente">Cliente (Pedir Açaí)</option>
                    <option value="loja">Batedeira (Ponto de Venda)</option>
                    <option value="fornecedor">Fornecedor (Vender Fruto)</option>
                    <option value="motorista">Logística (Entregas e Fretes)</option>
                  </select>
                </div>

                {role === 'motorista' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Veículo</label>
                    <select 
                      value={veiculo} 
                      onChange={e => setVeiculo(e.target.value)}
                      className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none"
                    >
                      <option value="Moto">Moto (B2C)</option>
                      <option value="Caminhão">Caminhão (B2B)</option>
                      <option value="Caçamba">Caçamba (Logística Reversa)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome ou Razão Social</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    CPF ou CNPJ do Titular {role !== 'cliente' && <span className="text-purple-600 font-bold">(Chave Pix Obrigatória)</span>}
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={cpfCnpj} 
                    onChange={e => {
                      setCpfCnpj(e.target.value);
                      if (role !== 'cliente') setPixKey(e.target.value.replace(/\D/g, ''));
                    }} 
                    placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                    className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" 
                  />
                  {role !== 'cliente' && (
                    <div className="text-[11px] text-purple-900 dark:text-purple-300 mt-1.5 flex items-start gap-1.5 bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-200 dark:border-purple-800/60 leading-relaxed">
                      <span className="text-base leading-none">🛡️</span>
                      <span><strong>Mesma Titularidade Obrigatória:</strong> Por segurança patrimonial e conformidade bancária (BACEN/Asaas), a conta bancária receptora deve pertencer ao mesmo titular deste CPF/CNPJ. Seus repasses Pix serão creditados exclusivamente para esta chave.</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidade Base</label>
                  <select 
                    value={cidade} 
                    onChange={e => setCidade(e.target.value)}
                    className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none"
                  >
                    {cities.length > 0 ? (
                       cities.filter(c => c.status === 'active').map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                       ))
                    ) : (
                       <option value="Belém">Belém</option>
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Bairro Base</label>
                  <input type="text" required value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Endereço Completo (com número)</label>
                  <input type="text" required value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Ex: Rua das Mangueiras, 123" className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                {(role === 'loja' || role === 'fornecedor') && (
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-900 my-2">
                    <label className="block text-xs uppercase text-purple-800 dark:text-purple-300 font-bold mb-2">📍 Localização de Cadastro</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input 
                          type="radio" 
                          name="loc_mode" 
                          checked={isRegisteringAtStore === true} 
                          onChange={() => setIsRegisteringAtStore(true)} 
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Estou no meu estabelecimento físico agora (capturar GPS)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input 
                          type="radio" 
                          name="loc_mode" 
                          checked={isRegisteringAtStore === false} 
                          onChange={() => setIsRegisteringAtStore(false)} 
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Estou em outro local (definir GPS padrão e ajustar depois)</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Telefone (WhatsApp)</label>
                  <input type="tel" required value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(91) 90000-0000" className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">E-mail</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Senha</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="termos" 
                    required 
                    checked={termosAceitos} 
                    onChange={e => setTermosAceitos(e.target.checked)} 
                    className="mt-1 w-4 h-4 text-purple-600 rounded border-zinc-300 focus:ring-purple-500 cursor-pointer" 
                  />
                  <label htmlFor="termos" className="text-sm text-zinc-600 dark:text-zinc-400">
                    Li e concordo com os <button type="button" onClick={() => setTermosModalOpen(true)} className="text-purple-600 font-bold hover:underline">Termos de Uso e Responsabilidades</button>.
                  </label>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isLocating} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                    {isLocating ? 'Obtendo GPS...' : (role === 'cliente' ? 'Criar Conta e Começar' : 'Criar Conta Parceira')}
                  </button>
                </div>
              </form>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-amber-300 dark:border-amber-700 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition active:scale-95"
                >
                  <BookOpen size={16} />
                  Manual de Uso &amp; Cadastro
                </button>
              </div>
            </div>
            {/* Remover link voltar loja pois a loja agora é privada */}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-zinc-900 w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-800 to-indigo-800 p-6 text-white text-center shrink-0">
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black">
                {isPaymentConfirmed ? '🎉 Conta Ativada com Sucesso!' : '🔒 Quase Pronto: Ativação Parceiro'}
              </h3>
              <p className="text-purple-100 text-xs mt-1">
                {isPaymentConfirmed ? 'Homologação bancária garantida' : 'Homologação Asaas & Split Automático'}
              </p>
            </div>
            
            <div className="p-6 text-center space-y-4">
              
              {/* CASO 1: Parceiro Fundador ou Pix Confirmado */}
              {isPaymentConfirmed ? (
                <>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-left space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                      <CheckCircle2 size={20} className="text-emerald-600" />
                      {pixData?.isFreeGranted ? 'Vaga Fundador Garantida (100% Grátis)' : 'Taxa de Ativação Paga com Sucesso!'}
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Sua conta já está cadastrada e liberada. Para sua comodidade e segurança, sua subconta bancária no Asaas será conectada automaticamente assim que você aceitar a sua <strong>1ª corrida ou concluir sua 1ª venda</strong>.
                    </p>
                  </div>

                  <div className="text-left space-y-2.5">
                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-lg">💰</span>
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Split Automático Ativo</p>
                        <p className="text-[11px] text-zinc-500">Receba seus repasses diretamente na sua chave Pix</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-lg">🛡️</span>
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Homologação Asaas Sob Demanda</p>
                        <p className="text-[11px] text-zinc-500">Subconta gerada automaticamente na sua primeira operação real</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleGoToPartnerPanel}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl transition shadow-lg flex justify-center items-center gap-2 active:scale-95 text-sm"
                  >
                    🚀 Acessar Meu Painel Parceiro <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                /* CASO 2: Exige Pagamento Pix de R$ 12,90 */
                <>
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 text-left space-y-1">
                    <p className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Clock size={16} className="text-purple-600" />
                      Taxa Única de Homologação Asaas
                    </p>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      Para liberar sua conta de recebimentos e gerar sua subconta bancária na sua 1ª operação, realize o pagamento via Pix:
                    </p>
                    <p className="text-lg font-black text-purple-900 dark:text-purple-100 mt-2">
                      R$ {activationInfo.activationFee.toFixed(2).replace('.', ',')}
                    </p>
                  </div>

                  {/* QR CODE DISPLAY */}
                  {pixData?.pixQrCode ? (
                    <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-inner">
                      <img 
                        src={`data:image/png;base64,${pixData.pixQrCode}`} 
                        alt="QR Code Pix Ativação" 
                        className="w-48 h-48 rounded-lg object-contain"
                      />
                      <span className="text-[10px] text-zinc-400 mt-2 font-mono">Escaneie no app do seu banco</span>
                    </div>
                  ) : (
                    <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex flex-col items-center">
                      <QrCode size={48} className="text-zinc-400 mb-2" />
                      <p className="text-xs text-zinc-500">Gerando QR Code Pix...</p>
                    </div>
                  )}

                  {/* Copia e Cola */}
                  {pixData?.pixCopiaECola && (
                    <div className="space-y-1 text-left">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Pix Copia e Cola:</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={pixData.pixCopiaECola} 
                          className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono p-2.5 rounded-xl w-full text-zinc-700 dark:text-zinc-300 select-all"
                        />
                        <button
                          type="button"
                          onClick={handleCopyPix}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2.5 rounded-xl text-xs shrink-0 flex items-center gap-1 shadow transition active:scale-95"
                        >
                          <Copy size={14} />
                          {copiedPix ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button 
                      onClick={() => checkPixStatus(false)}
                      disabled={isCheckingPayment}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl transition shadow-lg flex justify-center items-center gap-2 active:scale-95 text-sm disabled:opacity-50"
                    >
                      {isCheckingPayment ? '⏳ Verificando no Asaas...' : '✅ Já Paguei o Pix'}
                    </button>
                  </div>
                </>
              )}
              
              <p className="text-[11px] text-zinc-400">
                Seus dados e pagamentos são protegidos pela infraestrutura bancária Asaas.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {termosModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-zinc-800 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">📜 Termos de Uso e Responsabilidade</h3>
                <button type="button" onClick={() => setTermosModalOpen(false)} className="text-zinc-400 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <h4 className="font-bold text-zinc-800 dark:text-white mb-4 text-lg border-b border-zinc-200 dark:border-zinc-800 pb-2">
                Para o Perfil: <span className="capitalize text-purple-600">{role}</span>
              </h4>
              {getTermosText()}
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setTermosModalOpen(false)} className="px-5 py-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition">Fechar</button>
                <button type="button" onClick={() => { setTermosAceitos(true); setTermosModalOpen(false); }} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition shadow-sm">Li e Concordo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<div className="text-center">Carregando...</div>}>
        <CadastroForm />
      </Suspense>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-8">
        AçaíFood © 2026 • Tecnologia, Logística e Sustentabilidade da Cadeia do Açaí.
      </p>
    </div>
  );
}
