import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

// --- UTILITÁRIOS: Haversine e Coordenadas de Belém ---
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  mercadoPagoToken?: string;
  email?: string;
  password?: string;
  status?: 'active' | 'paused' | 'blocked';
  mpLinked?: boolean;
  pixKey?: string;
  products?: Product[];
}

export interface Order {
  id: string;
  type: 'B2C' | 'B2B' | 'COLETA';
  title?: string;
  quantity?: number;
  items?: { id: string; name: string; quantity: number; price: number }[];
  status: 'pendente' | 'preparo' | 'pronto' | 'em_rota' | 'aguardando_cliente' | 'entregue' | 'arquivado' | 'cancelado';
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
}

export interface City {
  id: string;
  name: string;
  status: 'active' | 'paused';
}

interface AppState {
  cities: City[];
  rates: {
    b2c_plat: number; b2c_km: number; b2c_mot_plat: number;
    b2b_plat: number; b2b_km: number; b2b_mot_plat: number;
    col_plat: number; col_km: number; col_mot_plat: number; col_valor: number;
    payout_time?: string;
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
  authorizeMercadoPago: (userId: string, token: string) => void;
  saveRates: (newRates: Partial<AppState['rates']>) => void;
  criarPedido: (tipo: 'B2C' | 'B2B' | 'COLETA', targetId?: string, subTipoMenu?: string, quantity?: number) => Promise<string | undefined>;
  acaoPedido: (orderId: string, action: string) => Promise<void>;
  setFreteSubsidy: (userId: string, pct: number) => Promise<void>;
  updateUserStatus: (userId: string, status: 'active' | 'paused' | 'blocked') => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  changePassword: (userId: string, newPassword: string) => void;
  updateUserPrice: (userId: string, b2cPrices?: { popular: number; medio: number; grosso: number }, b2bPrice?: number) => Promise<void>;
  addProduct: (userId: string, product: Product) => Promise<void>;
  removeProduct: (userId: string, productId: string) => Promise<void>;
  fetchOrders: (userId: string) => Promise<void>;
  fetchAllUsers: () => Promise<void>;
  setupRealtime: (userId: string) => void;
  clearData: () => Promise<void>;
  setClearPassword: (pwd: string) => void;

  // Cidades
  fetchCities: () => Promise<void>;
  addCity: (name: string) => Promise<void>;
  updateCityStatus: (id: string, status: 'active' | 'paused') => Promise<void>;
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
let supabaseChannel: any = null;
let autoRefreshInterval: any = null;

const DB_DEFAULTS = {
  rates: {
    b2c_plat: 10, b2c_km: 2.00, b2c_mot_plat: 10,
    b2b_plat: 10, b2b_km: 4.00, b2b_mot_plat: 10,
    col_plat: 10, col_km: 8.00, col_mot_plat: 10, col_valor: 50.00,
    payout_time: '22:00'
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
            mpLinked: !!userProfile.mp_merchant_id,
            priceB2B: sf?.price_b2b,
            priceB2C: sf ? {
                popular: sf.price_b2c_popular || 20,
                medio: sf.price_b2c_medio || 26,
                grosso: sf.price_b2c_grosso || 35
            } : undefined,
            freteSubsidyPct: sf?.frete_subsidy_pct || 0,
            pixKey: userProfile.pix_key,
            products: sf?.products || []
          };
          
          set((state) => ({ currentUser: loggedUser, users: { ...state.users, [loggedUser.id]: loggedUser } }));
          get().setupRealtime(loggedUser.id);
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

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email || '',
          password: data.password || '123456',
        });

        if (authError || !authData.user) {
          console.error("Auth Signup Error:", authError);
          alert(`Erro ao registrar: ${authError?.message}`);
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

        const { error: dbError } = await supabase.from('users').insert({
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
          status: 'active'
        });

        if (dbError) {
          console.error("DB Insert Error:", dbError);
          alert(`Erro ao salvar perfil no banco de dados: ${dbError.message || JSON.stringify(dbError)}`);
          return null;
        }

        // If it's a partner, create storefront
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
        }

