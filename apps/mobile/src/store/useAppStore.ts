import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { generateValidPixPayload } from '@/lib/pix';

// --- UTILITÁRIOS: Haversine e Coordenadas de Belém ---
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

export type Role = 'admin' | 'loja' | 'cliente' | 'motorista' | 'fornecedor' | 'ecoponto';

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
  const match = cities.find(c => c.name.toLowerCase().trim() === cityName.toLowerCase().trim());
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
  fetchLojas: () => Promise<void>;
  logout: () => void;
  linkAsaasAccount: (userId: string, walletId: string) => Promise<void>;
  fetchRates: (force?: boolean) => Promise<void>;
  saveRates: (newRates: Partial<AppState['rates']>) => Promise<void>;
  criarPedido: (tipo: 'B2C' | 'B2B' | 'COLETA', targetId?: string, deliveryInfo?: { address?: string; lat?: number; lng?: number; reference?: string }) => Promise<any>;
  acaoPedido: (orderId: string, action: string, pinStr?: string) => Promise<void>;
  setFreteSubsidy: (userId: string, pct: number) => Promise<void>;
  updateUserStatus: (userId: string, status: 'active' | 'paused' | 'blocked') => Promise<void>;
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
let lastFetchRatesTime = 0;
const lastFetchOrdersTime: Record<string, number> = {};

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
        await supabase.auth.signOut(); // Wipe stale sessions

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
          
          const sf = (userProfile.storefronts && userProfile.storefronts.length > 0) ? userProfile.storefronts[0] : null;

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
          status: 'active'
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
                const subRes = await fetch('/api/asaas/subaccount', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
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
                const subRes = await fetch('/api/asaas/subaccount', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
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
          if (!currentUser) return;
          
          get().fetchRates();
          get().fetchAllUsers();
          get().fetchOrders(currentUser.id);
          get().startAutoRefresh();

          if (supabaseChannel) {
              supabaseChannel.unsubscribe();
          }

          supabaseChannel = supabase.channel('schema-db-changes')
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'orders' },
                  () => {
                      get().fetchOrders(currentUser.id);
                  }
              )
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'storefronts' },
                  () => {
                      get().fetchAllUsers();
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
      },

      fetchLojas: async () => {
        const { data: dbLojas, error } = await supabase
            .from('users')
            .select('*, storefronts(*, products(*))')
            .eq('role', 'PARTNER');
            
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
                    const sf = (dbUser.storefronts && dbUser.storefronts.length > 0) ? dbUser.storefronts[0] : null;
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
                    const sf = (dbUser.storefronts && dbUser.storefronts.length > 0) ? dbUser.storefronts[0] : null;
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

        const targetUser = get().users[userId];

        // Se a chave informada não for um walletId nativo de subconta do Asaas, gerar subconta oficial no Asaas
        if (!isRealWallet && targetUser?.cpfCnpj) {
          try {
            const subRes = await fetch('/api/asaas/subaccount', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                name: targetUser.name || 'Parceiro AçaíFood',
                email: targetUser.email || 'parceiro@acaifood.com.br',
                cpfCnpj: targetUser.cpfCnpj,
                phone: targetUser.telefone || '',
                endereco: targetUser.endereco || '',
                bairro: targetUser.bairro || '',
                cidade: targetUser.cidade || 'Belém',
                role: targetUser.role
              })
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              if (subData.walletId) {
                finalWalletId = subData.walletId;
                isRealWallet = true;
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
                   ecopoint_fixed_fee: data.ecopoint_fixed_fee ?? state.rates.ecopoint_fixed_fee ?? 50.00
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
             ecopoint_fixed_fee: mergedRates.ecopoint_fixed_fee
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
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            alert("Sessão expirada. Faça login novamente.");
            return;
          }

          try {
            await fetch(`/api/asaas/subaccount?userId=${userId}`, { method: 'DELETE' });
          } catch (_e) {
            console.warn("Aviso ao tentar excluir subconta Asaas via API local:", _e);
          }

          const { data: responseData, error: functionError } = await supabase.functions.invoke('remove-account', {
            body: { targetUserId: userId }
          });

          if (functionError) {
             console.error("Erro na deleção (função):", functionError);
             alert(`Falha de conexão: ${functionError.message || 'CORS ou erro de rede'}`);
             return;
          }

          if (responseData && responseData.error) {
             console.error("Erro na deleção (retorno):", responseData.error);
             alert(`Falha ao excluir usuário: ${responseData.error}`);
             return;
          }

          set((state) => {
            const newUsers = { ...state.users };
            delete newUsers[userId];
            return { users: newUsers };
          });
          
          alert("Usuário excluído com sucesso!");
        } catch (error) {
           console.error("Exceção ao excluir usuário:", error);
           alert("Erro de conexão ao tentar excluir usuário.");
        }
      },

      changePassword: (userId, newPassword) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        const updatedUser = { ...user, password: newPassword };
        const isCurrent = state.currentUser?.id === userId;
        return { 
          users: { ...state.users, [userId]: updatedUser },
          currentUser: isCurrent ? updatedUser : state.currentUser
        };
      }),

      updateUserPrice: async (userId, b2cPrices, b2bPrice) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const updatedUser = { ...user };
          if (b2cPrices) updatedUser.priceB2C = b2cPrices;
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
            const { data: sf } = await supabase.from('storefronts').select('id').eq('partner_id', userId).limit(1).maybeSingle();
            if (sf) {
                const { error } = await supabase.from('storefronts').update(updates).eq('id', sf.id);
                if (error) console.error("Error updating prices in DB:", error);
            } else {
                const user = get().users[userId];
                const { error } = await supabase.from('storefronts').insert({
                    partner_id: userId,
                    store_name: user?.name || 'Loja',
                    ...updates
                });
                if (error) console.error("Error inserting prices in DB:", error);
            }
            await get().fetchAllUsers();
        }
      },

      addProduct: async (userId, product) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const currentProducts = user.products || [];
          const updatedUser = { ...user, products: [...currentProducts, product] };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        // Sync with DB
        const { data: sf } = await supabase.from('storefronts').select('id').eq('partner_id', userId).single();
        if (sf) {
           await supabase.from('products').insert({
              id: product.id,
              storefront_id: sf.id,
              name: product.name,
              price: product.price
           });
        }
      },

      removeProduct: async (userId, productId) => {
        set((state) => {
          const user = state.users[userId];
          if (!user || !user.products) return state;
          const updatedUser = { ...user, products: user.products.filter(p => p.id !== productId) };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });

        // Sync with DB
        await supabase.from('products').delete().eq('id', productId);
      },

      criarPedido: async (tipo, targetId, deliveryInfo?: { address?: string; lat?: number; lng?: number; reference?: string }) => {
        const state = get();
        if (!state.currentUser) return;
        const currentUser = state.currentUser;
        
        let originId = currentUser.id;
        let destId = targetId || '';

        if (tipo === 'B2C' || tipo === 'B2B') { originId = targetId || ''; destId = currentUser.id; }
        if (tipo === 'COLETA') { destId = 'ecoponto'; }

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

        const calcFrete = (t: string, d: number) => {
          if (t === 'B2C') {
            return (state.rates.courier_payment_mode === 'FIXED') 
              ? (state.rates.courier_fixed_fee ?? 8.00) 
              : d * state.rates.b2c_km;
          }
          if (t === 'B2B') {
            return (state.rates.transporter_payment_mode === 'FIXED') 
              ? (state.rates.transporter_fixed_fee ?? 150.00) 
              : d * state.rates.b2b_km;
          }
          if (t === 'COLETA') {
            return (state.rates.ecopoint_payment_mode === 'FIXED') 
              ? (state.rates.ecopoint_fixed_fee ?? 50.00) 
              : d * state.rates.col_km;
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
          confirmacao: { entregador: false, recebedor: false },
          motoristaId: null,
          valor: itemsTotal,
          quantity: totalQuantity,
          items: finalCartItems,
          deliveryAddress: deliveryInfo?.address || currentUser.endereco || (currentUser.bairro ? `${currentUser.bairro}, ${currentUser.cidade || 'Belém'}` : ''),
          deliveryLat: deliveryInfo?.lat,
          deliveryLng: deliveryInfo?.lng,
          deliveryReference: deliveryInfo?.reference,
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
          novoPedido.taxas.plataformaEntrega = novoPedido.taxas.entregaTotal * (state.rates.b2c_mot_plat / 100);
          novoPedido.taxas.entregaMotorista = novoPedido.taxas.entregaTotal - novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.plataformaVenda = novoPedido.valor * (state.rates.b2c_plat / 100);
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
            novoPedido.taxas.plataformaEntrega = novoPedido.taxas.entregaTotal * (state.rates.b2b_mot_plat / 100);
            novoPedido.taxas.entregaMotorista = novoPedido.taxas.entregaTotal - novoPedido.taxas.plataformaEntrega;
            novoPedido.taxas.plataformaVenda = novoPedido.valor * (state.rates.b2b_plat / 100);
            novoPedido.taxas.plataformaTotal = novoPedido.taxas.plataformaVenda + novoPedido.taxas.plataformaEntrega;
            novoPedido.taxas.repasse = novoPedido.valor - novoPedido.taxas.plataformaVenda - novoPedido.taxas.entregaFornecedor;
        }

        if (tipo === 'COLETA') {
          novoPedido.title = `Coleta de Carroço / Resíduos (Caçamba)`;
          novoPedido.lojaId = currentUser.id;
          novoPedido.taxas.entregaTotal = valColeta;
          novoPedido.taxas.entregaLoja = valColeta;
          novoPedido.taxas.plataformaEntrega = valColeta * (state.rates.col_mot_plat / 100);
          novoPedido.taxas.entregaMotorista = valColeta - novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.plataformaVenda = 0;
          novoPedido.taxas.plataformaTotal = novoPedido.taxas.plataformaEntrega;
          novoPedido.taxas.repasse = 0;
        }

        // Apenas salva localmente após o sucesso e com o ID real
        
        // 1. Insert into Supabase Orders table
        try {
          let sellerStorefrontId = targetId;
          
          if (tipo === 'COLETA') {
             const { data: mySf } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id).limit(1).maybeSingle();
             if (mySf) {
                 sellerStorefrontId = mySf.id;
             } else {
                 alert("Seu perfil de loja não foi encontrado.");
                 return;
             }
          } else if (targetId) {
             const { data: sf } = await supabase.from('storefronts').select('id').eq('partner_id', targetId).limit(1).maybeSingle();
             if (sf) {
                 sellerStorefrontId = sf.id;
             } else {
                 alert("Esta loja ainda não concluiu o cadastro (Perfil de Vendas ausente). Não é possível pedir no momento.");
                 return;
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
              console.warn("Aviso RLS/DB ao salvar pedido (usando fallback seguro):", dbError);
            } else {
              dbOrder = data;
            }
          } catch (err) {
            console.warn("Exceção ao salvar pedido no DB:", err);
          }

          const orderIdToUse = dbOrder?.id || `ord_${Date.now()}`;

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

          // Buscar asaas_wallet_id do Supabase se ausente no estado
          if (!sellerWalletId && sellerPartnerId) {
            try {
              const { data: uData } = await supabase.from('users').select('id, name, email, cpf_cnpj, asaas_wallet_id').eq('id', sellerPartnerId).maybeSingle();
              if (uData) {
                if (uData.asaas_wallet_id) {
                  sellerWalletId = uData.asaas_wallet_id;
                } else if (uData.cpf_cnpj) {
                  // Tentar auto-criar subconta no Asaas para a loja se tiver CPF/CNPJ
                  try {
                    const subRes = await fetch('/api/asaas/subaccount', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: uData.id,
                        name: uData.name || 'Batedeira Parceira',
                        email: uData.email || 'batedeira@acaifood.com.br',
                        cpfCnpj: uData.cpf_cnpj
                      })
                    });
                    if (subRes.ok) {
                      const subData = await subRes.json();
                      if (subData.walletId) sellerWalletId = subData.walletId;
                    }
                  } catch (subErr) {
                    console.warn("Auto subaccount error:", subErr);
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
            if (!driverWalletId) {
              try {
                const { data: dData } = await supabase.from('users').select('asaas_wallet_id').eq('id', novoPedido.motoristaId).maybeSingle();
                if (dData?.asaas_wallet_id) driverWalletId = dData.asaas_wallet_id;
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
            totalValue: totalValue
          };
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

      acaoPedido: async (orderId, action, pinStr?: string) => {
        const state = get();
        const currentUser = state.currentUser;
        if (!currentUser) return;

        if (action === 'validar_pin') {
            const order = state.orders.find(o => o.id === orderId);
            if (order && order.deliveryPin !== pinStr) {
                alert("PIN Inválido!");
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
            if (action === 'cancelar_pedido' || action === 'cancelar_cliente') { newOrder.status = 'cancelado'; newDbStatus = 'CANCELLED'; }
            if (action === 'confirmar_pagamento' || action === 'pagar') { 
              newOrder.status = o.type === 'COLETA' ? 'pronto' : 'preparo'; 
              newDbStatus = o.type === 'COLETA' ? 'READY' : 'PAID'; 
            }
            if (action === 'aceitar_loja' || action === 'aceitar_forn') { newOrder.status = 'preparo'; newDbStatus = 'PREPARING'; }
            if (action === 'chamar_moto' || action === 'chamar_caminhao') { newOrder.status = 'pronto'; newDbStatus = 'READY'; }
            if (action === 'aceitar_motorista') { newOrder.status = 'em_rota'; newOrder.motoristaId = state.currentUser?.id || null; newDbStatus = 'DELIVERING'; driverId = newOrder.motoristaId; }
            if (action === 'conf_motorista') {
              newOrder.status = 'aguardando_cliente';
              newDbStatus = 'DELIVERED';
            }
            if (action === 'conf_recebedor' || action === 'validar_pin' || action === 'forcar_baixa') {
              newOrder.status = 'entregue';
              newDbStatus = 'RECEIVED';
            }
            return newOrder;
          });
          return { orders: newOrders };
        });

        const updates: any = {};
        if (newDbStatus) updates.status = newDbStatus;
        if (driverId) updates.driver_id = driverId;
        if (action === 'aceitar_loja' || action === 'aceitar_forn') updates.accepted_at = new Date().toISOString();
        if (action === 'chamar_moto' || action === 'chamar_caminhao') updates.ready_at = new Date().toISOString();
        if (action === 'aceitar_motorista') updates.picked_up_at = new Date().toISOString();
        if (action === 'conf_motorista') updates.delivered_at = new Date().toISOString();
        if (action === 'conf_recebedor' || action === 'validar_pin' || action === 'forcar_baixa') updates.received_at = new Date().toISOString();

         if (Object.keys(updates).length > 0) {
            if (action === 'validar_pin') updates.provided_pin = pinStr;
            const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
            if (error) {
               console.error("Error updating order in DB:", error);
               if (error.message && error.message.includes('PIN de segurança')) {
                  alert("Erro de Segurança: " + error.message);
                  // Reverter update otimista se necessário, forçando um fetchOrders
                  get().fetchOrders(currentUser.id);
               }
            } else if (action === 'conf_recebedor' || action === 'validar_pin' || action === 'forcar_baixa') {
               // Disparar transferências automáticas Pix (Payout) para TODOS os parceiros: Batedeira, Fornecedor, Motoboy, Caminhoneiro
               const currentOrder = state.orders.find(o => o.id === orderId);
               if (currentOrder) {
                 // 1. Repasse do Vendedor (Loja no B2C ou Fornecedor no B2B)
                 const sellerId = currentOrder.type === 'B2B' 
                   ? (currentOrder.fornecedorId || currentOrder.origemId)
                   : (currentOrder.lojaId || currentOrder.origemId);

                 let sellerUser: any = sellerId ? state.users[sellerId] : null;
                 if (!sellerUser && sellerId) {
                   const { data: uSeller } = await supabase.from('users').select('pix_key, cpf_cnpj, email, asaas_wallet_id').eq('id', sellerId).maybeSingle();
                   sellerUser = uSeller;
                 }
                 const sellerPixKey = sellerUser?.pix_key || sellerUser?.pixKey || sellerUser?.asaasWalletId || sellerUser?.cpf_cnpj || sellerUser?.cpfCnpj || sellerUser?.email;
                 const repasseSeller = currentOrder.taxas?.repasse || 0;

                 if (sellerPixKey && repasseSeller > 0) {
                   fetch('/api/asaas/transfer', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                       pixKey: sellerPixKey,
                       value: repasseSeller,
                       description: `Repasse Venda AçaíFood #${String(orderId).substring(0, 8)}`,
                       orderId
                     })
                   }).then(r => r.json()).then(data => {
                     console.log("✅ Repasse Pix enviado com sucesso ao Vendedor:", data);
                   }).catch(e => console.warn("Aviso no repasse Pix ao Vendedor:", e));
                 }

                 // 2. Repasse do Entregador (Motoboy no B2C ou Caminhoneiro no B2B/Coleta)
                 const driverId = currentOrder.motoristaId || state.currentUser?.id;
                 let driverUser: any = driverId ? state.users[driverId] : null;
                 if (!driverUser && driverId) {
                   const { data: uDriver } = await supabase.from('users').select('pix_key, cpf_cnpj, email, asaas_wallet_id').eq('id', driverId).maybeSingle();
                   driverUser = uDriver;
                 }
                 const driverPixKey = driverUser?.pix_key || driverUser?.pixKey || driverUser?.asaasWalletId || driverUser?.cpf_cnpj || driverUser?.cpfCnpj || driverUser?.email;
                 const repasseDriver = currentOrder.taxas?.entregaMotorista || 0;

                 if (driverPixKey && repasseDriver > 0) {
                   fetch('/api/asaas/transfer', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                       pixKey: driverPixKey,
                       value: repasseDriver,
                       description: `Repasse Frete AçaíFood #${String(orderId).substring(0, 8)}`,
                       orderId
                     })
                   }).then(r => r.json()).then(data => {
                     console.log("✅ Repasse Pix enviado com sucesso ao Entregador:", data);
                   }).catch(e => console.warn("Aviso no repasse Pix ao Entregador:", e));
                 }
               }
            }
         }

        if (newDbStatus === 'CANCELLED') {
           try {
              fetch('/api/asaas/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
              }).then(r => r.json()).then(data => {
                if (data.success) console.log("✅ Estorno Asaas efetuado com sucesso:", data);
                else console.warn("Aviso no estorno Asaas:", data);
              }).catch(e => console.warn("Erro ao solicitar estorno Asaas:", e));
           } catch(e) {
              console.error("Exceção ao solicitar estorno:", e);
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

         let query = supabase.from('orders').select(`
            id, order_type, status, products_subtotal, delivery_distance_km, 
            applied_platform_fee_percent, applied_delivery_fee_per_km, applied_delivery_platform_fee_percent,
            buyer_id, seller_storefront_id, driver_id, created_at, picked_up_at, delivered_at,
            delivery_pin, accepted_at, ready_at, received_at,
            buyer:users!orders_buyer_id_fkey(id, name, latitude, longitude, cidade),
            storefront:storefronts!orders_seller_storefront_id_fkey(id, partner_id, store_name, partner:users!storefronts_partner_id_fkey(cidade)),
            driver:users!orders_driver_id_fkey(id, name)
         `);

         if (roleLower === 'loja') {
             const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id);
             if (sfList && sfList.length > 0) {
                 const sfIds = sfList.map((s: any) => s.id).join(',');
                 query = query.or(`seller_storefront_id.in.(${sfIds}),buyer_id.eq.${currentUser.id}`);
             } else {
                 query = query.eq('buyer_id', currentUser.id);
             }
          } else if (roleLower === 'fornecedor') {
             const { data: sfList } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id);
             if (sfList && sfList.length > 0) {
                 query = query.in('seller_storefront_id', sfList.map((s: any) => s.id));
             }
          } else if (roleLower === 'motorista' || roleLower === 'courier') {
            query = query.or(`status.in.(READY,PREPARING,DELIVERING,PAID,PENDING),driver_id.eq.${currentUser.id}`);
         } else if (roleLower === 'cliente') {
            query = query.eq('buyer_id', currentUser.id);
         } else if (roleLower === 'admin') {
            // Admin vê todos os pedidos sem restrição
         }

         if (roleLower !== 'admin') {
            query = query.eq('is_hidden', false);
         }

         query = query.order('created_at', { ascending: false }).limit(200);
         const { data: dbOrders, error } = await query;
         
         if (dbOrders && !error) {
            const missingUserIds = new Set<string>();
            dbOrders.forEach((o: any) => {
               if (o.buyer_id && !state.users[o.buyer_id]?.name) missingUserIds.add(o.buyer_id);
               if (o.driver_id && !state.users[o.driver_id]?.name) missingUserIds.add(o.driver_id);
            });

            const fetchedUsersMap: Record<string, any> = {};
            if (missingUserIds.size > 0) {
               const { data: uData } = await supabase.from('users').select('id, name, email, bairro, cidade, role').in('id', Array.from(missingUserIds));
               if (uData && uData.length > 0) {
                  uData.forEach((u: any) => { fetchedUsersMap[u.id] = u; });
                  set(prev => ({ users: { ...prev.users, ...fetchedUsersMap } }));
               }
            }
            const allUsers = { ...state.users, ...fetchedUsersMap };

             const mappedOrders = dbOrders.map((dbOrder: any) => {
                let appStatus: Order['status'] = 'aguardando_pagamento';
                if (dbOrder.status === 'PENDING') appStatus = 'aguardando_pagamento';
                if (dbOrder.status === 'PAID') appStatus = 'pendente';
                if (dbOrder.status === 'PREPARING') appStatus = 'preparo';
                if (dbOrder.status === 'READY') appStatus = 'pronto';
                if (dbOrder.status === 'IN_TRANSIT' || dbOrder.status === 'DELIVERING') appStatus = 'em_rota';
                if (dbOrder.status === 'DELIVERED') appStatus = 'aguardando_cliente';
                if (dbOrder.status === 'RECEIVED') appStatus = 'entregue';
                if (dbOrder.status === 'COMPLETED') appStatus = 'arquivado';
                if (dbOrder.status === 'CANCELLED') appStatus = 'cancelado';

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

                const deliveryTotal = (dbOrder.delivery_distance_km || 0) * (dbOrder.applied_delivery_fee_per_km || 0);
                const platformDelivery = deliveryTotal * ((dbOrder.applied_delivery_platform_fee_percent || 0) / 100);
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

                return {
                   ...(localOrder || {}),
                   id: dbOrder.id,
                   type: dbOrder.order_type as 'B2C'|'B2B'|'COLETA',
                   title: localOrder?.title || `Pedido de ${storeName}`,
                   status: finalStatus as any,
                   createdAt: dbOrder.created_at,
                   pickedUpAt: dbOrder.picked_up_at,
                   deliveredAt: dbOrder.delivered_at,
                   acceptedAt: dbOrder.accepted_at,
                   readyAt: dbOrder.ready_at,
                   receivedAt: dbOrder.received_at,
                   deliveryPin: dbOrder.delivery_pin,
                   deliveryAddress: dbOrder.delivery_address || localOrder?.deliveryAddress,
                   deliveryLat: dbOrder.delivery_lat || localOrder?.deliveryLat,
                   deliveryLng: dbOrder.delivery_lng || localOrder?.deliveryLng,
                   deliveryReference: dbOrder.delivery_reference || localOrder?.deliveryReference,
                   clienteNome: dbOrder.buyer?.name || allUsers[dbOrder.buyer_id]?.name || localOrder?.clienteNome,
                   lojaNome: dbOrder.storefront?.store_name || allUsers[dbOrder.storefront?.partner_id]?.name,
                   motoristaNome: dbOrder.driver?.name || allUsers[dbOrder.driver_id]?.name,
                   criadoPor: localOrder?.criadoPor || dbOrder.buyer_id,
                   origemId: localOrder?.origemId || dbOrder.storefront?.partner_id || dbOrder.seller_storefront_id,
                   destinoId: localOrder?.destinoId || dbOrder.buyer_id,
                   cidadeOrigem: dbOrder.storefront?.partner?.cidade || dbOrder.buyer?.cidade || 'Belém',
                   clienteId: localOrder?.clienteId || (dbOrder.order_type === 'B2C' ? dbOrder.buyer_id : undefined),
                   lojaId: localOrder?.lojaId || (dbOrder.order_type === 'B2B' ? dbOrder.buyer_id : dbOrder.storefront?.partner_id),
                   fornecedorId: localOrder?.fornecedorId || (dbOrder.order_type === 'B2B' ? dbOrder.storefront?.partner_id : undefined),
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
         supabase.removeAllChannels();
         
         supabase.channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (_payload) => {
                get().fetchOrders(userId);
            })
            .subscribe();

         const currentUser = get().users[userId];
         if (currentUser && currentUser.role === 'admin') {
             supabase.channel('public:users')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (_payload) => {
                    get().fetchAllUsers();
                })
                .subscribe();
             
             supabase.channel('public:storefronts')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'storefronts' }, (_payload) => {
                    get().fetchAllUsers();
                })
                .subscribe();
         }
      },

      clearData: async () => {
         try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
               // Admin deletando via RLS. O Supabase JS requer pelo menos um filtro, então filtramos onde ID não é nulo.
               const { error } = await supabase.from('orders').delete().not('id', 'is', null);
               
               if (error) {
                  console.error("Error clearing orders from DB:", error);
                  alert("Erro ao limpar pedidos no banco de dados.");
                  return;
               }
               alert("Todos os pedidos foram excluídos do banco de dados com sucesso!");
            }
         } catch(e) {
            console.error("Exception clearing orders:", e);
         }

         set((state) => {
            const newUsers = state.currentUser ? { [state.currentUser.id]: state.currentUser } : {};
            return { orders: [], orderCounter: 1, rates: DB_DEFAULTS.rates, users: newUsers };
         });
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
         set((state) => ({
            cities: state.cities.map(c => c.id === cityId ? { ...c, rates: { ...c.rates, ...cityRates } } : c)
         }));
         try {
            const { error } = await supabase.from('cities').update({ rates: cityRates }).eq('id', cityId);
            if (error) console.warn("Aviso ao salvar taxas da cidade no Supabase (coluna rates):", error);
         } catch (e) {
            console.warn("Exceção ao atualizar taxas da cidade no banco:", e);
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
         const currentUser = get().currentUser;
         if (!currentUser) return;
         if (autoRefreshInterval) clearInterval(autoRefreshInterval);
         
         // Atualiza os pedidos em segundo plano a cada 20 segundos
         autoRefreshInterval = setInterval(async () => {
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
         }, 20000);
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
