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
  products?: Product[];
}

export interface Order {
  id: string;
  type: 'B2C' | 'B2B' | 'COLETA';
  title?: string;
  quantity?: number;
  status: 'pendente' | 'preparo' | 'em_rota' | 'entregue' | 'cancelado';
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

interface AppState {
  rates: {
    b2c_plat: number; b2c_km: number; b2c_mot_plat: number;
    b2b_plat: number; b2b_km: number; b2b_mot_plat: number;
    col_plat: number; col_km: number; col_mot_plat: number; col_valor: number;
  };
  users: Record<string, User>;
  orders: Order[];
  orderCounter: number;
  currentUser: User | null;
  
  // Ações
  login: (userId: string) => void;
  loginWithCredentials: (email: string, pass: string) => Promise<boolean>;
  registerUser: (data: Omit<User, 'id'>) => Promise<User | null>;
  fetchLojas: () => Promise<void>;
  logout: () => void;
  authorizeMercadoPago: (userId: string, token: string) => void;
  saveRates: (newRates: Partial<AppState['rates']>) => void;
  criarPedido: (tipo: 'B2C' | 'B2B' | 'COLETA', targetId?: string, subTipoMenu?: string, quantity?: number) => Promise<string | undefined>;
  acaoPedido: (orderId: string, action: string) => void;
  setFreteSubsidy: (userId: string, pct: number) => void;
  updateUserStatus: (userId: string, status: 'active' | 'paused' | 'blocked') => void;
  deleteUser: (userId: string) => Promise<void>;
  changePassword: (userId: string, newPassword: string) => void;
  updateUserPrice: (userId: string, b2cPrices?: { popular: number; medio: number; grosso: number }, b2bPrice?: number) => void;
  addProduct: (userId: string, product: Product) => void;
  removeProduct: (userId: string, productId: string) => void;
  clearData: () => void;
}

const DB_DEFAULTS = {
  rates: {
    b2c_plat: 10, b2c_km: 2.00, b2c_mot_plat: 10,
    b2b_plat: 10, b2b_km: 4.00, b2b_mot_plat: 10,
    col_plat: 10, col_km: 8.00, col_mot_plat: 10, col_valor: 50.00
  },
  users: {} // Remover usuários fixos para prevenir vazamento de credenciais
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      rates: DB_DEFAULTS.rates,
      users: DB_DEFAULTS.users,
      orders: [],
      orderCounter: 1,
      currentUser: null, // Usuário não logado inicialmente
      
      login: (userId) => {
        const user = get().users[userId];
        if (user) set({ currentUser: user });
      },

      loginWithCredentials: async (email, pass) => {
        await supabase.auth.signOut(); // Wipe stale sessions

        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error || !authData.user) {
          console.error("Login Error:", error);
          return false;
        }

        const { data: userProfile } = await supabase.from('users').select('*').eq('id', authData.user.id).single();
        if (userProfile) {
          if (userProfile.status === 'blocked') {
            alert('Conta bloqueada pelo administrador.');
            return false;
          }
          
          const appRole = userProfile.role === 'PARTNER' ? 'loja' :
                          userProfile.role === 'SUPPLIER' ? 'fornecedor' :
                          userProfile.role === 'COURIER' ? 'motorista' :
                          userProfile.role === 'ADMIN' ? 'admin' : 'cliente';
          
          // Map DB user to AppUser
          const loggedUser: User = {
            id: userProfile.id,
            role: appRole as Role,
            name: userProfile.name,
            email: userProfile.email,
            cidade: userProfile.cidade,
            bairro: userProfile.bairro,
            lat: userProfile.latitude || 0,
            lng: userProfile.longitude || 0,
            icon: '👤', // Default, we could map based on role
            veiculo: userProfile.vehicle_type === 'MOTO' ? 'Moto' : userProfile.vehicle_type === 'TRUCK' ? 'Caminhão' : userProfile.vehicle_type === 'DUMP_TRUCK' ? 'Caçamba' : undefined,
            status: userProfile.status as 'active'|'paused'|'blocked',
            mpLinked: !!userProfile.mp_merchant_id
          };
          
          set((state) => ({ currentUser: loggedUser, users: { ...state.users, [loggedUser.id]: loggedUser } }));
          return true;
        }

        return false;
      },

      logout: () => set({ currentUser: null }),

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
          email: newUser.email,
          cidade: newUser.cidade,
          bairro: newUser.bairro,
          latitude: newUser.lat,
          longitude: newUser.lng,
          vehicle_type: vehicleType,
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

      fetchLojas: async () => {
        const { data: dbLojas, error } = await supabase
            .from('users')
            .select('*, storefronts(*)')
            .eq('role', 'PARTNER');
            
        if (error) {
            console.error("Erro ao buscar lojas reais:", error);
            return;
        }

        if (dbLojas) {
            set((state) => {
                const newUsers = { ...state.users };
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
                        mpLinked: !!dbUser.mp_merchant_id
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
      
      setFreteSubsidy: (userId, pct) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        const updatedUser = { ...user, freteSubsidyPct: pct };
        const isCurrent = state.currentUser?.id === userId;
        return { 
          users: { ...state.users, [userId]: updatedUser },
          currentUser: isCurrent ? updatedUser : state.currentUser
        };
      }),

      updateUserStatus: (userId, status) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        const updatedUser = { ...user, status };
        const isCurrent = state.currentUser?.id === userId;
        return { 
          users: { ...state.users, [userId]: updatedUser },
          currentUser: isCurrent ? updatedUser : state.currentUser
        };
      }),

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