        const state = get();
        set({ users: { ...state.users, [newUser.id]: newUser }, currentUser: newUser });
        return newUser;
      },
      
      addToCart: (storeId, item) => {
        set(state => {
          // If trying to add from a different store, clear the cart first
          const currentStoreId = state.cart.storeId;
          let newItems = currentStoreId === storeId ? [...state.cart.items] : [];
          
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
          
          if (supabaseChannel) {
              supabaseChannel.unsubscribe();
          }

          supabaseChannel = supabase.channel('schema-db-changes')
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'orders' },
                  (payload) => {
                      console.log("Realtime order update received:", payload);
                      // Para garantir consistência dos JOINs (nomes de loja, clientes, etc),
                      // a forma mais robusta é refazer o fetchOrders quando algo muda
                      get().fetchOrders(currentUser.id);
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
                            popular: sf?.price_b2c_popular || 20,
                            medio: sf?.price_b2c_medio || 26,
                            grosso: sf?.price_b2c_grosso || 35
                        },
                        freteSubsidyPct: sf?.frete_subsidy_pct || 0,
                        mpLinked: !!dbUser.mp_merchant_id,
                        pixKey: dbUser.pix_key,
                        products: sf?.products || []
                    };
                });
                return { users: newUsers };
            });
        }
      },

      fetchAllUsers: async () => {
        const { data: dbUsers, error } = await supabase
            .from('users')
            .select('*, storefronts(*, products(*))');
            
        if (error) {
            console.error("Erro ao buscar todos os usuários:", error);
            return;
        }

        if (dbUsers) {
            set((state) => {
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
                        priceB2B: sf?.price_b2b,
                        priceB2C: {
                            popular: sf?.price_b2c_popular || 20,
                            medio: sf?.price_b2c_medio || 26,
                            grosso: sf?.price_b2c_grosso || 35
                        },
                        freteSubsidyPct: sf?.frete_subsidy_pct || 0,
                        mpLinked: !!dbUser.mp_merchant_id,
                        pixKey: dbUser.pix_key,
                        products: sf?.products || []
                    };
                });
                return { users: newUsers };
            });
        }
      },

      authorizeMercadoPago: (userId, token) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          const updatedUser = { ...user, mercadoPagoToken: token };
          const isCurrent = state.currentUser?.id === userId;
          return { 
            users: { ...state.users, [userId]: updatedUser },
            currentUser: isCurrent ? updatedUser : state.currentUser
          };
        });
      },

      saveRates: (newRates) => set((state) => ({ rates: { ...state.rates, ...newRates } })),
      
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
        const { error } = await supabase.from('storefronts').update({ frete_subsidy_pct: pct }).eq('partner_id', userId);
        if (error) console.error("Error updating subsidy in DB:", error);
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
            const { error } = await supabase.from('storefronts').update(updates).eq('partner_id', userId);
            if (error) console.error("Error updating prices in DB:", error);
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

      criarPedido: async (tipo, targetId) => {
        const state = get();
        if (!state.currentUser) return;
        const currentUser = state.currentUser;
        
        let originId = currentUser.id;
        let destId = targetId || '';

        if (tipo === 'B2C' || tipo === 'B2B') { originId = targetId || ''; destId = currentUser.id; }
        if (tipo === 'COLETA') { destId = 'ecoponto'; }

        const p1 = state.users[originId];
        const p2 = state.users[destId];
        const distKM = (p1?.lat && p2?.lat) ? haversineKm(p1.lat, p1.lng!, p2.lat, p2.lng!) : 0;

        const calcFrete = (t: string, d: number) => {
          if (t === 'B2C') return d * state.rates.b2c_km;
          if (t === 'B2B') return d * state.rates.b2b_km;
          if (t === 'COLETA') return d * state.rates.col_km;
          return 0;
        };

        const cartItems = state.cart.items;
        if (cartItems.length === 0 && tipo !== 'COLETA') {
            alert('Seu carrinho está vazio.');
            return;
        }

        const itemsTotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const totalQuantity = cartItems.reduce((acc, item) => acc + item.quantity, 0);

        const novoPedido: Order = {
          id: `PED-${String(state.orderCounter).padStart(3, '0')}`,
          type: tipo,
          status: tipo === 'COLETA' ? 'pronto' : 'pendente',
          criadoPor: currentUser.id,
          origemId: originId,
          destinoId: destId,
          distancia: distKM,
          confirmacao: { entregador: false, recebedor: false },
          motoristaId: null,
          valor: itemsTotal,
          quantity: totalQuantity,
          items: cartItems,
          taxas: { entregaTotal: 0, entregaMotorista: 0, entregaCliente: 0, entregaLoja: 0, entregaFornecedor: 0, plataformaVenda: 0, plataformaEntrega: 0, plataformaTotal: 0, repasse: 0 }
        };

        if (tipo === 'B2C' && targetId) {
          const loja = state.users[targetId];
          const titles = cartItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
          
          novoPedido.title = `${titles} (${loja.name})`;
          novoPedido.clienteId = currentUser.id;
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

        // Apenas salva localmente após o sucesso e com o ID real
        
        // 1. Insert into Supabase Orders table
        try {
          let sellerStorefrontId = targetId;
          
          if (targetId) {
             const { data: sf } = await supabase.from('storefronts').select('id').eq('partner_id', targetId).single();
             if (sf) {
                 sellerStorefrontId = sf.id;
             }
          }

          const { data: dbOrder, error: dbError } = await supabase.from('orders').insert({
            buyer_id: currentUser.id,
            seller_storefront_id: sellerStorefrontId,
            order_type: tipo === 'COLETA' ? 'B2C' : tipo, // Evita crash de constraint
            status: 'PENDING',
            products_subtotal: novoPedido.valor,
            delivery_distance_km: novoPedido.distancia || 0,
            applied_platform_fee_percent: tipo === 'B2C' ? state.rates.b2c_plat : state.rates.b2b_plat,
            applied_delivery_fee_per_km: tipo === 'B2C' ? state.rates.b2c_km : state.rates.b2b_km,
            applied_delivery_platform_fee_percent: state.rates.b2c_mot_plat
          }).select().single();

          if (dbError) {
              console.error("Erro ao salvar pedido no DB:", dbError);
              return;
          }

          // 2. Invoke Mercado Pago Edge Function
          const { data: { session } } = await supabase.auth.getSession();
            const { data: mpData, error: mpError } = await supabase.functions.invoke('mp-checkout', {
              body: { 
                orderId: dbOrder.id,
                cartItems: cartItems.map(item => ({
                  id: item.id,
                  quantity: item.quantity
                })),
                origin: typeof window !== 'undefined' ? window.location.origin : ''
              },
            headers: {
              Authorization: `Bearer ${session?.access_token || ''}`
            }
          });

          if (mpError) {
            console.error("Erro ao chamar MP Edge Function:", mpError);
            alert(`Erro ao conectar com o Mercado Pago: ${mpError.message || JSON.stringify(mpError)}`);
            return;
          }

          if (mpData && mpData.error) {
            console.error("Erro retornado pela Edge Function:", mpData.error);
            alert(`Pagamento não habilitado: ${mpData.error}`);
            return;
          }

          if (mpData && mpData.init_point) {
             // Save to local state using DB generated ID
             const finalPedido = { ...novoPedido, id: dbOrder.id };
             set({ 
                orders: [finalPedido, ...get().orders], 
                orderCounter: get().orderCounter + 1,
                cart: { storeId: null, items: [] } // Clear cart on success
             });
             // Return the checkout URL so the frontend can redirect
             return mpData.init_point;
          }
          
        } catch(e) {
            console.error("Fatal exception during checkout:", e);
        }

      },

      acaoPedido: async (orderId, action) => {
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
                 .eq('status', 'DELIVERED');
                 
             if (error) console.error("Error paying motorista:", error);
             return;
        }

        if (action === 'deletar_pedido') {
            const { error } = await supabase.from('orders').delete().eq('id', orderId);
            if (!error) {
                set((state) => ({ orders: state.orders.filter(o => o.id !== orderId) }));
            } else {
                console.error("Error deleting order:", error);
                alert("Erro ao excluir pedido.");
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
            if (action === 'aceitar_loja' || action === 'aceitar_forn') { newOrder.status = 'preparo'; newDbStatus = 'PREPARING'; }
            if (action === 'chamar_moto') { newOrder.status = 'pronto'; newDbStatus = 'READY'; }
            if (action === 'aceitar_motorista') { newOrder.status = 'em_rota'; newOrder.motoristaId = state.currentUser?.id || null; newDbStatus = 'DELIVERING'; driverId = newOrder.motoristaId; }
            if (action === 'conf_motorista') {
              newOrder.status = 'aguardando_cliente';
              newDbStatus = 'DELIVERED';
            }
            if (action === 'conf_recebedor') {
              newOrder.status = 'entregue';
              newDbStatus = 'DELIVERED';
            }
            return newOrder;
          });
          return { orders: newOrders };
        });

        const updates: any = {};
        if (newDbStatus) updates.status = newDbStatus;
        if (driverId) updates.driver_id = driverId;

        if (Object.keys(updates).length > 0) {
           const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
           if (error) console.error("Error updating order in DB:", error);
        }

        if (newDbStatus === 'CANCELLED') {
           try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                 const { data, error } = await supabase.functions.invoke('mp-refund', {
                    body: { orderId },
                    headers: { Authorization: `Bearer ${session.access_token}` }
                 });
                 if (error) console.error("Error invoking mp-refund:", error);
                 else console.log("Refund response:", data);
              }
           } catch(e) {
              console.error("Exception invoking mp-refund:", e);
           }
        }
      },

      fetchOrders: async (userId) => {
         const state = get();
         const currentUser = state.users[userId];
         if (!currentUser) return;

         let query = supabase.from('orders').select(`
            id, order_type, status, products_subtotal, delivery_distance_km, 
            applied_platform_fee_percent, applied_delivery_fee_per_km, applied_delivery_platform_fee_percent,
            buyer_id, seller_storefront_id, driver_id, created_at,
            buyer:users!orders_buyer_id_fkey(id, name, latitude, longitude),
            storefront:storefronts!orders_seller_storefront_id_fkey(id, partner_id, store_name),
            driver:users!orders_driver_id_fkey(id, name)
         `);

         if (currentUser.role === 'loja' || currentUser.role === 'fornecedor') {
            const { data: sf } = await supabase.from('storefronts').select('id').eq('partner_id', currentUser.id).single();
            if (sf) {
                query = query.eq('seller_storefront_id', sf.id);
            }
         } else if (currentUser.role === 'cliente') {
            query = query.eq('buyer_id', currentUser.id);
         } else if (currentUser.role === 'motorista') {
            query = query.or(`status.in.("READY","PREPARING","DELIVERING"),driver_id.eq.${currentUser.id}`);
         } else if (currentUser.role === 'admin') {
            // Admin sees all orders
         } else {
            return;
         }

         query = query.order('created_at', { ascending: false });
         const { data: dbOrders, error } = await query;
         
         if (dbOrders && !error) {
             const mappedOrders = dbOrders.map((dbOrder: any) => {
                let appStatus = 'pendente';
                if (dbOrder.status === 'PREPARING') appStatus = 'preparo';
                if (dbOrder.status === 'READY') appStatus = 'pronto';
                if (dbOrder.status === 'IN_TRANSIT' || dbOrder.status === 'DELIVERING') appStatus = 'em_rota';
                if (dbOrder.status === 'DELIVERED') appStatus = 'entregue';
                if (dbOrder.status === 'COMPLETED') appStatus = 'arquivado';
                if (dbOrder.status === 'CANCELLED') appStatus = 'cancelado';

                const storeName = dbOrder.storefront?.store_name || 'Loja';
                const localOrder = state.orders.find(o => o.id === dbOrder.id);
                
                const deliveryTotal = (dbOrder.delivery_distance_km || 0) * (dbOrder.applied_delivery_fee_per_km || 0);
                const platformDelivery = deliveryTotal * ((dbOrder.applied_delivery_platform_fee_percent || 0) / 100);
                const driverAmount = deliveryTotal - platformDelivery;

                return {
                   ...(localOrder || {}),
                   id: dbOrder.id,
                   type: dbOrder.order_type as 'B2C'|'B2B'|'COLETA',
                   title: localOrder?.title || `Pedido de ${storeName}`,
                   status: appStatus as any,
                   criadoPor: localOrder?.criadoPor || dbOrder.buyer_id,
                   origemId: localOrder?.origemId || dbOrder.storefront?.partner_id || dbOrder.seller_storefront_id,
                   destinoId: localOrder?.destinoId || dbOrder.buyer_id,
                   clienteId: localOrder?.clienteId || dbOrder.buyer_id,
                   lojaId: localOrder?.lojaId || dbOrder.storefront?.partner_id,
                   distancia: dbOrder.delivery_distance_km,
                   valor: dbOrder.products_subtotal,
                   motoristaId: dbOrder.driver_id,
                   confirmacao: localOrder?.confirmacao || { entregador: !!dbOrder.driver_id, recebedor: appStatus === 'entregue' },
                   taxas: localOrder?.taxas || {
                       entregaTotal: deliveryTotal,
                       entregaMotorista: driverAmount,
                       entregaCliente: deliveryTotal,
                       entregaLoja: 0,
                       entregaFornecedor: 0,
                       plataformaVenda: (dbOrder.products_subtotal || 0) * ((dbOrder.applied_platform_fee_percent || 0) / 100),
                       plataformaEntrega: platformDelivery,
                       plataformaTotal: platformDelivery + ((dbOrder.products_subtotal || 0) * ((dbOrder.applied_platform_fee_percent || 0) / 100)),
                       repasse: dbOrder.products_subtotal - ((dbOrder.products_subtotal || 0) * ((dbOrder.applied_platform_fee_percent || 0) / 100))
                   }
                };
             });

             set({ orders: mappedOrders });
         }
      },

      setupRealtime: (userId) => {
         supabase.removeAllChannels();
         
         supabase.channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                get().fetchOrders(userId);
            })
            .subscribe();

         const currentUser = get().users[userId];
         if (currentUser && currentUser.role === 'admin') {
             supabase.channel('public:users')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
                    get().fetchAllUsers();
                })
                .subscribe();
             
             supabase.channel('public:storefronts')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'storefronts' }, (payload) => {
                    get().fetchAllUsers();
                })
                .subscribe();
         }
      },

      clearData: async () => {
         try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
               const { error } = await supabase.functions.invoke('clear-orders', {
                  headers: { Authorization: `Bearer ${session.access_token}` }
               });
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
         
         // Atualiza a cada 30 segundos
         autoRefreshInterval = setInterval(() => {
             console.log("Auto-refreshing orders...");
             get().fetchOrders(currentUser.id);
         }, 30000);
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
        if (!error && state?.currentUser) {
          setTimeout(() => {
            state.setupRealtime(state.currentUser!.id);
            state.fetchOrders(state.currentUser!.id);
            state.startAutoRefresh();
            state.fetchCities(); // Carregar cidades iniciais
          }, 50);
        }
      }
    }
  )
);
