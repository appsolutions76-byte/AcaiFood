import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { generateValidPixPayload } from '@/lib/pix';

// --- UTILITÁRIOS: Haversine e Coordenadas de Belém ---
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isValidAsaasWalletId(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const clean = id.trim();
  if (clean.length < 10) return false;
  if (clean.includes('@') || clean.includes('loja_parceira') || clean.includes('asaas_wallet_') || clean.includes('wallet_master')) return false;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
  const isAsaasId = clean.length >= 20 && !clean.match(/^\d+$/);
  return isUuid || isAsaasId;
}

export function extractStorefront(sfData: any): any {
  if (!sfData) return null;
  if (Array.isArray(sfData)) {
    return sfData.length > 0 ? sfData[sfData.length - 1] : null;
  }
  if (typeof sfData === 'object') {
    return sfData;
  }
  return null;
}

export type Role = 'admin' | 'loja' | 'cliente' | 'motorista' | 'fornecedor' | 'ecoponto';

let lastSweepDate: string = '';

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  bairro?: string;
  icon: string;
  lat?: number;
  lng?: number;
  veiculo?: string;
  priceB2C?: { popular: number; medio: number; grosso: number };
  priceB2B?: number;
  freteSubsidyPct?: number;
  asaasWalletId?: string;
  asaasAccountId?: string;
  asaasLinked?: boolean;
  email?: string;
  cpfCnpj?: string;
  /** Ephemeral field: used only during registration (supabase.auth.signUp). Never persisted to localStorage. */
  password?: string;
  status?: 'active' | 'paused' | 'blocked';
  pixKey?: string;
  products?: Product[];
}

export interface Order {
  id: string;
  type: 'B2C' | 'B2B' | 'COLETA';
  title?: string;
  quantity?: number;
  items?: { id: string; name: string; quantity: number; price: number }[];
  status: 'aguardando_pagamento' | 'pendente' | 'preparo' | 'pronto' | 'em_rota' | 'aguardando_cliente' | 'entregue' | 'arquivado' | 'cancelado';
  criadoPor: string;
  origemId: string;
  destinoId: string;
  clienteId?: string;
  lojaId?: string;
  fornecedorId?: string;
  distancia: number;
  confirmacao: { entregador: boolean; recebedor: boolean };
  motoristaId: string | null;
  valor: number;
  taxas: {
    entregaTotal: number;
    entregaMotorista: number;
    entregaCliente: number;
    entregaLoja: number;
    entregaFornecedor: number;
    plataformaVenda: number;
    plataformaEntrega: number;
    plataformaTotal: number;
    repasse: number;
  };
  createdAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  acceptedAt?: string;
  readyAt?: string;
  receivedAt?: string;
  deliveryPin?: string;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryReference?: string;
  lojaEndereco?: string;
  lojaTelefone?: string;
  payoutSellerDone?: boolean;
  payoutDriverDone?: boolean;
  clienteNome?: string;
  clienteTelefone?: string;
  lojaNome?: string;
  motoristaNome?: string;
  pixQrCode?: string | null;
  pixCopiaECola?: string | null;
  invoiceUrl?: string | null;
  totalValue?: number;
}

export interface CityRates {
  b2c_plat?: number; b2c_km?: number; b2c_mot_plat?: number;
  b2b_plat?: number; b2b_km?: number; b2b_mot_plat?: number;
  col_plat?: number; col_km?: number; col_mot_plat?: number; col_valor?: number;
  payout_time?: string;
  courier_payment_mode?: 'KM' | 'FIXED';
  courier_fixed_fee?: number;
  transporter_payment_mode?: 'KM' | 'FIXED';
  transporter_fixed_fee?: number;
  ecopoint_payment_mode?: 'KM' | 'FIXED';
  ecopoint_fixed_fee?: number;
}

export interface City {
  id: string;
  name: string;
  status: 'active' | 'paused';
  rates?: CityRates;
}

