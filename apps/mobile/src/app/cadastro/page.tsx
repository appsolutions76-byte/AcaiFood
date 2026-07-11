"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, Role, User } from "@/store/useAppStore";
import { ArrowLeft, UserPlus, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams?.get('role') || 'cliente';
  
  const registerUser = useAppStore(state => state.registerUser);
  const authorizeMercadoPago = useAppStore(state => state.authorizeMercadoPago);
  const cities = useAppStore(state => state.cities);
  const fetchCities = useAppStore(state => state.fetchCities);
  
  React.useEffect(() => {
    fetchCities();
  }, [fetchCities]);
  
  const [role, setRole] = useState<Role>(defaultRole as Role);
  const [veiculo, setVeiculo] = useState("Moto"); // Para motoristas
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("Belém");
  const [bairro, setBairro] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [termosModalOpen, setTermosModalOpen] = useState(false);
  
  const [step, setStep] = useState(1); // 1 = Formulario, 2 = Mercado Pago (apenas parceiros)
  const [newUserId, setNewUserId] = useState("");

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termosAceitos) {
      alert("Você deve ler e aceitar os Termos de Uso para continuar.");
      return;
    }
    
    let icon = '👤';
    if (role === 'loja') icon = '🏪';
    if (role === 'fornecedor') icon = '👨🌾';
    if (role === 'motorista' && veiculo === 'Moto') icon = '🛵';
    if (role === 'motorista' && veiculo === 'Caminhão') icon = '🚚';
    if (role === 'motorista' && veiculo === 'Caçamba') icon = '🚛';

    setIsLocating(true);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
      });
      
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const data: Partial<User> = {
        role, name, email, password, telefone, endereco, cidade, bairro, icon, lat, lng
      };
      
      if (role === 'motorista') {
        data.veiculo = veiculo;
        data.pixKey = pixKey;
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
          setStep(2); // Vai para o passo de MP
        }
      } else {
        alert("Erro ao criar conta.");
      }
    } catch (err) {
      setIsLocating(false);
      alert("Precisamos da sua localização para o cálculo correto dos fretes. Por favor, ative e permita o acesso ao GPS no seu dispositivo e tente novamente.");
    }
  };

  const handleAuthorizeMP = () => {
    const mockToken = `APP_USR-${Math.random().toString(36).substring(2, 15)}`;
    authorizeMercadoPago(newUserId, mockToken);
    
    // Redireciona
    if (role === 'loja') router.push('/parceiros/batedeira');
    if (role === 'fornecedor') router.push('/parceiros/fornecedor');
    if (role === 'motorista' && (veiculo === 'Caminhão' || veiculo === 'Caçamba')) router.push('/parceiros/caminhao');
    if (role === 'motorista' && veiculo === 'Moto') router.push('/parceiros/motoboy');
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
      {step === 1 && (
        <>
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="text-center text-3xl font-extrabold text-zinc-900 dark:text-white">
              Crie sua Conta
            </h2>
            <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Ou <Link href="/login" className="font-medium text-purple-600 hover:text-purple-500">faça login se já for cadastrado</Link>
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
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
                  <>
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
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Chave PIX (Para receber os fretes)</label>
                      <input type="text" required value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Celular, CPF, E-mail ou Aleatória" className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome ou Razão Social</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
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
            </div>
            {/* Remover link voltar loja pois a loja agora é privada */}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-zinc-900 w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800">
            <div className="bg-blue-600 p-6 text-white text-center shrink-0">
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold">Conectar Mercado Pago</h3>
              <p className="text-blue-100 text-sm mt-1">Garantia do Triplo Split</p>
            </div>
            
            <div className="p-6 text-center">
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Sua conta foi criada! Agora você precisa vincular sua conta bancária. 
                Isso garante que sua comissão caia direto na sua conta instantaneamente a cada venda!
              </p>
              
              <button 
                onClick={handleAuthorizeMP}
                className="w-full bg-[#009EE3] hover:bg-[#008ACB] text-white font-bold py-4 rounded-xl transition shadow-lg flex justify-center items-center gap-2 mb-3 active:scale-95"
              >
                Autorizar com Mercado Pago
              </button>
              
              <p className="text-xs text-zinc-400 mt-4">
                No ambiente de simulação, clicar neste botão aprova imediatamente e o redireciona.
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
    </div>
  );
}
