"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, Role } from "@/store/useAppStore";
import { ArrowLeft, UserPlus, ShieldCheck } from "lucide-react";

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams?.get('role') || 'cliente';
  
  const registerUser = useAppStore(state => state.registerUser);
  const authorizeMercadoPago = useAppStore(state => state.authorizeMercadoPago);
  
  const [role, setRole] = useState<Role>(defaultRole as Role);
  const [veiculo, setVeiculo] = useState("Moto"); // Para motoristas
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cidade, setCidade] = useState("Belém");
  const [bairro, setBairro] = useState("");
  
  const [step, setStep] = useState(1); // 1 = Formulario, 2 = Mercado Pago (apenas parceiros)
  const [newUserId, setNewUserId] = useState("");

  const handleCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    
    let icon = '👤';
    if (role === 'loja') icon = '🏪';
    if (role === 'fornecedor') icon = '👨🌾';
    if (role === 'motorista' && veiculo === 'Moto') icon = '🛵';
    if (role === 'motorista' && veiculo === 'Caminhão') icon = '🚚';
    if (role === 'motorista' && veiculo === 'Caçamba') icon = '🚛';

    // Mock das coordenadas (baseado no bairro, no mundo real pegaria GPS)
    const lat = -1.45 + (Math.random() * 0.05 - 0.025);
    const lng = -48.48 + (Math.random() * 0.05 - 0.025);

    const data: any = {
      role, name, email, password, cidade, bairro, icon, lat, lng
    };
    
    if (role === 'motorista') data.veiculo = veiculo;
    if (role === 'loja') {
      data.priceB2C = { popular: 18, medio: 25, grosso: 33 };
      data.freteSubsidyPct = 0;
    }
    if (role === 'fornecedor') {
      data.priceB2B = 140;
      data.freteSubsidyPct = 0;
    }

    const newUser = registerUser(data);
    
    if (role === 'cliente') {
      router.push('/');
    } else {
      setNewUserId(newUser.id);
      setStep(2); // Vai para o passo de MP
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
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidade Base</label>
                  <select 
                    value={cidade} 
                    onChange={e => setCidade(e.target.value)}
                    className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none"
                  >
                    <option value="Belém">Belém</option>
                    <option value="Ananindeua">Ananindeua</option>
                    <option value="Marituba">Marituba</option>
                    <option value="Castanhal">Castanhal</option>
                    <option value="Benevides">Benevides</option>
                    <option value="Santa Bárbara do Pará">Santa Bárbara do Pará</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Bairro Base</label>
                  <input type="text" required value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">E-mail</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Senha</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none" />
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition active:scale-95">
                    {role === 'cliente' ? 'Criar Conta e Começar' : 'Criar Conta Parceira'}
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
    </>
  );
}

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="text-center">Carregando...</div>}>
        <CadastroForm />
      </Suspense>
    </div>
  );
}