      updateUserPrice: (userId, b2cPrices, b2bPrice) => set((state) => {
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
      }),

      addProduct: (userId, product) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        const currentProducts = user.products || [];
        const updatedUser = { ...user, products: [...currentProducts, product] };
        const isCurrent = state.currentUser?.id === userId;
        return { 
          users: { ...state.users, [userId]: updatedUser },
          currentUser: isCurrent ? updatedUser : state.currentUser
        };
      }),

      removeProduct: (userId, productId) => set((state) => {
        const user = state.users[userId];
        if (!user || !user.products) return state;
        const updatedUser = { ...user, products: user.products.filter(p => p.id !== productId) };
        const isCurrent = state.currentUser?.id === userId;
        return { 
          users: { ...state.users, [userId]: updatedUser },
          currentUser: isCurrent ? updatedUser : state.currentUser
        };
      }),

      criarPedido: async (tipo, targetId, subTipoMenu, quantity = 1) => {
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

        const novoPedido: Order = {
          id: `PED-${String(state.orderCounter).padStart(3, '0')}`,
          type: tipo,
          status: tipo === 'COLETA' ? 'preparo' : 'pendente',
          criadoPor: currentUser.id,
          origemId: originId,
          destinoId: destId,
          distancia: distKM,
          confirmacao: { entregador: false, recebedor: false },
          motoristaId: null,
          valor: 0,
          quantity,
          taxas: { entregaTotal: 0, entregaMotorista: 0, entregaCliente: 0, entregaLoja: 0, entregaFornecedor: 0, plataformaVenda: 0, plataformaEntrega: 0, plataformaTotal: 0, repasse: 0 }
        };

        if (tipo === 'B2C' && subTipoMenu && targetId) {
          const loja = state.users[targetId];
          let productPrice = 0;
          let productName = '';
          let isCustomProduct = false;

          if (subTipoMenu === 'popular' || subTipoMenu === 'medio' || subTipoMenu === 'grosso') {
              productPrice = loja.priceB2C![subTipoMenu as keyof typeof loja.priceB2C] || 0;
              productName = subTipoMenu;
          } else {
              const customProd = loja.products?.find(p => p.id === subTipoMenu);
              if (customProd) {
                  isCustomProduct = true;
                  productPrice = customProd.price;
                  productName = customProd.name;
              }
          }

          novoPedido.title = isCustomProduct ? `${productName} (${loja.name})` : `Açaí ${productName} (${loja.name})`;
          novoPedido.clienteId = currentUser.id;
          novoPedido.lojaId = targetId;
          novoPedido.valor = productPrice;
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
            novoPedido.title = `${quantity}x Paneiros (${forn.name})`;
            novoPedido.valor = (forn.priceB2B || 0) * quantity;
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
              cartItems: [{
                id: subTipoMenu || tipo,
                quantity: quantity
              }]
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

          if (mpData && mpData.init_point) {
             // Save to local state using DB generated ID
             const finalPedido = { ...novoPedido, id: dbOrder.id };
             set({ orders: [finalPedido, ...get().orders], orderCounter: get().orderCounter + 1 });
             // Return the checkout URL so the frontend can redirect
             return mpData.init_point;
          }
          
        } catch(e) {
            console.error("Fatal exception during checkout:", e);
        }

      },

      acaoPedido: (orderId, action) => {
        set((state) => {
          const newOrders = state.orders.map(o => {
            if (o.id !== orderId) return o;
            const newOrder = { ...o };
            if (action === 'cancelar_pedido' || action === 'cancelar_cliente') newOrder.status = 'cancelado';
            if (action === 'aceitar_loja' || action === 'aceitar_forn') newOrder.status = 'preparo';
            if (action === 'aceitar_motorista') { newOrder.status = 'em_rota'; newOrder.motoristaId = state.currentUser?.id || null; }
            if (action === 'conf_motorista') {
              newOrder.confirmacao.entregador = true;
              if (newOrder.type === 'COLETA') newOrder.confirmacao.recebedor = true;
            }
            if (action === 'conf_recebedor') newOrder.confirmacao.recebedor = true;
            
            if (newOrder.confirmacao.entregador && newOrder.confirmacao.recebedor) newOrder.status = 'entregue';
            return newOrder;
          });
          return { orders: newOrders };
        });
      },

      clearData: () => set((state) => {
         const newUsers = state.currentUser ? { [state.currentUser.id]: state.currentUser } : {};
         return { orders: [], orderCounter: 1, rates: DB_DEFAULTS.rates, users: newUsers };
      })
    }),
    { name: 'acaifood-storage-v4' }
  )
);
