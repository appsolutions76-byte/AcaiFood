'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, ShieldCheck, KeyRound, QrCode, RefreshCw, LogOut } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface AdminMfaGuardProps {
  children: React.ReactNode;
}

export function AdminMfaGuard({ children }: AdminMfaGuardProps) {
  const currentUser = useAppStore((state: any) => state.currentUser);
  const logout = useAppStore((state: any) => state.logout);

  const [isLoading, setIsLoading] = useState(true);
  const [needsMfaSetup, setNeedsMfaSetup] = useState(false);
  const [needsMfaChallenge, setNeedsMfaChallenge] = useState(false);
  const [factorId, setFactorId] = useState<string>('');
  const [qrCodeUri, setQrCodeUri] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authCheckState, setAuthCheckState] = useState<{
    status: 'ok' | 'wrong_account' | 'unauthenticated';
    userEmail?: string;
    role?: string;
  }>({ status: 'ok' });

  const checkMfaStatus = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Checar se a sessão ativa no Supabase Auth é de fato Administrador
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthCheckState({ status: 'unauthenticated' });
        setIsLoading(false);
        return;
      }

      const userEmail = String(user.email || '').toLowerCase().trim();
      const isOfficialAdminEmail = userEmail === 'appsolutions76@gmail.com';

      let userRole = '';
      let isDbAdmin = isOfficialAdminEmail;

      // Buscar perfil via RPC get_my_profile_json (Security Definer oficial do R16)
      try {
        const { data: myProfile } = await supabase.rpc('get_my_profile_json');
        if (myProfile) {
          const rawRole = String(myProfile.role || '').toLowerCase();
          userRole = myProfile.role || '';
          if (rawRole === 'admin' || rawRole === 'administrador' || myProfile.is_admin === true) {
            isDbAdmin = true;
          }
        }
      } catch (_rpcErr) {
        console.warn("Aviso ao ler perfil via get_my_profile_json:", _rpcErr);
      }

      // Fallback: consulta direta sem a coluna 'email' (que é restrita por RLS R16)
      if (!isDbAdmin) {
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('id, name, role, is_admin')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            const rawRole = String(profile.role || '').toLowerCase();
            userRole = userRole || profile.role || '';
            if (rawRole === 'admin' || rawRole === 'administrador' || profile.is_admin === true) {
              isDbAdmin = true;
            }
          }
        } catch (_dbErr) {
          console.warn("Aviso ao ler perfil na tabela users:", _dbErr);
        }
      }

      if (!isDbAdmin) {
        setAuthCheckState({
          status: 'wrong_account',
          userEmail: user.email || 'Usuário Parceiro',
          role: userRole || 'Parceiro'
        });
        setIsLoading(false);
        return;
      }

      setAuthCheckState({ status: 'ok' });

      // 2. Com a sessão de admin confirmada, checar MFA (TOTP)
      const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) {
        setIsLoading(false);
        return;
      }

      const { data: factorsData, error: facErr } = await supabase.auth.mfa.listFactors();
      if (facErr) {
        setIsLoading(false);
        return;
      }

      const totpFactors = factorsData?.totp || [];
      const verifiedFactor = totpFactors.find(f => f.status === 'verified');

      if (!verifiedFactor) {
        // Não tem fator TOTP verificado -> Exige cadastro de MFA
        setNeedsMfaSetup(true);
        setNeedsMfaChallenge(false);

        // Criar ou obter fator não verificado
        const enrollRes = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'AcaiFood Admin' });
        if (enrollRes.data) {
          setFactorId(enrollRes.data.id);
          setQrCodeUri(enrollRes.data.totp.qr_code);
          setTotpSecret(enrollRes.data.totp.secret);
        }
      } else {
        // Tem TOTP verificado. Checar se o nível atual é aal2
        if (aalData.currentLevel === 'aal2') {
          setNeedsMfaSetup(false);
          setNeedsMfaChallenge(false);
        } else {
          // Está em aal1 -> Exige desafio
          setFactorId(verifiedFactor.id);
          setNeedsMfaChallenge(true);
          setNeedsMfaSetup(false);
        }
      }
    } catch (_err) {
      console.warn("Aviso ao checar MFA:", _err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkMfaStatus();
  }, [currentUser?.id, currentUser?.role]);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode || verifyCode.length < 6 || !factorId) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      if (needsMfaSetup) {
        const { data, error } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: verifyCode.trim()
        });

        if (error) {
          setErrorMsg(error.message || 'Código de 6 dígitos inválido. Tente novamente.');
        } else if (data) {
          setNeedsMfaSetup(false);
          setNeedsMfaChallenge(false);
        }
      } else if (needsMfaChallenge) {
        const challengeRes = await supabase.auth.mfa.challenge({ factorId });
        if (challengeRes.error) {
          setErrorMsg(challengeRes.error.message || 'Erro ao emitir desafio MFA.');
          setIsVerifying(false);
          return;
        }

        const verifyRes = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeRes.data.id,
          code: verifyCode.trim()
        });

        if (verifyRes.error) {
          setErrorMsg(verifyRes.error.message || 'Código de verificação incorreto.');
        } else {
          setNeedsMfaChallenge(false);
          setNeedsMfaSetup(false);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar segundo fator');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Verificando segurança MFA de Administrador...</p>
      </div>
    );
  }

  if (authCheckState.status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-zinc-900 border border-purple-800/60 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto">
            <KeyRound size={32} />
          </div>
          <h2 className="text-xl font-black text-white">Sessão Administrativa Expirada</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Faça login com a conta de Administrador para gerenciar pedidos, saques e configurações.
          </p>
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <LogOut size={16} /> Fazer Login
          </button>
        </div>
      </div>
    );
  }

  if (authCheckState.status === 'wrong_account') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-zinc-900 border border-amber-600/50 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-white">Acesso Exclusivo para Administrador</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Você está conectado no navegador com a conta:
            <br />
            <strong className="text-amber-300 font-mono text-sm">{authCheckState.userEmail}</strong>
            {authCheckState.role && (
              <span className="block text-[11px] text-zinc-400 mt-1">
                Perfil ativo: <span className="font-bold uppercase text-zinc-200">{authCheckState.role}</span>
              </span>
            )}
          </p>
          <div className="bg-zinc-800/80 p-3.5 rounded-xl text-xs text-zinc-300 border border-zinc-700/80 text-left space-y-1">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <span>💡</span> Por que vejo esta tela?
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Ao testar o app com o perfil do parceiro (ex: Gabriel Lobo) no mesmo navegador, a sessão salva foi a do parceiro. Para aprovar solicitações de saque e ter autorização do Asaas, você deve estar logado com a conta oficial de <strong>Administrador</strong>.
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              logout();
              window.location.href = '/login';
            }}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3.5 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <LogOut size={16} /> Entrar como Administrador
          </button>
        </div>
      </div>
    );
  }

  if (needsMfaSetup || needsMfaChallenge) {
    return (
      <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] overflow-y-auto">
        <div className="bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 my-auto">
          
          <div className="w-14 h-14 bg-purple-100 dark:bg-purple-950/60 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
            <KeyRound size={32} />
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">
              {needsMfaSetup ? 'Configurar Segundo Fator (MFA TOTP)' : 'Autenticação de Segundo Fator'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {needsMfaSetup 
                ? 'Para conformidade bancária e segurança da plataforma, administradores devem ativar MFA via Google Authenticator ou similar.' 
                : 'Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.'}
            </p>
          </div>

          {needsMfaSetup && qrCodeUri && (
            <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col items-center">
              <img src={qrCodeUri} alt="QR Code MFA" className="w-48 h-48 rounded-xl object-contain bg-white p-2" />
              <p className="text-[10px] text-zinc-500 font-mono mt-2 break-all select-all">
                Chave Manual: {totpSecret}
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 font-bold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleVerifyTotp} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Código Autenticador (6 dígitos):
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none focus:border-purple-500 font-black text-zinc-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || verifyCode.length < 6}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl shadow-lg transition active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck size={18} />
              {isVerifying ? 'Validando...' : 'Confirmar e Acessar Painel'}
            </button>
          </form>

          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 flex items-center justify-center gap-1 mx-auto"
          >
            <LogOut size={13} /> Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