export function getRatesForCity(cityName?: string | null, globalRates?: any, cities?: City[]) {
  if (!cityName || !cities) return globalRates;
  const norm = (str?: string | null) => String(str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const target = norm(cityName);
  const match = cities.find(c => norm(c.name) === target);
  if (match && match.rates && Object.keys(match.rates).length > 0) {
    return { ...globalRates, ...match.rates };
  }
  return globalRates;
}

interface AppState {
  cities: City[];
  rates: {
    b2c_plat: number; b2c_km: number; b2c_mot_plat: number;
    b2b_plat: number; b2b_km: number; b2b_mot_plat: number;
    col_plat: number; col_km: number; col_mot_plat: number; col_valor: number;
    payout_time?: string;
    courier_payment_mode?: 'KM' | 'FIXED';
    courier_fixed_fee?: number;
    transporter_payment_mode?: 'KM' | 'FIXED';
    transporter_fixed_fee?: number;
    ecopoint_payment_mode?: 'KM' | 'FIXED';
    ecopoint_fixed_fee?: number;
  };
  users: Record<string, User>;
  orders: Order[];
  orderCounter: number;
  currentUser: User | null;
  clearPassword?: string;
  cart: {
    storeId: string | null;
    items: { id: string; name: string; quantity: number; price: number }[];
  };
  
  // Ações
  login: (userId: string) => void;
  loginWithCredentials: (email: string, pass: string) => Promise<boolean>;
  registerUser: (data: Omit<User, 'id'>) => Promise<User | null>;
  fetchLojas: (force?: boolean) => Promise<void>;
  logout: () => void;
  linkAsaasAccount: (userId: string, walletId: string) => Promise<void>;
  fetchRates: (force?: boolean) => Promise<void>;
  saveRates: (newRates: Partial<AppState['rates']>) => Promise<void>;
  criarPedido: (tipo: 'B2C' | 'B2B' | 'COLETA', targetId?: string, deliveryInfo?: { address?: string; lat?: number; lng?: number; reference?: string }) => Promise<any>;
  acaoPedido: (orderId: string, action: string, pinStr?: string, reasonStr?: string) => Promise<void>;
  incrementAdminBalances: (order: Order) => Promise<void>;
  setFreteSubsidy: (userId: string, pct: number) => Promise<void>;
  updateUserStatus: (userId: string, status: 'active' | 'paused' | 'blocked') => Promise<void>;
  updateUserLocation: (userId: string, lat: number, lng: number) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  changePassword: (userId: string, newPassword: string) => void;
  updateCpfCnpj: (cpfCnpj: string) => Promise<void>;
  updateUserPrice: (userId: string, b2cPrices?: { popular: number; medio: number; grosso: number }, b2bPrice?: number) => Promise<void>;
  addProduct: (userId: string, product: Product) => Promise<void>;
  removeProduct: (userId: string, productId: string) => Promise<void>;
  fetchOrders: (userId: string, force?: boolean) => Promise<void>;
  fetchAllUsers: (force?: boolean) => Promise<void>;
  setupRealtime: (userId: string) => void;
  clearData: () => Promise<void>;
  setClearPassword: (pwd: string) => void;

  // Cidades
  fetchCities: () => Promise<void>;
  addCity: (name: string) => Promise<void>;
  updateCityStatus: (id: string, status: 'active' | 'paused') => Promise<void>;
  saveCityRates: (cityId: string, cityRates: CityRates) => Promise<void>;
  deleteCity: (id: string) => Promise<void>;
  
  // Auto Refresh
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  
  // Carrinho
  addToCart: (storeId: string, item: { id: string; name: string; price: number; quantity?: number }) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;

  // Realtime
  upsertOrder: (order: Order) => void;
  startRealtime: () => void;
}

// Para manter referência ao channel e evitar duplicatas
let autoRefreshInterval: any = null;
let supabaseChannel: any = null;
let lastFetchAllUsersTime = 0;
let lastFetchLojasTime = 0;
let lastFetchRatesTime = 0;
const lastFetchOrdersTime: Record<string, number> = {};

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

const DB_DEFAULTS = {
  rates: {
    b2c_plat: 10, b2c_km: 2.00, b2c_mot_plat: 10,
    b2b_plat: 10, b2b_km: 4.00, b2b_mot_plat: 10,
    col_plat: 10, col_km: 8.00, col_mot_plat: 10, col_valor: 50.00,
    payout_time: '22:00',
    courier_payment_mode: 'KM' as const,
    courier_fixed_fee: 8.00,
    transporter_payment_mode: 'KM' as const,
    transporter_fixed_fee: 150.00,
    ecopoint_payment_mode: 'KM' as const,
    ecopoint_fixed_fee: 50.00
  },
  cities: [] as City[],
  users: {} // Remover usuários fixos para prevenir vazamento de credenciais
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      cities: DB_DEFAULTS.cities,
      rates: DB_DEFAULTS.rates,
      users: DB_DEFAULTS.users,
      orders: [],
      orderCounter: 1,
      currentUser: null, // Usuário não logado inicialmente
      cart: { storeId: null, items: [] },
      
      login: (userId) => {
        const user = get().users[userId];
        if (user) {
           set({ currentUser: user });
           get().setupRealtime(userId);
           get().fetchRates();
           get().fetchOrders(userId);
           get().startAutoRefresh();
        }
      },

      loginWithCredentials: async (email, pass) => {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error || !authData.user) {
          console.error("Login Error:", error);
          return false;
        }

        const { data: userProfile } = await supabase.from('users').select('*, storefronts(*, products(*))').eq('id', authData.user.id).single();
        if (userProfile) {
          if (userProfile.status === 'blocked') {
            alert('Conta bloqueada pelo administrador.');
            return false;
          }
          
          const appRole = userProfile.role === 'PARTNER' ? 'loja' :
                          userProfile.role === 'SUPPLIER' ? 'fornecedor' :
                          userProfile.role === 'COURIER' ? 'motorista' :
                          userProfile.role === 'ADMIN' ? 'admin' : 'cliente';
          
          const sf = extractStorefront(userProfile.storefronts);

          // Map DB user to AppUser
          const loggedUser: User = {
            id: userProfile.id,
            role: appRole as Role,
            name: sf?.store_name || userProfile.name,
            telefone: userProfile.phone,
            endereco: userProfile.endereco,
            email: userProfile.email,
            cidade: userProfile.cidade,
            bairro: userProfile.bairro,
            lat: userProfile.latitude || 0,
            lng: userProfile.longitude || 0,
            icon: appRole === 'loja' ? '🏪' : appRole === 'fornecedor' ? '🏭' : appRole === 'motorista' ? '🛵' : '👤',
            veiculo: userProfile.vehicle_type === 'MOTO' ? 'Moto' : userProfile.vehicle_type === 'TRUCK' ? 'Caminhão' : userProfile.vehicle_type === 'DUMP_TRUCK' ? 'Caçamba' : undefined,
            status: userProfile.status as 'active'|'paused'|'blocked',
            asaasLinked: !!(userProfile.asaas_wallet_id || userProfile.pix_key),
            asaasWalletId: isValidAsaasWalletId(userProfile.asaas_wallet_id) ? userProfile.asaas_wallet_id : (isValidAsaasWalletId(userProfile.pix_key) ? userProfile.pix_key : undefined),
            priceB2B: sf?.price_b2b ?? undefined,
            priceB2C: sf ? {
                popular: sf.price_b2c_popular ?? 20,
                medio: sf.price_b2c_medio ?? 26,
                grosso: sf.price_b2c_grosso ?? 35
            } : undefined,
            freteSubsidyPct: sf?.frete_subsidy_pct ?? 0,
            pixKey: userProfile.pix_key,
            products: sf?.products || [],
            cpfCnpj: userProfile.cpf_cnpj
          };
          
          set((state) => ({ currentUser: loggedUser, users: { ...state.users, [loggedUser.id]: loggedUser } }));

          // Se for usuário parceiro/motorista legado sem walletId mas com CPF, gera subconta automaticamente em segundo plano
          if ((appRole === 'loja' || appRole === 'fornecedor' || appRole === 'motorista') && !loggedUser.asaasWalletId && loggedUser.cpfCnpj) {
            fetch('/api/asaas/subaccount', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: loggedUser.id,
                name: loggedUser.name,
                email: loggedUser.email,
                cpfCnpj: loggedUser.cpfCnpj,
                phone: loggedUser.telefone,
                endereco: loggedUser.endereco,
                bairro: loggedUser.bairro,
                cidade: loggedUser.cidade,
                role: userProfile.role
              })
            }).then(r => r.json()).then(data => {
              if (data?.walletId && isValidAsaasWalletId(data.walletId)) {
                set(prev => {
                  const u = prev.users[loggedUser.id] || loggedUser;
                  const updated = { ...u, asaasWalletId: data.walletId, asaasLinked: true };
                  return {
                    users: { ...prev.users, [loggedUser.id]: updated },
                    currentUser: prev.currentUser?.id === loggedUser.id ? updated : prev.currentUser
                  };
                });
              }
            }).catch(() => {});
          }

          get().setupRealtime(loggedUser.id);
          get().fetchRates();
          get().fetchOrders(loggedUser.id);
          get().startAutoRefresh();
          return true;
        }

        return false;
      },

      logout: () => {
         get().stopAutoRefresh();
         set({ currentUser: null });
         supabase.removeAllChannels();
      },

      registerUser: async (data) => {
        await supabase.auth.signOut(); // Wipe any stale sessions from localStorage

        const signUpRes = await supabase.auth.signUp({
          email: data.email || '',
          password: data.password || '123456',
        });
        let authData = signUpRes.data;
        const authError = signUpRes.error;

        if (authError) {
          const isAlreadyRegistered = authError.message?.toLowerCase().includes('already registered') || 
                                     authError.message?.toLowerCase().includes('already in use');

          if (isAlreadyRegistered) {
            const { data: signInData } = await supabase.auth.signInWithPassword({
              email: data.email || '',
              password: data.password || '123456',
            });

            if (signInData?.user) {
              const { data: existingProfile } = await supabase.from('users').select('id').eq('id', signInData.user.id).maybeSingle();
              if (!existingProfile) {
                authData = signInData;
              } else {
                alert("Este e-mail já está cadastrado no AçaíFood. Por favor, faça login na tela de login.");
                return null;
              }
            } else {
              alert("Este e-mail já está cadastrado. Por favor, faça login ou tente com outro e-mail.");
              return null;
            }
          } else {
            console.error("Auth Signup Error:", authError);
            alert(`Erro ao registrar: ${authError?.message}`);
            return null;
          }
        }

        if (!authData?.user) {
          alert("Não foi possível gerar a conta. Verifique suas credenciais.");
          return null;
        }

        const newUser: User = { ...data, id: authData.user.id };
        
        // Insert into public.users
        const dbRole = newUser.role === 'loja' ? 'PARTNER' : 
                       newUser.role === 'fornecedor' ? 'SUPPLIER' : 
                       newUser.role === 'motorista' ? 'COURIER' : 'CLIENT';
                       
        const vehicleType = newUser.veiculo === 'Moto' ? 'MOTO' : 
                            newUser.veiculo === 'Caminhão' ? 'TRUCK' : 
                            newUser.veiculo === 'Caçamba' ? 'DUMP_TRUCK' : null;

        const cleanedCpfCnpj = newUser.cpfCnpj ? newUser.cpfCnpj.replace(/\D/g, '') : null;

        const insertPayload: any = {
          id: newUser.id,
          role: dbRole,
          name: newUser.name,
          phone: newUser.telefone,
          endereco: newUser.endereco,
          email: newUser.email,
          cidade: newUser.cidade,
          bairro: newUser.bairro,
          latitude: newUser.lat,
          longitude: newUser.lng,
          vehicle_type: vehicleType,
          pix_key: newUser.pixKey,
          cpf_cnpj: cleanedCpfCnpj,
          status: 'active',
          split_enabled: dbRole !== 'CLIENT'
        };

        let { error: dbError } = await supabase.from('users').insert(insertPayload);

        if (dbError && dbError.message && dbError.message.includes('cpf_cnpj')) {
          console.warn("Coluna cpf_cnpj não encontrada no banco, tentando fallback sem ela...");
          delete insertPayload.cpf_cnpj;
          const retry = await supabase.from('users').insert(insertPayload);
          dbError = retry.error;
        }

        if (dbError) {
          console.error("DB Insert Error:", dbError);
          alert(`Erro ao salvar perfil no banco de dados: ${dbError.message || JSON.stringify(dbError)}`);
          return null;
        }

        // Se for parceiro ou fornecedor, cria vitrine e sub-conta Asaas automaticamente
        if (dbRole === 'PARTNER' || dbRole === 'SUPPLIER') {
            await supabase.from('storefronts').insert({
                partner_id: newUser.id,
                store_name: newUser.name,
                frete_subsidy_pct: newUser.freteSubsidyPct || 0,
                price_b2b: newUser.priceB2B,
                price_b2c_popular: newUser.priceB2C?.popular,
                price_b2c_medio: newUser.priceB2C?.medio,
                price_b2c_grosso: newUser.priceB2C?.grosso
            });

            // Cria sub-conta Asaas automaticamente para receber splits
            try {
              let walletId = '';
              try {
                const { data: asaasData } = await supabase.functions.invoke('asaas-create-subaccount', {
                  body: {
                    userId:   newUser.id,
                    name:     newUser.name,
                    email:    newUser.email,
                    cpfCnpj:  newUser.cpfCnpj,
                    phone:    newUser.telefone,
                    endereco: newUser.endereco,
                    bairro:   newUser.bairro,
                    cidade:   newUser.cidade,
                    role:     dbRole,
                  }
                });
                if (asaasData?.walletId) walletId = asaasData.walletId;
              } catch (e) {
                console.warn('Edge Function asaas-create-subaccount indisponível, usando API nativa:', e);
              }

              // Fallback para API nativa Next.js se a Edge Function não retornou walletId
              if (!walletId && newUser.cpfCnpj) {
                const subHeaders = await getAuthHeaders();
                const subRes = await fetch('/api/asaas/subaccount', {
                  method: 'POST',
                  headers: subHeaders,
                  body: JSON.stringify({
                    userId:   newUser.id,
                    name:     newUser.name,
                    email:    newUser.email,
                    cpfCnpj:  newUser.cpfCnpj,
                    phone:    newUser.telefone,
                    endereco: newUser.endereco,
                    bairro:   newUser.bairro,
                    cidade:   newUser.cidade,
                    role:     dbRole,
                  })
                });
                const subData = await subRes.json();
                if (subData?.walletId) walletId = subData.walletId;
              }

              if (walletId) {
                newUser.asaasWalletId = walletId;
                newUser.asaasLinked = true;
                console.log(`✅ Sub-conta Asaas criada com sucesso! walletId: ${walletId}`);
              }
            } catch (asaasErr) {
              console.warn('Erro ao criar sub-conta Asaas (não bloqueante):', asaasErr);
            }
        }

        // Motoristas também têm conta Asaas para receber repasse de entrega
        if (dbRole === 'COURIER' && newUser.cpfCnpj) {
            try {
              let walletId = '';
              try {
                const { data: asaasData } = await supabase.functions.invoke('asaas-create-subaccount', {
                  body: {
                    userId:   newUser.id,
                    name:     newUser.name,
                    email:    newUser.email,
                    cpfCnpj:  newUser.cpfCnpj,
                    phone:    newUser.telefone,
                    endereco: newUser.endereco || 'Centro',
                    bairro:   newUser.bairro,
                    cidade:   newUser.cidade,
                    role:     dbRole,
                  }
                });
                if (asaasData?.walletId) walletId = asaasData.walletId;
              } catch (_e) {}

              if (!walletId) {
                const subHeaders = await getAuthHeaders();
                const subRes = await fetch('/api/asaas/subaccount', {
                  method: 'POST',
                  headers: subHeaders,
                  body: JSON.stringify({
                    userId:   newUser.id,
                    name:     newUser.name,
                    email:    newUser.email,
                    cpfCnpj:  newUser.cpfCnpj,
                    phone:    newUser.telefone,
                    endereco: newUser.endereco || 'Centro',
                    bairro:   newUser.bairro,
                    cidade:   newUser.cidade,
                    role:     dbRole,
                  })
                });
                const subData = await subRes.json();
                if (subData?.walletId) walletId = subData.walletId;
              }

              if (walletId) {
                newUser.asaasWalletId = walletId;
                newUser.asaasLinked = true;
                console.log(`✅ Sub-conta Asaas criada para motorista! walletId: ${walletId}`);
              }
            } catch (e) {
              console.warn('Erro ao criar sub-conta Asaas para motorista:', e);
            }
        }

        const state = get();
        set({ users: { ...state.users, [newUser.id]: newUser }, currentUser: newUser });
        return newUser;
      },
      
      addToCart: (storeId, item) => {
        set(state => {
          // If trying to add from a different store, clear the cart first
          const currentStoreId = state.cart.storeId;
          const newItems = currentStoreId === storeId ? [...state.cart.items] : [];
          
          const existingItemIndex = newItems.findIndex(i => i.id === item.id);
          if (existingItemIndex >= 0) {
            newItems[existingItemIndex].quantity += (item.quantity || 1);
          } else {
            newItems.push({ ...item, quantity: item.quantity || 1 });
          }
          
          return { cart: { storeId, items: newItems } };
        });
      },
      
      removeFromCart: (itemId) => {
        set(state => ({
          cart: {
            ...state.cart,
            items: state.cart.items.filter(i => i.id !== itemId)
          }
        }));
      },
      
      updateCartQuantity: (itemId, quantity) => {
        set(state => ({
          cart: {
            ...state.cart,
            items: state.cart.items.map(i => i.id === itemId ? { ...i, quantity: Math.max(1, quantity) } : i)
          }
        }));
      },
      
      clearCart: () => {
        set({ cart: { storeId: null, items: [] } });
      },

      upsertOrder: (order) => {
          set(state => {
              const existingIndex = state.orders.findIndex(o => o.id === order.id);
              if (existingIndex >= 0) {
                  const newOrders = [...state.orders];
                  newOrders[existingIndex] = order;
                  return { orders: newOrders };
              } else {
                  return { orders: [order, ...state.orders] };
              }
          });
      },

      startRealtime: () => {
          const currentUser = get().currentUser;
          
          get().fetchRates();
          get().fetchLojas(true);
          get().fetchAllUsers(true);
          if (currentUser) {
              get().fetchOrders(currentUser.id);
          }
          get().startAutoRefresh();

          if (supabaseChannel) {
              supabaseChannel.unsubscribe();
          }

          let channel = supabase.channel('schema-db-changes');

          channel = channel
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'orders' },
                  () => {
                      const u = get().currentUser;
                      if (u) {
                          get().fetchOrders(u.id, true);
                      }
                  }
              )
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'storefronts' },
                  () => {
                      get().fetchLojas(true);
                      get().fetchAllUsers(true);
                  }
              )
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'products' },
                  () => {
                      get().fetchLojas(true);
                      get().fetchAllUsers(true);
                  }
              )
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'users' },
                  () => {
                      get().fetchLojas(true);
                      get().fetchAllUsers(true);
                  }
              )
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'platform_settings' },
                  () => {
                      get().fetchRates();
                  }
              )
              .subscribe();

          supabaseChannel = channel;
      },

      fetchLojas: async (force?: boolean) => {
        const now = Date.now();
        if (!force && now - lastFetchLojasTime < 10000 && Object.keys(get().users || {}).length > 0) {
            return;
        }
        lastFetchLojasTime = now;

        const { data: dbLojas, error } = await supabase
            .from('users')
            .select('*, storefronts(*, products(*))')
            .or('role.eq.PARTNER,role.eq.loja');
            
        if (error) {
            console.error("Erro ao buscar lojas reais:", error);
            return;
        }

        if (dbLojas) {
            set((state) => {
                const newUsers = { ...state.users };
                // Remove deleted lojas
                Object.keys(newUsers).forEach(id => {
                    if (newUsers[id].role === 'loja') delete newUsers[id];
                });
                dbLojas.forEach(dbUser => {
                    const sf = extractStorefront(dbUser.storefronts);
                    newUsers[dbUser.id] = {
                        id: dbUser.id,
                        role: 'loja',
                        name: sf?.store_name || dbUser.name,
                        email: dbUser.email,
                        cidade: dbUser.cidade,
                        bairro: dbUser.bairro,
                        lat: dbUser.latitude || 0,
                        lng: dbUser.longitude || 0,
                        icon: '🏪',
                        status: dbUser.status as 'active',
                        priceB2B: sf?.price_b2b ?? 140,
                        priceB2C: {
                            popular: sf?.price_b2c_popular ?? 20,
                            medio: sf?.price_b2c_medio ?? 26,
                            grosso: sf?.price_b2c_grosso ?? 35
                        },
                        freteSubsidyPct: sf?.frete_subsidy_pct ?? 0,
                        asaasLinked: !!(dbUser.asaas_wallet_id || dbUser.pix_key),
                        asaasWalletId: isValidAsaasWalletId(dbUser.asaas_wallet_id) ? dbUser.asaas_wallet_id : (isValidAsaasWalletId(dbUser.pix_key) ? dbUser.pix_key : undefined),
                        pixKey: dbUser.pix_key,
                        products: sf?.products || [],
                        cpfCnpj: dbUser.cpf_cnpj
                    };
                });
                return { users: newUsers };
            });
        }
      },

      fetchAllUsers: async (force?: boolean) => {
        const now = Date.now();
        if (!force && now - lastFetchAllUsersTime < 12000 && Object.keys(get().users || {}).length > 0) {
            return;
        }
        lastFetchAllUsersTime = now;

        const { data: dbUsers, error } = await supabase
            .from('users')
            .select('*, storefronts(*, products(*))');
            
        if (error) {
            console.error("Erro ao buscar todos os usuários:", error);
            return;
        }

        if (dbUsers) {
            set(() => {
                const newUsers: Record<string, any> = {};
                dbUsers.forEach(dbUser => {
                    const sf = extractStorefront(dbUser.storefronts);
                    const appRole = dbUser.role === 'PARTNER' ? 'loja' :
                                    dbUser.role === 'SUPPLIER' ? 'fornecedor' :
                                    dbUser.role === 'COURIER' ? 'motorista' :
                                    dbUser.role === 'ADMIN' ? 'admin' : 'cliente';
                                    
                    const veiculo = dbUser.vehicle_type === 'MOTO' ? 'Moto' : 
                                    dbUser.vehicle_type === 'TRUCK' ? 'Caminhão' : 
                                    dbUser.vehicle_type === 'DUMP_TRUCK' ? 'Caçamba' : undefined;

                    newUsers[dbUser.id] = {
                        id: dbUser.id,
                        role: appRole as Role,
                        name: sf?.store_name || dbUser.name,
                        email: dbUser.email,
                        telefone: dbUser.telefone || dbUser.phone || '',
                        endereco: dbUser.endereco || dbUser.address || '',
                        cidade: dbUser.cidade,
                        bairro: dbUser.bairro,
                        lat: dbUser.latitude || 0,
                        lng: dbUser.longitude || 0,
                        icon: appRole === 'loja' ? '🏪' : appRole === 'fornecedor' ? '🏭' : appRole === 'motorista' ? '🛵' : '👤',
                        veiculo,
                        status: dbUser.status as 'active'|'paused'|'blocked',
                        priceB2B: sf?.price_b2b ?? 140,
                        priceB2C: {
                            popular: sf?.price_b2c_popular ?? 20,
                            medio: sf?.price_b2c_medio ?? 26,
                            grosso: sf?.price_b2c_grosso ?? 35
                        },
                        freteSubsidyPct: sf?.frete_subsidy_pct ?? 0,
                        asaasLinked: !!(dbUser.asaas_wallet_id || dbUser.pix_key),
                        asaasWalletId: isValidAsaasWalletId(dbUser.asaas_wallet_id) ? dbUser.asaas_wallet_id : (isValidAsaasWalletId(dbUser.pix_key) ? dbUser.pix_key : undefined),
                        pixKey: dbUser.pix_key,
                        products: sf?.products || [],
                        cpfCnpj: dbUser.cpf_cnpj
                    };
                });
                return { users: newUsers };
            });
        }
      },

      linkAsaasAccount: async (userId, walletId) => {
        let isRealWallet = isValidAsaasWalletId(walletId);
        let finalWalletId = walletId;

        let targetUser = get().users[userId];
        if (!targetUser) {
          const { data: dbU } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
          if (dbU) {
            targetUser = {
              id: dbU.id,
              name: dbU.name,
              email: dbU.email,
              cpfCnpj: dbU.cpf_cnpj,
              telefone: dbU.phone,
              endereco: dbU.endereco,
              bairro: dbU.bairro,
              cidade: dbU.cidade,
              role: dbU.role
            } as any;
          }
        }

        // Se a chave informada não for um walletId nativo de subconta do Asaas, gerar subconta oficial no Asaas
        if (!isRealWallet) {
          try {
            const uAny = targetUser as any;
            const cpfCnpjToUse = uAny?.cpfCnpj || uAny?.cpf_cnpj;
            if (cpfCnpjToUse) {
              const subRes = await fetch('/api/asaas/subaccount', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  name: uAny?.name || 'Parceiro AçaíFood',
                  email: uAny?.email || 'parceiro@acaifood.com.br',
                  cpfCnpj: cpfCnpjToUse,
                  phone: uAny?.telefone || uAny?.phone || '',
                  endereco: uAny?.endereco || '',
                  bairro: uAny?.bairro || '',
                  cidade: uAny?.cidade || 'Belém',
                  role: uAny?.role
                })
              });
              if (subRes.ok) {
                const subData = await subRes.json();
                if (subData.walletId) {
                  finalWalletId = subData.walletId;
                  isRealWallet = true;
                }
              }
            }
          } catch (e) {
            console.warn("Erro ao auto-criar subconta Asaas:", e);
          }
        }

        const updatePayload: any = { pix_key: walletId };
        if (isRealWallet && finalWalletId) {
          updatePayload.asaas_wallet_id = finalWalletId;
          updatePayload.split_enabled = true;
        }

        try {
          const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
          if (error) console.error("Erro ao salvar carteira Asaas no banco:", error);
        } catch (e) {
          console.warn("Erro ao atualizar banco Supabase:", e);
        }

        set((state) => {
          const user = state.users[userId] || (state.currentUser?.id === userId ? state.currentUser : null);
          if (!user) return state;
          const updatedUser = { 
            ...user, 
            asaasWalletId: isRealWallet ? finalWalletId : (user.asaasWalletId || finalWalletId), 
            asaasLinked: true, 
            pixKey: walletId 
          };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });
      },

      fetchRates: async (force?: boolean) => {
         const now = Date.now();
         if (!force && now - lastFetchRatesTime < 30000 && get().rates) {
             return;
         }
         lastFetchRatesTime = now;

         try {
           const { data, error } = await supabase.from('platform_settings').select('*').limit(1).maybeSingle();
           if (data && !error) {
               set((state) => ({ rates: { 
                   ...state.rates,
                   id: data.id,
                   b2c_plat: data.b2c_fee_percentage ?? state.rates.b2c_plat,
                   b2c_km: data.motoboy_fee_per_km ?? state.rates.b2c_km,
                   b2c_mot_plat: data.motoboy_platform_fee_percentage ?? state.rates.b2c_mot_plat,
                   b2b_plat: data.b2b_fee_percentage ?? state.rates.b2b_plat,
                   b2b_km: data.truck_fee_per_km ?? state.rates.b2b_km,
                   b2b_mot_plat: data.truck_platform_fee_percentage ?? state.rates.b2b_mot_plat,
                   col_plat: data.col_fee_percentage ?? state.rates.col_plat,
                   col_km: data.col_fee_per_km ?? state.rates.col_km,
                   col_mot_plat: data.col_platform_fee_percentage ?? state.rates.col_mot_plat,
                   col_valor: data.col_fixed_price ?? state.rates.col_valor,
                   payout_time: data.payout_time || state.rates.payout_time || '22:00',
                   courier_payment_mode: data.courier_payment_mode || state.rates.courier_payment_mode || 'KM',
                   courier_fixed_fee: data.courier_fixed_fee ?? state.rates.courier_fixed_fee ?? 8.00,
                   transporter_payment_mode: data.transporter_payment_mode || state.rates.transporter_payment_mode || 'KM',
                   transporter_fixed_fee: data.transporter_fixed_fee ?? state.rates.transporter_fixed_fee ?? 150.00,
                   ecopoint_payment_mode: data.ecopoint_payment_mode || state.rates.ecopoint_payment_mode || 'KM',
                   ecopoint_fixed_fee: data.ecopoint_fixed_fee ?? state.rates.ecopoint_fixed_fee ?? 50.00,
                   asaas_api_key: data.asaas_api_key || (state.rates as any).asaas_api_key || ''
               } }));
           }
         } catch (error) {
           console.error("Error fetching rates:", error);
         }
      },

      saveRates: async (newRates) => {
         const currentRates = get().rates;
         const mergedRates = { ...currentRates, ...newRates };
         
         // Se o modo for Fixo, sincroniza o valor fixo também com a coluna legada de valor/km para garantir persistência mesmo em bancos legados
         if (mergedRates.courier_payment_mode === 'FIXED' && mergedRates.courier_fixed_fee !== undefined) {
           mergedRates.b2c_km = mergedRates.courier_fixed_fee;
         }
         if (mergedRates.transporter_payment_mode === 'FIXED' && mergedRates.transporter_fixed_fee !== undefined) {
           mergedRates.b2b_km = mergedRates.transporter_fixed_fee;
         }
         if (mergedRates.ecopoint_payment_mode === 'FIXED' && mergedRates.ecopoint_fixed_fee !== undefined) {
           mergedRates.col_km = mergedRates.ecopoint_fixed_fee;
         }

         set({ rates: mergedRates });
         
         const dbUpdates: any = {
             b2c_fee_percentage: mergedRates.b2c_plat,
             motoboy_fee_per_km: mergedRates.b2c_km,
             motoboy_platform_fee_percentage: mergedRates.b2c_mot_plat,
             b2b_fee_percentage: mergedRates.b2b_plat,
             truck_fee_per_km: mergedRates.b2b_km,
             truck_platform_fee_percentage: mergedRates.b2b_mot_plat,
             col_fee_percentage: mergedRates.col_plat,
             col_fee_per_km: mergedRates.col_km,
             col_platform_fee_percentage: mergedRates.col_mot_plat,
             col_fixed_price: mergedRates.col_valor,
             payout_time: mergedRates.payout_time,
             courier_payment_mode: mergedRates.courier_payment_mode,
             courier_fixed_fee: mergedRates.courier_fixed_fee,
             transporter_payment_mode: mergedRates.transporter_payment_mode,
             transporter_fixed_fee: mergedRates.transporter_fixed_fee,
             ecopoint_payment_mode: mergedRates.ecopoint_payment_mode,
             ecopoint_fixed_fee: mergedRates.ecopoint_fixed_fee,
             asaas_api_key: (mergedRates as any).asaas_api_key
         };
         
         // Remove undefined values
         Object.keys(dbUpdates).forEach(key => { if ((dbUpdates as any)[key] === undefined) delete (dbUpdates as any)[key]; });

         try {
           const { data: firstRow } = await supabase.from('platform_settings').select('id').limit(1).maybeSingle();
           const targetId = firstRow?.id || (get().rates as any).id;
           
           let saveError: any = null;
           if (targetId) {
             const res = await supabase.from('platform_settings').update(dbUpdates).eq('id', targetId);
             saveError = res.error;
           } else {
             const res = await supabase.from('platform_settings').insert(dbUpdates);
             saveError = res.error;
           }

           if (saveError) {
             console.warn("Aviso ao salvar colunas em platform_settings, tentando fallback base:", saveError);
             const baseUpdates = {
               b2c_fee_percentage: mergedRates.b2c_plat,
               motoboy_fee_per_km: mergedRates.b2c_km,
               motoboy_platform_fee_percentage: mergedRates.b2c_mot_plat,
               b2b_fee_percentage: mergedRates.b2b_plat,
               truck_fee_per_km: mergedRates.b2b_km,
               truck_platform_fee_percentage: mergedRates.b2b_mot_plat,
               col_fee_percentage: mergedRates.col_plat,
               col_fee_per_km: mergedRates.col_km,
               col_platform_fee_percentage: mergedRates.col_mot_plat,
               col_fixed_price: mergedRates.col_valor,
               payout_time: mergedRates.payout_time
             };
             if (targetId) {
               await supabase.from('platform_settings').update(baseUpdates).eq('id', targetId);
             } else {
               await supabase.from('platform_settings').insert(baseUpdates);
             }
           }
         } catch (err) {
           console.error("Exceção ao persistir taxas no Supabase:", err);
         }

         await get().fetchRates();
      },
      
      setFreteSubsidy: async (userId, pct) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const updatedUser = { ...user, freteSubsidyPct: pct };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });
        const { data: sf } = await supabase.from('storefronts').select('id').eq('partner_id', userId).limit(1).maybeSingle();
        if (sf) {
          const { error } = await supabase.from('storefronts').update({ frete_subsidy_pct: pct }).eq('id', sf.id);
          if (error) console.error("Error updating subsidy in DB:", error);
        } else {
          const user = get().users[userId];
          await supabase.from('storefronts').insert({ partner_id: userId, store_name: user?.name || 'Loja', frete_subsidy_pct: pct });
        }
        await get().fetchAllUsers();
      },

      updateCpfCnpj: async (cpfCnpj) => {
        const state = get();
        if (!state.currentUser) return;
        const cleaned = cpfCnpj.replace(/\D/g, '');
        const updatedUser = { ...state.currentUser, cpfCnpj: cleaned };
        set({
          users: { ...state.users, [state.currentUser.id]: updatedUser },
          currentUser: updatedUser
        });
        await supabase.from('users').update({ cpf_cnpj: cleaned }).eq('id', state.currentUser.id);
      },

      updateUserStatus: async (userId, status) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const updatedUser = { ...user, status };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });
        const { error } = await supabase.from('users').update({ status }).eq('id', userId);
        if (error) console.error("Error updating status in DB:", error);
      },

      deleteUser: async (userId) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
           set((state) => {
             const newUsers = { ...state.users };
             delete newUsers[userId];
             return { users: newUsers };
           });
           alert("Usuário de teste local removido do seu aparelho.");
           return;
        }

        try {
          try {
            const subHeaders = await getAuthHeaders();
            await fetch(`/api/asaas/subaccount?userId=${userId}`, { 
              method: 'DELETE',
              headers: subHeaders
            });
          } catch (_e) {
            console.warn("Aviso ao tentar excluir subconta Asaas via API local:", _e);
          }

          // 1. Chamar rota API de servidor com Service Role Key
          const headers = await getAuthHeaders();
          const apiRes = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId })
          });

          if (!apiRes.ok) {
            // Fallback direto via Supabase JS
            const { error: dbDeleteErr } = await supabase.from('users').delete().eq('id', userId);
            if (dbDeleteErr) {
              alert("Erro ao apagar usuário: " + dbDeleteErr.message);
              return;
            }
          }

          set((state) => {
            const newUsers = { ...state.users };
            delete newUsers[userId];
            return { users: newUsers };
          });
          
          alert("Usuário excluído do banco de dados com sucesso!");
          await get().fetchAllUsers(true);
        } catch (error) {
           console.error("Exceção ao excluir usuário:", error);
           alert("Erro de conexão ao tentar excluir usuário.");
        }
      },

      changePassword: async (userId, newPassword) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const updatedUser = { ...user, password: newPassword };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        try {
          if (get().currentUser?.id === userId) {
            await supabase.auth.updateUser({ password: newPassword });
          }
        } catch (err) {
          console.warn("Erro ao atualizar senha no Supabase Auth:", err);
        }
      },

      updateUserLocation: async (userId, lat, lng) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const updatedUser = { ...user, lat, lng };
          const isCurrent = state.currentUser?.id === userId;
          return {
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        try {
          await supabase.from('users').update({ latitude: lat, longitude: lng }).eq('id', userId);
        } catch (err) {
          console.warn("Erro ao atualizar coordenadas no Supabase:", err);
        }
      },

      updateUserPrice: async (userId, b2cPrices, b2bPrice) => {
        set((state) => {
          const user = state.users[userId] || (state.currentUser?.id === userId ? state.currentUser : null);
          if (!user) return state;
          const updatedUser = { ...user };
          if (b2cPrices) updatedUser.priceB2C = { ...(user.priceB2C || {}), ...b2cPrices };
          if (b2bPrice !== undefined) updatedUser.priceB2B = b2bPrice;
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        const updates: any = {};
        if (b2cPrices) {
            if (b2cPrices.popular !== undefined) updates.price_b2c_popular = b2cPrices.popular;
            if (b2cPrices.medio !== undefined) updates.price_b2c_medio = b2cPrices.medio;
            if (b2cPrices.grosso !== undefined) updates.price_b2c_grosso = b2cPrices.grosso;
        }
        if (b2bPrice !== undefined) updates.price_b2b = b2bPrice;

        if (Object.keys(updates).length > 0) {
            try {
              const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', userId);
              if (sfList && sfList.length > 0) {
                  const { error } = await supabase.from('storefronts').update(updates).eq('partner_id', userId);
                  if (error) console.error("Erro ao atualizar preços no Supabase:", error);
              } else {
                  const user = get().users[userId] || get().currentUser;
                  const { error } = await supabase.from('storefronts').insert({
                      partner_id: userId,
                      store_name: user?.name || 'Loja',
                      ...updates
                  });
                  if (error) console.error("Erro ao criar vitrine/preços no Supabase:", error);
              }
            } catch (dbErr) {
              console.error("Exceção ao persistir preços no banco:", dbErr);
            }
            await get().fetchAllUsers(true);
            await get().fetchLojas(true);
        }
      },

      addProduct: async (userId, product) => {
        set((state) => {
          const user = state.users[userId] || (state.currentUser?.id === userId ? state.currentUser : null);
          if (!user) return state;
          const currentProducts = user.products || [];
          const updatedUser = { ...user, products: [...currentProducts, product] };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        // Sync with DB: Buscar ou Criar vitrine
        try {
          let sfId = '';
          const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', userId);
          if (sfList && sfList.length > 0) {
             sfId = sfList[0].id;
          } else {
             const user = get().users[userId] || get().currentUser;
             const { data: newSf, error: sfErr } = await supabase.from('storefronts').insert({
                 partner_id: userId,
                 store_name: user?.name || 'Loja'
             }).select('id').maybeSingle();
             if (newSf) sfId = newSf.id;
             else if (sfErr) console.error("Erro ao criar vitrine para produto:", sfErr);
          }

          if (sfId) {
             const { error: prodErr } = await supabase.from('products').insert({
                id: product.id,
                storefront_id: sfId,
                name: product.name,
                price: product.price
             });
             if (prodErr) console.error("Erro ao inserir produto no Supabase:", prodErr);
          }
        } catch (dbErr) {
          console.error("Exceção ao cadastrar produto no banco:", dbErr);
        }
        await get().fetchAllUsers(true);
        await get().fetchLojas(true);
      },

      removeProduct: async (userId, productId) => {
        set((state) => {
          const user = state.users[userId] || (state.currentUser?.id === userId ? state.currentUser : null);
          if (!user || !user.products) return state;
          const updatedUser = { ...user, products: user.products.filter(p => p.id !== productId) };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        // Sync with DB
        try {
          const { error } = await supabase.from('products').delete().eq('id', productId);
          if (error) console.error("Erro ao remover produto do Supabase:", error);
        } catch (dbErr) {
          console.error("Exceção ao remover produto no banco:", dbErr);
        }
        await get().fetchAllUsers(true);
        await get().fetchLojas(true);
      },

      criarPedido: async (tipo, targetId, deliveryInfo?: { address?: string; lat?: number; lng?: number; reference?: string }) => {
        await get().fetchAllUsers(true);
        const state = get();
        if (!state.currentUser) return;
        const currentUser = state.currentUser;
        
        let originId = currentUser.id;
        let destId = targetId || '';

        if (tipo === 'B2C' || tipo === 'B2B') { originId = targetId || ''; destId = currentUser.id; }
        if (tipo === 'COLETA') { destId = 'ecoponto'; }

        // REVALIDAÇÃO PRÉ-CHECKOUT DIRETA NO SUPABASE (Regras 11 e 12)
        if (tipo === 'B2C' && targetId && state.cart.items.length > 0) {
          try {
            const { data: sfData } = await supabase
              .from('storefronts')
              .select('id, partner_id, price_b2c_popular, price_b2c_medio, price_b2c_grosso, frete_subsidy_pct, products(id, name, price)')
              .or(`id.eq.${targetId},partner_id.eq.${targetId}`)
              .maybeSingle();

            if (sfData) {
              let mismatchFound = false;
              const validatedItems = state.cart.items.map(item => {
                let currentDbPrice = item.price;
                if (item.id === 'popular') currentDbPrice = sfData.price_b2c_popular ?? item.price;
                else if (item.id === 'medio') currentDbPrice = sfData.price_b2c_medio ?? item.price;
                else if (item.id === 'grosso') currentDbPrice = sfData.price_b2c_grosso ?? item.price;
                else {
                  const dbProd = (sfData.products || []).find((p: any) => p.id === item.id);
                  if (dbProd) currentDbPrice = dbProd.price;
                }

                if (currentDbPrice !== item.price) {
                  mismatchFound = true;
                }
                return { ...item, price: currentDbPrice };
              });

              if (mismatchFound) {
                set({ cart: { storeId: targetId, items: validatedItems } });
                alert("⚠️ Atenção: Os preços ou condições de alguns produtos no seu carrinho foram atualizados pela Loja/Batedeira. Atualizamos seu carrinho com os novos valores mais recentes. Por favor, confira o valor total e clique em Finalizar Pedido novamente.");
                return { error: 'Preços atualizados pela loja. Confira seu carrinho antes de pagar.' };
              }
            }
          } catch (valErr) {
            console.warn("Aviso na revalidação pré-checkout:", valErr);
          }
        }

        const p1 = state.users[originId];
        const p2 = state.users[destId];
        
        // Se o cliente forneceu coordenadas dinamicas (GPS ou outro endereco), usa essas coordenadas
        const destLat = deliveryInfo?.lat ?? p2?.lat;
        const destLng = deliveryInfo?.lng ?? p2?.lng;

        const lat1 = Number(p1?.lat || 0);
        const lon1 = Number(p1?.lng || 0);
        const lat2 = Number(destLat || 0);
        const lon2 = Number(destLng || 0);

        const distKM = (lat1 !== 0 && lon1 !== 0 && lat2 !== 0 && lon2 !== 0) 
          ? haversineKm(lat1, lon1, lat2, lon2) 
          : 3.0;

        const userCity = currentUser.cidade || 'Belém';
        const cityRates = getRatesForCity(userCity, state.rates, state.cities);

        const calcFrete = (t: string, d: number) => {
          if (t === 'B2C') {
            return (cityRates.courier_payment_mode === 'FIXED') 
              ? (cityRates.courier_fixed_fee ?? 8.00) 
              : d * cityRates.b2c_km;
          }
          if (t === 'B2B') {
            return (cityRates.transporter_payment_mode === 'FIXED') 
              ? (cityRates.transporter_fixed_fee ?? 150.00) 
              : d * cityRates.b2b_km;
          }
          if (t === 'COLETA') {
            return (cityRates.ecopoint_payment_mode === 'FIXED') 
              ? (cityRates.ecopoint_fixed_fee ?? cityRates.col_valor ?? 50.00) 
              : d * cityRates.col_km;
          }
          return 0;
        };

        const cartItems = state.cart.items;
        if (cartItems.length === 0 && tipo !== 'COLETA') {
            alert('Seu carrinho está vazio.');
            return;
        }

        const valColeta = calcFrete('COLETA', distKM);
        const finalCartItems = tipo === 'COLETA' 
          ? [{ id: 'COLETA', name: 'Serviço de Coleta (Caçamba)', price: valColeta, quantity: 1 }] 
          : cartItems;

        const itemsTotal = finalCartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const totalQuantity = finalCartItems.reduce((acc, item) => acc + item.quantity, 0);

        const novoPedido: Order = {
          id: `PED-${String(state.orderCounter).padStart(3, '0')}`,
          type: tipo,
          status: 'aguardando_pagamento',
          criadoPor: currentUser.id,
          origemId: originId,
          destinoId: destId,
          distancia: distKM,
          clienteId: currentUser.id,
          clienteNome: currentUser.name || 'Cliente AçaíFood',
          clienteTelefone: currentUser.telefone || (currentUser as any).phone || currentUser.email || '',
          confirmacao: { entregador: false, recebedor: false },
          motoristaId: null,
          valor: itemsTotal,
          quantity: totalQuantity,
          items: finalCartItems,
          deliveryAddress: deliveryInfo?.address || currentUser.endereco || (currentUser.bairro ? `${currentUser.bairro}, ${currentUser.cidade || 'Belém'}` : ''),
          deliveryLat: deliveryInfo?.lat,
          deliveryLng: deliveryInfo?.lng,
          deliveryReference: deliveryInfo?.reference || (currentUser as any).referencia || '',
          taxas: { entregaTotal: 0, entregaMotorista: 0, entregaCliente: 0, entregaLoja: 0, entregaFornecedor: 0, plataformaVenda: 0, plataformaEntrega: 0, plataformaTotal: 0, repasse: 0 }
        };

        if (tipo === 'B2C' && targetId) {
          const loja = state.users[targetId];
          const titles = cartItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
          
          novoPedido.title = `${titles} (${loja.name})`;
          novoPedido.clienteId = currentUser.id;
          novoPedido.clienteNome = currentUser.name;
          novoPedido.clienteTelefone = currentUser.telefone;
          novoPedido.destinoId = currentUser.id;

          novoPedido.lojaId = targetId;
          novoPedido.taxas.entregaTotal = calcFrete('B2C', distKM);
          novoPedido.taxas.entregaLoja = novoPedido.taxas.entregaTotal * ((loja.freteSubsidyPct || 0) / 100);
          novoPedido.taxas.entregaCliente = novoPedido.taxas.entregaTotal - novoPedido.taxas.entregaLoja;
          novoPedido.taxas.plataformaEntrega = novoPedido.taxas.entregaTotal * (cityRates.b2c_mot_plat / 100);
          novoPedido.taxas.entregaMotorista = novoPedido.taxas.entregaTotal - novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.plataformaVenda = novoPedido.valor * (cityRates.b2c_plat / 100);
          novoPedido.taxas.plataformaTotal = novoPedido.taxas.plataformaVenda + novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.repasse = novoPedido.valor - novoPedido.taxas.plataformaVenda - novoPedido.taxas.entregaLoja;
        } 
        
        // Simulação rápida para B2B e Coleta
        if (tipo === 'B2B' && targetId) {
            const forn = state.users[targetId];
            const titles = cartItems.map(i => `${i.quantity}x ${i.name}`).join(', ');

            novoPedido.title = `${titles} (${forn.name})`;
            novoPedido.lojaId = currentUser.id;
            novoPedido.fornecedorId = targetId;
            novoPedido.taxas.entregaTotal = calcFrete('B2B', distKM);
            novoPedido.taxas.entregaFornecedor = novoPedido.taxas.entregaTotal * ((forn.freteSubsidyPct || 0) / 100);
            novoPedido.taxas.entregaLoja = novoPedido.taxas.entregaTotal - novoPedido.taxas.entregaFornecedor;
            novoPedido.taxas.plataformaEntrega = novoPedido.taxas.entregaTotal * (cityRates.b2b_mot_plat / 100);
            novoPedido.taxas.entregaMotorista = novoPedido.taxas.entregaTotal - novoPedido.taxas.plataformaEntrega;
            novoPedido.taxas.plataformaVenda = novoPedido.valor * (cityRates.b2b_plat / 100);
            novoPedido.taxas.plataformaTotal = novoPedido.taxas.plataformaVenda + novoPedido.taxas.plataformaEntrega;
            novoPedido.taxas.repasse = novoPedido.valor - novoPedido.taxas.plataformaVenda - novoPedido.taxas.entregaFornecedor;
        }

        if (tipo === 'COLETA') {
          novoPedido.title = `Coleta de Carroço / Resíduos (Caçamba)`;
          novoPedido.lojaId = currentUser.id;
          novoPedido.taxas.entregaTotal = valColeta;
          novoPedido.taxas.entregaLoja = valColeta;
          novoPedido.taxas.plataformaEntrega = valColeta * (cityRates.col_mot_plat / 100);
          novoPedido.taxas.entregaMotorista = valColeta - novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.plataformaVenda = 0;
          novoPedido.taxas.plataformaTotal = novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.repasse = 0;
        }

        // Apenas salva localmente após o sucesso e com o ID real
        
        // 1. Insert into Supabase Orders table
        try {
          let sellerStorefrontId: string | null = null;
          const storeUserTargetId = tipo === 'COLETA' ? currentUser.id : (targetId || currentUser.id);

          if (storeUserTargetId) {
             // 1. Check if storeUserTargetId is already a valid storefront ID
             const { data: sfById } = await supabase.from('storefronts').select('id, partner_id').eq('id', storeUserTargetId).maybeSingle();
             if (sfById) {
                sellerStorefrontId = sfById.id;
             } else {
                // 2. Check if storeUserTargetId is a partner user ID
                const { data: sfByPartner } = await supabase.from('storefronts').select('id, partner_id').eq('partner_id', storeUserTargetId).maybeSingle();
                if (sfByPartner) {
                   sellerStorefrontId = sfByPartner.id;
                } else {
                   // 3. Auto-create storefront row for partner user if missing
                   const targetUserName = state.users[storeUserTargetId]?.name || 'Loja AçaíFood';
                   const { data: newSf } = await supabase.from('storefronts').insert({
                      partner_id: storeUserTargetId,
                      store_name: targetUserName
                   }).select('id').single();
                   if (newSf) sellerStorefrontId = newSf.id;
                }
             }
          }

          const pin = Math.floor(1000 + Math.random() * 9000).toString();
          let dbOrder: any = null;
          try {
            const { data, error: dbError } = await supabase.from('orders').insert({
              buyer_id: currentUser.id,
              seller_storefront_id: sellerStorefrontId,
              order_type: tipo,
              status: 'PENDING',
              products_subtotal: novoPedido.valor,
              delivery_distance_km: novoPedido.distancia || 0,
              applied_platform_fee_percent: tipo === 'B2C' ? state.rates.b2c_plat : (tipo === 'COLETA' ? state.rates.col_plat : state.rates.b2b_plat),
              applied_delivery_fee_per_km: tipo === 'B2C' ? state.rates.b2c_km : (tipo === 'COLETA' ? state.rates.col_km : state.rates.b2b_km),
              applied_delivery_platform_fee_percent: tipo === 'B2C' ? state.rates.b2c_mot_plat : (tipo === 'COLETA' ? state.rates.col_mot_plat : state.rates.b2b_mot_plat),
              delivery_pin: pin,
              delivery_address: deliveryInfo?.address,
              delivery_lat: deliveryInfo?.lat,
              delivery_lng: deliveryInfo?.lng,
              delivery_reference: deliveryInfo?.reference
            }).select().single();

            if (dbError) {
              console.warn("DB error saving order:", dbError);
            } else {
              dbOrder = data;
              // Gravar snapshot imutável de itens do pedido em order_items
              if (novoPedido.items && novoPedido.items.length > 0) {
                const itemsPayload = novoPedido.items.map(it => ({
                  order_id: dbOrder.id,
                  product_id: it.id || null,
                  product_name: it.name || 'Açaí',
                  quantity: it.quantity || 1,
                  unit_price_cents: Math.round((it.price || 0) * 100),
                  total_price_cents: Math.round((it.price || 0) * (it.quantity || 1) * 100)
                }));
                supabase.from('order_items').insert(itemsPayload).then(({ error: itErr }) => {
                  if (itErr) console.warn("Aviso ao salvar order_items:", itErr);
                });
              }

              // Gravar registros de split em centavos na tabela splits
              const splitsPayload: any[] = [];
              if (novoPedido.taxas.repasse > 0 && sellerStorefrontId) {
                splitsPayload.push({
                  order_id: dbOrder.id,
                  recipient_type: tipo === 'B2B' ? 'SUPPLIER' : 'STORE',
                  recipient_id: storeUserTargetId || null,
                  amount_cents: Math.round(novoPedido.taxas.repasse * 100),
                  status: 'PENDING'
                });
              }
              if (novoPedido.taxas.plataformaTotal > 0) {
                splitsPayload.push({
                  order_id: dbOrder.id,
                  recipient_type: 'PLATFORM',
                  amount_cents: Math.round(novoPedido.taxas.plataformaTotal * 100),
                  status: 'PENDING'
                });
              }
              if (splitsPayload.length > 0) {
                supabase.from('splits').insert(splitsPayload).then(({ error: spErr }) => {
                  if (spErr) console.warn("Aviso ao salvar splits:", spErr);
                });
              }
            }
          } catch (err) {
            console.warn("Exception saving order to DB:", err);
          }

          // Security: block checkout if no real DB UUID was returned
          if (!dbOrder?.id) {
            alert('Erro ao registrar pedido no servidor. Tente novamente em alguns segundos.');
            return null;
          }
          const orderIdToUse = dbOrder.id;

          // 2. Processar Pagamento e Split via Asaas em Nome da Plataforma AçaíFood
          let sellerPartnerId = targetId || '';

          // Resolver se targetId for ID do storefront
          if (targetId) {
            const { data: sfData } = await supabase.from('storefronts').select('partner_id').eq('id', targetId).maybeSingle();
            if (sfData && sfData.partner_id) {
              sellerPartnerId = sfData.partner_id;
            }
          }

          const sellerUser = state.users[sellerPartnerId || ''];
          let sellerWalletId = sellerUser?.asaasWalletId;

          // Buscar/Gerar asaas_wallet_id real no Supabase/Asaas se ausente ou inválido (ex: se for CPF/Telefone em vez de UUID)
          if ((!sellerWalletId || !isValidAsaasWalletId(sellerWalletId)) && sellerPartnerId) {
            try {
              const { data: uData } = await supabase.from('users').select('id, name, email, cpf_cnpj, asaas_wallet_id, role, phone, endereco, bairro, cidade').eq('id', sellerPartnerId).maybeSingle();
              if (uData) {
                if (isValidAsaasWalletId(uData.asaas_wallet_id)) {
                  sellerWalletId = uData.asaas_wallet_id;
                } else if (uData.cpf_cnpj) {
                  // Tentar auto-criar subconta no Asaas para o parceiro/batedeira se tiver CPF/CNPJ
                  try {
                    const subHeaders = await getAuthHeaders();
                    const subRes = await fetch('/api/asaas/subaccount', {
                      method: 'POST',
                      headers: subHeaders,
                      body: JSON.stringify({
                        userId: uData.id,
                        name: uData.name || 'Parceiro AçaíFood',
                        email: uData.email || 'parceiro@acaifood.com.br',
                        cpfCnpj: uData.cpf_cnpj,
                        phone: uData.phone,
                        endereco: uData.endereco,
                        bairro: uData.bairro,
                        cidade: uData.cidade,
                        role: uData.role || 'PARTNER'
                      })
                    });
                    if (subRes.ok) {
                      const subData = await subRes.json();
                      if (subData.walletId) sellerWalletId = subData.walletId;
                    }
                  } catch (subErr) {
                    console.warn("Auto subaccount error para loja:", subErr);
                  }
                }
              }
            } catch (err) {
              console.warn("Erro ao resolver carteira Asaas da loja:", err);
            }
          }

          const splitRules: { walletId: string; fixedValue: number }[] = [];

          if (sellerWalletId && isValidAsaasWalletId(sellerWalletId)) {
            splitRules.push({
              walletId: sellerWalletId,
              fixedValue: Number(novoPedido.taxas.repasse.toFixed(2))
            });
          }

          if (novoPedido.motoristaId) {
            let driverWalletId = state.users[novoPedido.motoristaId]?.asaasWalletId;
            if (!driverWalletId || !isValidAsaasWalletId(driverWalletId)) {
              try {
                const { data: dData } = await supabase.from('users').select('id, name, email, cpf_cnpj, asaas_wallet_id, role, phone, endereco, bairro, cidade').eq('id', novoPedido.motoristaId).maybeSingle();
                if (dData) {
                  if (isValidAsaasWalletId(dData.asaas_wallet_id)) {
                    driverWalletId = dData.asaas_wallet_id;
                  } else if (dData.cpf_cnpj) {
                    try {
                      const subHeaders = await getAuthHeaders();
                      const subRes = await fetch('/api/asaas/subaccount', {
                        method: 'POST',
                        headers: subHeaders,
                        body: JSON.stringify({
                          userId: dData.id,
                          name: dData.name || 'Entregador AçaíFood',
                          email: dData.email || 'entregador@acaifood.com.br',
                          cpfCnpj: dData.cpf_cnpj,
                          phone: dData.phone,
                          endereco: dData.endereco,
                          bairro: dData.bairro,
                          cidade: dData.cidade,
                          role: dData.role || 'COURIER'
                        })
                      });
                      if (subRes.ok) {
                        const subData = await subRes.json();
                        if (subData.walletId) driverWalletId = subData.walletId;
                      }
                    } catch (_e) {}
                  }
                }
              } catch(_e) {}
            }
            if (driverWalletId && isValidAsaasWalletId(driverWalletId)) {
              splitRules.push({
                walletId: driverWalletId,
                fixedValue: Number(novoPedido.taxas.entregaMotorista.toFixed(2))
              });
            }
          }

          const totalValue = tipo === 'COLETA' 
            ? Number(valColeta.toFixed(2))
            : (tipo === 'B2C' 
                ? Number((novoPedido.valor + (novoPedido.taxas.entregaCliente || 0)).toFixed(2))
                : Number((novoPedido.valor + (novoPedido.taxas.entregaLoja || 0)).toFixed(2)));

          let userCpfCnpj = currentUser.cpfCnpj || get().users[currentUser.id]?.cpfCnpj;
          if (!userCpfCnpj && currentUser.id) {
            try {
              const { data: dbUser } = await supabase.from('users').select('cpf_cnpj').eq('id', currentUser.id).maybeSingle();
              if (dbUser && dbUser.cpf_cnpj) {
                userCpfCnpj = dbUser.cpf_cnpj;
                const updatedUser = { ...currentUser, cpfCnpj: dbUser.cpf_cnpj };
                set((state) => ({
                  currentUser: updatedUser,
                  users: { ...state.users, [currentUser.id]: updatedUser }
                }));
              }
            } catch (err) {
              console.warn("Erro ao buscar CPF do usuário no banco:", err);
            }
          }

          let asaasResult: any = null;
          let checkoutErrorMsg = '';

          try {
            const { data: sfData, error: sfError } = await supabase.functions.invoke('asaas-checkout', {
              body: {
                orderId: orderIdToUse,
                value: totalValue,
                split: splitRules,
                customerEmail: currentUser.email,
                customerName: currentUser.name,
                customerCpfCnpj: userCpfCnpj
              }
            });

            if (sfData && (sfData.pixQrCode || sfData.pixCopiaECola || sfData.invoiceUrl)) {
              asaasResult = sfData;
            } else if (sfData && sfData.error) {
              checkoutErrorMsg = sfData.error;
            } else if (sfError) {
              checkoutErrorMsg = sfError.message || JSON.stringify(sfError);
            }
          } catch (e: any) {
            console.warn("Edge function asaas-checkout:", e);
          }

          // 2. Fallback para a API Route nativa do Next.js (/api/asaas/checkout)
          if (!asaasResult) {
            try {
              const apiRes = await fetch('/api/asaas/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: orderIdToUse, // usa o ID com fallback seguro (evita crash quando dbOrder é null por erro de RLS)
                  value: totalValue,
                  split: splitRules,
                  customerEmail: currentUser.email,
                  customerName: currentUser.name,
                  customerCpfCnpj: userCpfCnpj
                })
              });

              const apiData = await apiRes.json();
              if (apiRes.ok && apiData && (apiData.pixCopiaECola || apiData.pixQrCode || apiData.invoiceUrl)) {
                asaasResult = apiData;
              } else if (apiData && apiData.error) {
                checkoutErrorMsg = checkoutErrorMsg || apiData.error;
              }
            } catch (err: any) {
              console.warn("Erro ao chamar /api/asaas/checkout:", err);
            }
          }

          // Fallback Pix estático oficial BACEN vinculado à chave da Plataforma
          const platformPixKey = process.env.NEXT_PUBLIC_PLATFORM_PIX_KEY || 'appsolutions76@gmail.com';
          const validPlatformPayload = generateValidPixPayload({
            pixKey: platformPixKey,
            merchantName: 'FREDSON FERNANDO SOARES B',
            merchantCity: 'BELEM',
            amount: totalValue,
            txId: orderIdToUse.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || 'ACAIFOOD'
          });

          // Salva pedido no estado local com dados do Pix anexados
          const finalPedido: Order = { 
            ...novoPedido, 
            id: orderIdToUse, 
            deliveryPin: pin,
            pixQrCode: asaasResult?.pixQrCode || null,
            pixCopiaECola: asaasResult?.pixCopiaECola || validPlatformPayload || null,
            invoiceUrl: asaasResult?.invoiceUrl || null,
            totalValue: totalValue,
            ...(asaasResult?.paymentId ? { asaasPaymentId: asaasResult.paymentId, paymentId: asaasResult.paymentId } : {})
          };

          if (asaasResult?.paymentId) {
            supabase.from('orders').update({ asaas_payment_id: asaasResult.paymentId }).eq('id', orderIdToUse).then(({ error }) => {
              if (error) console.warn("Aviso ao salvar asaas_payment_id no DB:", error);
            });
          }
          set({ 
             orders: [finalPedido, ...get().orders], 
             orderCounter: get().orderCounter + 1,
             cart: { storeId: null, items: [] } // Limpa o carrinho
          });

          // 1. Se o Asaas gerou a cobrança Pix oficial (com Split para batedeira/fornecedor e motorista)
          if (asaasResult && (asaasResult.pixCopiaECola || asaasResult.pixQrCode || asaasResult.invoiceUrl)) {
             return {
                invoiceUrl: asaasResult.invoiceUrl,
                pixQrCode: asaasResult.pixQrCode || null,
                pixCopiaECola: asaasResult.pixCopiaECola || null,
                paymentId: asaasResult.paymentId,
                orderId: orderIdToUse,
                isSandbox: !!asaasResult.isSandbox,
                totalValue: totalValue
             };
          }

          return {
             invoiceUrl: asaasResult?.invoiceUrl || null,
             pixQrCode: null,
             pixCopiaECola: validPlatformPayload,
             paymentId: asaasResult?.paymentId || null,
             orderId: orderIdToUse,
             isSandbox: false,
             totalValue: totalValue,
             error: checkoutErrorMsg || undefined
          };
          
        } catch(e: any) {
            console.error("Fatal exception during checkout:", e);
            alert("Erro fatal ao processar o pagamento: " + (e.message || JSON.stringify(e)));
        }

      },

      acaoPedido: async (orderId, action, pinStr?: string, reasonStr?: string) => {
        const state = get();
        const currentUser = state.currentUser;
        if (!currentUser) return;

        // 1. Validação Segura de PIN via RPC Supabase (Regras Parte B Item 1 & 10)
        if (action === 'validar_pin') {
            const cleanPin = (pinStr || '').trim();
            if (!cleanPin || cleanPin.length !== 4) {
              alert("⚠️ Por favor, digite o PIN de 4 dígitos informado pelo cliente.");
              return;
            }

            try {
              const { data: pinRes, error: pinErr } = await supabase.rpc('check_delivery_pin', {
                p_order_id: orderId,
                p_pin: cleanPin,
                p_operator_id: currentUser.id,
                p_device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'App Client'
              });

              if (pinErr || !pinRes?.success) {
                const errMsg = pinRes?.error || pinErr?.message || 'PIN de segurança inválido.';
                alert(`❌ ${errMsg}`);
                await get().fetchOrders(currentUser.id, true);
                return;
              }
            } catch (err: any) {
              console.error("Erro ao validar PIN no servidor:", err);
              alert("Erro de conexão ao validar o PIN de segurança.");
              return;
            }
        }

        // 2. Aceitação Atômica Condicional de Corrida pelo Operador (Regras Parte B Item 2)
        if (action === 'aceitar_motorista') {
            try {
              const { data: acceptRes, error: acceptErr } = await supabase.rpc('accept_order_atomic', {
                p_order_id: orderId,
                p_operator_id: currentUser.id
              });

              if (acceptErr || !acceptRes?.success) {
                const errMsg = acceptRes?.error || acceptErr?.message || 'Este pedido já foi aceito por outro operador.';
                alert(`⚠️ ${errMsg}`);
                await get().fetchOrders(currentUser.id, true);
                return;
              }
            } catch (err: any) {
              console.error("Erro ao aceitar corrida via escrita atômica:", err);
              alert("Erro de conexão ao aceitar a corrida.");
              return;
            }
        }

        if (action === 'pagar_motorista') {
             const motoristaId = orderId; // Usando orderId como userId neste caso específico
             set((state) => {
                 const newOrders = state.orders.map(o => {
                     if (o.motoristaId === motoristaId && o.status === 'entregue') {
                         return { ...o, status: 'arquivado' as any };
                     }
                     return o;
                 });
                 return { orders: newOrders };
             });
             
             // Atualizar no banco
             const { error } = await supabase.from('orders')
                 .update({ status: 'COMPLETED' })
                 .eq('driver_id', motoristaId)
                 .eq('status', 'RECEIVED');
                 
             if (error) console.error("Error paying motorista:", error);
             return;
        }

        if (action === 'deletar_pedido') {
            const { error } = await supabase.from('orders').update({ is_hidden: true }).eq('id', orderId);
            if (!error) {
                set((state) => ({ orders: state.orders.filter(o => o.id !== orderId) }));
            } else {
                console.error("Error hiding order:", error);
                alert("Erro ao remover pedido do histórico.");
            }
            return;
        }

        let newDbStatus = '';
        let driverId = null;

        set((state) => {
          const newOrders = state.orders.map(o => {
            if (o.id !== orderId) return o;
            const newOrder = { ...o };
            if (action === 'cancelar_pedido' || action === 'cancelar_cliente' || action === 'recusar_loja' || action === 'recusar_forn' || action === 'recusar_fornecedor' || action === 'cancelar_loja' || action === 'cancelar_fornecedor') { newOrder.status = 'cancelado'; newDbStatus = 'CANCELLED'; }
            if (action === 'confirmar_pagamento' || action === 'pagar') { 
              newOrder.status = o.type === 'COLETA' ? 'pronto' : 'pendente'; 
              newDbStatus = o.type === 'COLETA' ? 'READY' : 'PAID'; 
            }
            if (action === 'aceitar_loja' || action === 'aceitar_forn') { newOrder.status = 'preparo'; newDbStatus = 'PREPARING'; }
            if (action === 'chamar_moto' || action === 'chamar_caminhao') { newOrder.status = 'pronto'; newDbStatus = 'READY'; }
            if (action === 'aceitar_motorista') { newOrder.status = 'em_rota'; newOrder.motoristaId = state.currentUser?.id || null; newOrder.pickedUpAt = undefined; newDbStatus = 'DELIVERING'; driverId = newOrder.motoristaId; }
            if (action === 'retirar_pedido') {
              newOrder.pickedUpAt = new Date().toISOString();
              newDbStatus = 'DELIVERING';
            }
            if (action === 'conf_motorista') {
              newOrder.status = 'aguardando_cliente';
              newDbStatus = 'DELIVERED';
            }
            if (action === 'conf_recebedor' || action === 'validar_pin') {
              newOrder.status = 'entregue';
              newDbStatus = 'RECEIVED';
            }
            // forcar_baixa restricted to admin only
            if (action === 'forcar_baixa') {
              const isAdminUser = state.currentUser?.role === 'admin';
              if (!isAdminUser) {
                console.warn('Security: forcar_baixa rejected — not an admin');
                return o; // Reject non-admin force close
              }
              newOrder.status = 'entregue';
              newDbStatus = 'RECEIVED';
            }
            return newOrder;
          });
          return { orders: newOrders };
        });

        // Impressão Automática em transições de status para a Loja/Batedeira (se configurado como 'auto')
        if (action === 'aceitar_loja' || action === 'chamar_moto') {
          try {
            const { getPrinterConfig, printOrderTicket } = await import('@/lib/thermalPrinter');
            const pConfig = getPrinterConfig();
            if (pConfig.enabled && pConfig.printMode === 'auto') {
              const targetOrder = get().orders.find(o => o.id === orderId);
              if (targetOrder && targetOrder.type === 'B2C') {
                const pType = action === 'aceitar_loja' ? 'PREPARO' : 'ENTREGA';
                printOrderTicket(targetOrder, targetOrder.lojaNome || 'Loja/Batedeira', pConfig, get().users, null, pType, 'SYSTEM');
              }
            }
          } catch (pErr) {
            console.warn("Aviso ao disparar impressão automática:", pErr);
          }
        }

        const updates: any = {};
        if (newDbStatus) updates.status = newDbStatus;
        if (driverId) updates.driver_id = driverId;
        if (action === 'aceitar_loja' || action === 'aceitar_forn') updates.accepted_at = new Date().toISOString();
        if (action === 'chamar_moto' || action === 'chamar_caminhao') updates.ready_at = new Date().toISOString();
        if (action === 'retirar_pedido') updates.picked_up_at = new Date().toISOString();
        if (action === 'conf_motorista') updates.delivered_at = new Date().toISOString();
        if (action === 'conf_recebedor' || action === 'validar_pin' || action === 'forcar_baixa') updates.received_at = new Date().toISOString();

        if (newDbStatus === 'CANCELLED') {
          updates.cancellation_reason = reasonStr || 'Cancelamento solicitado pelo usuário antes da validação por PIN';
          updates.cancelled_at = new Date().toISOString();
          updates.cancelled_by = currentUser.id;
        }

         if (Object.keys(updates).length > 0) {
            if (action === 'validar_pin') updates.provided_pin = pinStr;
            
            if (newDbStatus && action !== 'validar_pin' && action !== 'aceitar_motorista') {
              supabase.rpc('transition_order_status', {
                p_order_id: orderId,
                p_to_status: newDbStatus,
                p_actor_id: currentUser.id,
                p_actor_role: currentUser.role ? String(currentUser.role).toUpperCase() : 'USER',
                p_reason: reasonStr || 'Transição efetuada pelo app'
              }).then(async ({ data: trData, error: trErr }) => {
                if (trErr || (trData && !trData.success)) {
                  console.warn("RPC transition notice:", trErr || trData?.error);
                  await supabase.from('orders').update(updates).eq('id', orderId);
                }
                get().fetchOrders(currentUser.id, true);
              });
            } else {
              supabase.from('orders').update(updates).eq('id', orderId).then(() => {
                get().fetchOrders(currentUser.id, true);
              });
            }

            if (action === 'conf_recebedor' || action === 'validar_pin' || action === 'forcar_baixa') {
               const currentOrder = get().orders.find(o => o.id === orderId) || state.orders.find(o => o.id === orderId);
               if (currentOrder) {
                 get().incrementAdminBalances(currentOrder);
                 // Repasses são efetuados de forma atômica e segura pelo backend (Edge Function payout-sweep)
               }
            }
         }

        if (newDbStatus === 'CANCELLED') {
           try {
              const targetOrder = state.orders.find(o => o.id === orderId);
              const paymentIdToUse = (targetOrder as any)?.paymentId || (targetOrder as any)?.asaasPaymentId || (targetOrder as any)?.asaas_payment_id;
              getAuthHeaders().then(authHeaders => {
                fetch('/api/asaas/refund', {
                  method: 'POST',
                  headers: authHeaders,
                  body: JSON.stringify({ 
                    orderId: orderId,
                    paymentId: paymentIdToUse,
                    reason: reasonStr || 'Cancelamento solicitado pelo usuário antes do PIN'
                  })
                }).then(r => r.json()).then(data => {
                  if (data.success) console.log("✅ Estorno Asaas efetuado com sucesso:", data);
                  else console.warn("Aviso no estorno Asaas:", data);
                }).catch(e => console.warn("Erro ao solicitar estorno Asaas:", e));
              });
           } catch(e) {
              console.error("Exceção ao solicitar estorno:", e);
            }
         }
      },

      incrementAdminBalances: async (order) => {
        if (!order) return;
        const volume = (order.valor || 0) + (order.taxas?.entregaTotal || 0);
        const appRev = order.taxas?.plataformaTotal || 0;

        let fornBruto = 0, fornLiq = 0;
        let batBruto = 0, batLiq = 0;
        let motBruto = 0, motLiq = 0;
        let camBruto = 0, camLiq = 0;

        if (order.type === 'B2B') {
          fornBruto = order.valor || 0;
          fornLiq = order.taxas?.repasse || 0;
          camBruto = order.taxas?.entregaTotal || 0;
          camLiq = order.taxas?.entregaMotorista || 0;
        } else if (order.type === 'B2C') {
          batBruto = order.valor || 0;
          batLiq = order.taxas?.repasse || 0;
          motBruto = order.taxas?.entregaTotal || 0;
          motLiq = order.taxas?.entregaMotorista || 0;
        } else if (order.type === 'COLETA') {
          motBruto = order.taxas?.entregaTotal || 0;
          motLiq = order.taxas?.entregaMotorista || 0;
        }

        const ids = ['historical', 'monthly', 'daily'];

        for (const id of ids) {
          try {
            const { data, error } = await supabase.from('admin_balances').select('*').eq('id', id).maybeSingle();
            
            if (error) {
              console.warn("Aviso ao buscar admin_balances para " + id + ":", error);
            }

            const currentOrders = Number(data?.total_orders || 0);
            const currentVolume = Number(data?.total_volume || 0);
            const currentAppRev = Number(data?.app_revenue || 0);
            const currentFornBruto = Number(data?.fornecedores_bruto || 0);
            const currentFornLiq = Number(data?.fornecedores_liquido || 0);
            const currentBatBruto = Number(data?.batedeiras_bruto || 0);
            const currentBatLiq = Number(data?.batedeiras_liquido || 0);
            const currentMotBruto = Number(data?.motoristas_bruto || 0);
            const currentMotLiq = Number(data?.motoristas_liquido || 0);
            const currentCamBruto = Number(data?.caminhoes_bruto || 0);
            const currentCamLiq = Number(data?.caminhoes_liquido || 0);

            const payload = {
              id,
              total_orders: currentOrders + 1,
              total_volume: currentVolume + volume,
              app_revenue: currentAppRev + appRev,
              fornecedores_bruto: currentFornBruto + fornBruto,
              fornecedores_liquido: currentFornLiq + fornLiq,
              batedeiras_bruto: currentBatBruto + batBruto,
              batedeiras_liquido: currentBatLiq + batLiq,
              motoristas_bruto: currentMotBruto + motBruto,
              motoristas_liquido: currentMotLiq + motLiq,
              caminhoes_bruto: currentCamBruto + camBruto,
              caminhoes_liquido: currentCamLiq + camLiq,
              updated_at: new Date().toISOString()
            };

            if (!data) {
              await supabase.from('admin_balances').upsert(payload);
            } else {
              await supabase.from('admin_balances').update(payload).eq('id', id);
            }
          } catch (err) {
            console.error("Erro ao incrementar admin_balances para " + id + ":", err);
          }
        }
      },

      fetchOrders: async (userId, force?: boolean) => {
         const now = Date.now();
         if (!force && lastFetchOrdersTime[userId] && now - lastFetchOrdersTime[userId] < 3000) {
             return;
         }
         lastFetchOrdersTime[userId] = now;

         const state = get();
         const currentUser = (state.currentUser?.id === userId ? state.currentUser : state.users[userId]) || state.currentUser;
         if (!currentUser) return;

         const roleLower = String(currentUser.role || '').toLowerCase();

          // Fetch orders using primary query
          let query = supabase.from('orders').select(`
             id, order_type, status, products_subtotal, delivery_distance_km, 
             applied_platform_fee_percent, applied_delivery_fee_per_km, applied_delivery_platform_fee_percent,
             buyer_id, seller_storefront_id, driver_id, created_at, picked_up_at, delivered_at,
             delivery_pin, accepted_at, ready_at, received_at, asaas_payment_id
          `);

          if (roleLower === 'loja' || roleLower === 'partner' || roleLower === 'batedeira' || roleLower === 'partner_admin') {
             const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id);
             const sfIds = (sfList || []).map((s: any) => s.id);
             sfIds.push(currentUser.id);
             query = query.or(`seller_storefront_id.in.(${sfIds.join(',')}),buyer_id.eq.${currentUser.id}`);
          } else if (roleLower === 'fornecedor' || roleLower === 'supplier') {
             const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id);
             const sfIds = (sfList || []).map((s: any) => s.id);
             sfIds.push(currentUser.id);
             query = query.or(`seller_storefront_id.in.(${sfIds.join(',')}),buyer_id.eq.${currentUser.id}`);
          } else if (roleLower === 'motorista' || roleLower === 'courier' || roleLower === 'caminhao' || roleLower === 'motoboy' || roleLower === 'driver') {
             query = query.or(`driver_id.is.null,driver_id.eq.${currentUser.id},status.in.(READY,PREPARING,DELIVERING,PAID,PENDING,pronto,preparo)`);
          } else if (roleLower === 'cliente' || roleLower === 'client') {
             query = query.eq('buyer_id', currentUser.id);
          } else if (roleLower === 'admin') {
             // Admin views all system orders
          } else {
             const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id);
             const sfIds = (sfList || []).map((s: any) => s.id);
             sfIds.push(currentUser.id);
             query = query.or(`seller_storefront_id.in.(${sfIds.join(',')}),buyer_id.eq.${currentUser.id},driver_id.eq.${currentUser.id}`);
          }

          if (roleLower !== 'admin') {
             query = query.eq('is_hidden', false);
          }

          query = query.order('created_at', { ascending: false }).limit(200);
          let { data: dbOrders, error } = await query;

          if (error || !dbOrders) {
             console.warn("Primary fetchOrders query notice (executing safe fallback):", error);
             let fallbackQuery = supabase.from('orders').select('*');
             if (roleLower === 'loja' || roleLower === 'partner' || roleLower === 'batedeira' || roleLower === 'partner_admin') {
                const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id);
                const sfIds = (sfList || []).map((s: any) => s.id);
                sfIds.push(currentUser.id);
                fallbackQuery = fallbackQuery.or(`seller_storefront_id.in.(${sfIds.join(',')}),buyer_id.eq.${currentUser.id}`);
             } else if (roleLower === 'motorista' || roleLower === 'courier' || roleLower === 'caminhao' || roleLower === 'motoboy' || roleLower === 'driver') {
                fallbackQuery = fallbackQuery.or(`driver_id.is.null,driver_id.eq.${currentUser.id}`);
             } else if (roleLower === 'cliente' || roleLower === 'client') {
                fallbackQuery = fallbackQuery.eq('buyer_id', currentUser.id);
             }
             if (roleLower !== 'admin') {
                fallbackQuery = fallbackQuery.eq('is_hidden', false);
             }
             const fallbackRes = await fallbackQuery.order('created_at', { ascending: false }).limit(200);
             dbOrders = fallbackRes.data;
          }
         
         if (dbOrders) {
            const missingUserIds = new Set<string>();
            dbOrders.forEach((o: any) => {
               if (o.buyer_id && !state.users[o.buyer_id]?.name) missingUserIds.add(o.buyer_id);
               if (o.driver_id && !state.users[o.driver_id]?.name) missingUserIds.add(o.driver_id);
            });

                const fetchedUsersMap: Record<string, any> = {};
            if (missingUserIds.size > 0) {
               const { data: uData } = await supabase.from('users').select('id, name, email, phone, telefone, endereco, address, bairro, cidade, role').in('id', Array.from(missingUserIds));
               if (uData && uData.length > 0) {
                  uData.forEach((u: any) => { fetchedUsersMap[u.id] = u; });
                  set(prev => ({ users: { ...prev.users, ...fetchedUsersMap } }));
               }
            }
            const allUsers = { ...state.users, ...fetchedUsersMap };

             const mappedOrders = dbOrders.map((dbOrder: any) => {
                 let appStatus: Order['status'] = 'aguardando_pagamento';
                 if (dbOrder.status === 'PENDING' || dbOrder.status === 'CREATED') appStatus = 'aguardando_pagamento';
                 if (dbOrder.status === 'PAID') appStatus = 'pendente';
                 if (dbOrder.status === 'PREPARING') appStatus = 'preparo';
                 if (dbOrder.status === 'READY' || dbOrder.status === 'SEARCHING_OPERATOR') appStatus = 'pronto';
                 if (dbOrder.status === 'IN_TRANSIT' || dbOrder.status === 'DELIVERING') appStatus = 'em_rota';
                 if (dbOrder.status === 'DELIVERED') appStatus = 'aguardando_cliente';
                 if (dbOrder.status === 'RECEIVED') appStatus = 'entregue';
                 if (dbOrder.status === 'COMPLETED') appStatus = 'arquivado';
                 if (dbOrder.status === 'CANCELLED' || dbOrder.status === 'CANCELED' || dbOrder.status === 'REFUND_REQUESTED' || dbOrder.status === 'REFUNDED') appStatus = 'cancelado';

                const storeName = dbOrder.storefront?.store_name || 'Loja';
                const localOrder = state.orders.find(o => o.id === dbOrder.id);
                
                // Preserva o status local se a loja ou usuario ja aceitou/avancou o pedido (evita regressao de status no auto-refresh)
                const statusPriority: Record<string, number> = {
                  'aguardando_pagamento': 1,
                  'pendente': 2,
                  'preparo': 3,
                  'pronto': 4,
                  'em_rota': 5,
                  'aguardando_cliente': 6,
                  'entregue': 7,
                  'arquivado': 8,
                  'cancelado': 9
                };

                let finalStatus = appStatus;
                if (localOrder?.status && (statusPriority[localOrder.status] || 0) > (statusPriority[appStatus] || 0)) {
                  finalStatus = localOrder.status;
                }

                const orderCity = dbOrder.storefront?.partner?.cidade || dbOrder.buyer?.cidade || 'Belém';
                const orderCityRates = getRatesForCity(orderCity, state.rates, state.cities);

                let deliveryTotal = 0;
                if (dbOrder.order_type === 'B2C') {
                  deliveryTotal = (orderCityRates.courier_payment_mode === 'FIXED') 
                    ? (orderCityRates.courier_fixed_fee ?? 8.00) 
                    : (dbOrder.delivery_distance_km || 0) * (orderCityRates.b2c_km || 2.00);
                } else if (dbOrder.order_type === 'B2B') {
                  deliveryTotal = (orderCityRates.transporter_payment_mode === 'FIXED') 
                    ? (orderCityRates.transporter_fixed_fee ?? 150.00) 
                    : (dbOrder.delivery_distance_km || 0) * (orderCityRates.b2b_km || 5.00);
                } else {
                  deliveryTotal = (dbOrder.delivery_distance_km || 0) * (dbOrder.applied_delivery_fee_per_km || 0);
                }

                const platformDelivery = deliveryTotal * ((dbOrder.applied_delivery_platform_fee_percent || orderCityRates.b2c_mot_plat || 15) / 100);
                const driverAmount = deliveryTotal - platformDelivery;

                const itemsTotal = dbOrder.products_subtotal || 0;
                const platformSales = itemsTotal * ((dbOrder.applied_platform_fee_percent || 0) / 100);
                const sellerAmount = itemsTotal - platformSales;

                let finalEntregaTotal = deliveryTotal;
                let finalEntregaMotorista = driverAmount;
                let finalPlatVenda = platformSales;
                let finalPlatEntrega = platformDelivery;
                let finalRepasse = sellerAmount;

                if (dbOrder.order_type === 'COLETA') {
                    finalEntregaTotal = itemsTotal;
                    finalPlatVenda = 0;
                    finalPlatEntrega = itemsTotal * ((dbOrder.applied_delivery_platform_fee_percent || 0) / 100);
                    finalEntregaMotorista = finalEntregaTotal - finalPlatEntrega;
                    finalRepasse = 0;
                }

                const platformTotal = finalPlatVenda + finalPlatEntrega;

                    const sfUser = allUsers[dbOrder.seller_storefront_id] || allUsers[dbOrder.storefront?.partner_id];
                    const resolvedStoreName = dbOrder.storefront?.store_name || sfUser?.name || localOrder?.lojaNome || 'Ponto do açaí';
                    const resolvedStoreAddress = sfUser?.endereco || sfUser?.address || localOrder?.lojaEndereco;

                    return {
                       ...(localOrder || {}),
                       id: dbOrder.id,
                       type: dbOrder.order_type as 'B2C'|'B2B'|'COLETA',
                       title: localOrder?.title || `Pedido de ${resolvedStoreName}`,
                       status: finalStatus as any,
                       createdAt: dbOrder.created_at,
                       pickedUpAt: dbOrder.picked_up_at,
                       deliveredAt: dbOrder.delivered_at,
                       acceptedAt: dbOrder.accepted_at,
                       readyAt: dbOrder.ready_at,
                       receivedAt: dbOrder.received_at,
                       deliveryPin: dbOrder.delivery_pin,
                       deliveryAddress: dbOrder.delivery_address || localOrder?.deliveryAddress || dbOrder.buyer?.endereco || dbOrder.buyer?.address || allUsers[dbOrder.buyer_id]?.endereco,
                       deliveryLat: dbOrder.delivery_lat || localOrder?.deliveryLat,
                       deliveryLng: dbOrder.delivery_lng || localOrder?.deliveryLng,
                       deliveryReference: dbOrder.delivery_reference || localOrder?.deliveryReference,
                       payoutSellerDone: !!dbOrder.payout_seller_done || !!localOrder?.payoutSellerDone,
                       payoutDriverDone: !!dbOrder.payout_driver_done || !!localOrder?.payoutDriverDone,
                       clienteNome: dbOrder.buyer?.name || allUsers[dbOrder.buyer_id]?.name || localOrder?.clienteNome,
                       clienteTelefone: dbOrder.buyer?.phone || dbOrder.buyer?.telefone || allUsers[dbOrder.buyer_id]?.telefone || localOrder?.clienteTelefone,
                       lojaNome: resolvedStoreName,
                       lojaEndereco: resolvedStoreAddress,
                       lojaTelefone: sfUser?.phone || sfUser?.telefone || localOrder?.lojaTelefone,
                       motoristaNome: dbOrder.driver?.name || allUsers[dbOrder.driver_id]?.name,
                       criadoPor: localOrder?.criadoPor || dbOrder.buyer_id,
                       origemId: localOrder?.origemId || dbOrder.storefront?.partner_id || dbOrder.seller_storefront_id,
                       destinoId: localOrder?.destinoId || dbOrder.buyer_id,
                   cidadeOrigem: dbOrder.storefront?.partner?.cidade || dbOrder.buyer?.cidade || 'Belém',
                   clienteId: localOrder?.clienteId || (dbOrder.order_type === 'B2C' ? dbOrder.buyer_id : undefined),
                   lojaId: localOrder?.lojaId || (dbOrder.order_type === 'B2B' ? dbOrder.buyer_id : (dbOrder.storefront?.partner_id || dbOrder.seller_storefront_id)),
                   fornecedorId: localOrder?.fornecedorId || (dbOrder.order_type === 'B2B' ? (dbOrder.storefront?.partner_id || dbOrder.seller_storefront_id) : undefined),
                   seller_storefront_id: dbOrder.seller_storefront_id,
                   sellerStorefrontId: dbOrder.seller_storefront_id,
                   distancia: dbOrder.delivery_distance_km,
                   valor: dbOrder.products_subtotal,
                   motoristaId: dbOrder.driver_id,
                   confirmacao: localOrder?.confirmacao || { entregador: !!dbOrder.driver_id, recebedor: appStatus === 'entregue' },
                   taxas: localOrder?.taxas || {
                      entregaTotal: finalEntregaTotal,
                      entregaMotorista: finalEntregaMotorista,
                      entregaCliente: deliveryTotal, // Need to provide this since it is required by the TS type
                      entregaLoja: 0,
                      entregaFornecedor: 0,
                      plataformaVenda: finalPlatVenda,
                      plataformaEntrega: finalPlatEntrega,
                      plataformaTotal: platformTotal,
                      repasse: finalRepasse
                   }
                };
             });

             set({ orders: mappedOrders });
         }
      },

      setupRealtime: (userId) => {
          get().startRealtime();
      },

      clearData: async () => {
         try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/clear-data', {
               method: 'POST',
               headers
            });

            if (!res.ok) {
               const { error } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
               if (error) {
                  console.error("Error clearing orders from DB:", error);
                  alert("Erro ao limpar pedidos no banco de dados: " + error.message);
                  return;
               }
            }
            alert("Todos os pedidos foram excluídos do banco de dados com sucesso!");
         } catch(e: any) {
            console.error("Exception clearing orders:", e);
            alert("Erro ao limpar pedidos no banco de dados.");
         }

         set(() => ({ orders: [], orderCounter: 1 }));
         await get().fetchOrders(get().currentUser?.id || '', true);
      },

      setClearPassword: (pwd) => set({ clearPassword: pwd }),

      fetchCities: async () => {
         const { data, error } = await supabase.from('cities').select('*').order('name', { ascending: true });
         if (!error && data) {
            set({ cities: data });
         }
      },
      addCity: async (name) => {
         const { data, error } = await supabase.from('cities').insert({ name }).select().single();
         if (!error && data) {
            set((state) => ({ cities: [...state.cities, data] }));
         }
      },
      updateCityStatus: async (id, status) => {
         const { error } = await supabase.from('cities').update({ status }).eq('id', id);
         if (!error) {
            set((state) => ({
               cities: state.cities.map(c => c.id === id ? { ...c, status } : c)
            }));
         }
      },
      saveCityRates: async (cityId, cityRates) => {
         set((state) => {
            const currentRates = state.rates;
            const mergedRates = { ...currentRates, ...cityRates };
            return {
               rates: mergedRates,
               cities: state.cities.map(c => c.id === cityId ? { ...c, rates: { ...c.rates, ...cityRates } } : c)
            };
         });
         try {
            const { error } = await supabase.from('cities').update({ rates: cityRates }).eq('id', cityId);
            if (error) console.warn("Aviso ao salvar taxas da cidade no Supabase (coluna rates):", error);
         } catch (e) {
            console.warn("Exceção ao atualizar taxas da cidade no banco:", e);
         }
         try {
            await get().saveRates(cityRates);
         } catch (e) {
            console.warn("Exceção ao sincronizar com platform_settings:", e);
         }
      },
      deleteCity: async (id) => {
         const { error } = await supabase.from('cities').delete().eq('id', id);
         if (!error) {
            set((state) => ({
               cities: state.cities.filter(c => c.id !== id)
            }));
         }
      },

      startAutoRefresh: () => {
         if (autoRefreshInterval) clearInterval(autoRefreshInterval);
         
         // Atualiza pedidos em segundo plano a cada 4 segundos com sincronização ativa
         autoRefreshInterval = setInterval(async () => {
             if (typeof document !== 'undefined' && document.hidden) return;
             const currentUser = get().currentUser;
             if (currentUser) {
                 try {
                     await get().fetchOrders(currentUser.id, true);
                     
                     const pendingOrders = (get().orders || []).filter(o => o.status === 'aguardando_pagamento');
                     if (pendingOrders.length > 0) {
                         for (const pOrder of pendingOrders) {
                             try {
                                 const res = await fetch(`/api/asaas/status?orderId=${pOrder.id}`);
                                 if (res.ok) {
                                     const data = await res.json();
                                     if (data.isPaid) {
                                         get().acaoPedido(pOrder.id, 'confirmar_pagamento');
                                     }
                                 }
                             } catch(e) {
                                 console.warn("Erro no autoRefresh ao checar status de pagamento Pix:", e);
                             }
                         }
                     }
                 } catch(eOrders) {
                     console.warn("Erro ao buscar pedidos no auto-refresh:", eOrders);
                 }

                 // Disparo Automático por Horário Programado (payout_time)
                 try {
                   const targetPayoutTime = get().rates?.payout_time || '22:00';
                   const now = new Date();
                   const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                   if (currentHHMM === targetPayoutTime) {
                     const todayStr = now.toISOString().split('T')[0];
                     if (lastSweepDate !== todayStr) {
                       lastSweepDate = todayStr;
                       console.log(`⏰ Horário de varredura programada atingido (${targetPayoutTime})! Executando payout-sweep...`);
                       supabase.functions.invoke('payout-sweep').then(({ data, error }) => {
                         if (error) console.warn("Aviso auto-sweep por horário:", error);
                         else console.log("✅ Varredura automática das", targetPayoutTime, "executada:", data);
                       }).catch(err => console.warn("Exceção no auto-sweep:", err));
                     }
                   }
                 } catch(eSweep) {
                   console.warn("Erro na checagem de horário da varredura:", eSweep);
                 }
             }
         }, 60000); // 60s em vez de 20s para economizar banda
      },
      
      stopAutoRefresh: () => {
         if (autoRefreshInterval) {
             clearInterval(autoRefreshInterval);
             autoRefreshInterval = null;
         }
      }
    }),
    { 
      name: 'acaifood-storage-v4',
      // Exclui campos sensíveis do localStorage (senhas não devem ser persistidas)
      partialize: (state) => {
        const { users, currentUser, ...rest } = state;
        // Strip all sensitive fields from persisted users
        const safeUsers = Object.fromEntries(
          Object.entries(users || {}).map(([k, u]) => [k, { ...u, password: undefined, cpfCnpj: undefined, pixKey: undefined, asaasWalletId: undefined }])
        ) as typeof users;
        const safeCurrentUser = currentUser ? { ...currentUser, password: undefined } : null;
        // Strip sensitive payment/security data from persisted orders
        const safeOrders = (rest.orders || []).map((o: any) => ({
          ...o,
          deliveryPin: undefined,
          pixQrCode: undefined,
          pixCopiaECola: undefined,
          asaasPaymentId: undefined,
          paymentId: undefined,
          invoiceUrl: undefined,
        }));
        return { ...rest, orders: safeOrders, users: safeUsers, currentUser: safeCurrentUser };
      },
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          // Garantir que arrays e objetos críticos nunca sejam undefined após reidratação
          if (!Array.isArray(state.orders)) (state as any).orders = [];
          if (!state.users || typeof state.users !== 'object') (state as any).users = {};
          if (!state.rates || typeof state.rates !== 'object') (state as any).rates = DB_DEFAULTS.rates;

          if (state.currentUser) {
            setTimeout(() => {
              state.setupRealtime(state.currentUser!.id);
              state.fetchOrders(state.currentUser!.id);
              state.startAutoRefresh();
              state.fetchCities();
            }, 50);
          }
        }
      }
    }
  )
);
