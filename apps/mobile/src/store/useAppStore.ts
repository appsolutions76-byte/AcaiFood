import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// --- UTILITÁRIOS: Haversine e Coordenadas de Belém ---
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type Role = 'admin' | 'loja' | 'cliente' | 'motorista' | 'fornecedor' | 'ecoponto';

export interface User {
  id: string;
  role: Role;
  name: string;
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
}

export interface Order {
  id: string;
  type: 'B2C' | 'B2B' | 'COLETA';
  title?: string;
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
  loginWithCredentials: (email: string, pass: string) => boolean;
  registerUser: (data: Omit<User, 'id'>) => User;
  logout: () => void;
  authorizeMercadoPago: (userId: string, token: string) => void;
  saveRates: (newRates: Partial<AppState['rates']>) => void;
  criarPedido: (tipo: 'B2C' | 'B2B' | 'COLETA', targetId?: string, subTipoMenu?: 'popular'|'medio'|'grosso') => void;
  acaoPedido: (orderId: string, action: string) => void;
  setFreteSubsidy: (userId: string, pct: number) => void;
  updateUserStatus: (userId: string, status: 'active' | 'paused' | 'blocked') => void;
  deleteUser: (userId: string) => void;
  updateUserPrice: (userId: string, b2cPrices?: { popular: number; medio: number; grosso: number }, b2bPrice?: number) => void;
  clearData: () => void;
}

const DB_DEFAULTS = {
  rates: {
    b2c_plat: 10, b2c_km: 2.00, b2c_mot_plat: 10,
    b2b_plat: 10, b2b_km: 4.00, b2b_mot_plat: 10,
    col_plat: 10, col_km: 8.00, col_mot_plat: 10, col_valor: 50.00
  },
  users: {
    admin:    { id: 'admin',    role: 'admin' as Role,       name: 'Administração',          icon: '🛠️', email: 'appsolutions76@gmail.com', password: '2953938' },
    loja_1:   { id: 'loja_1',   role: 'loja' as Role,        name: 'Batedeira Ponto Certo',  bairro: 'Guamá',      icon: '🏪', priceB2C: { popular: 20, medio: 26, grosso: 35 }, freteSubsidyPct: 50,  lat: -1.469, lng: -48.499, email: 'loja@teste.com', password: '123' },
    cli_1:    { id: 'cli_1',    role: 'cliente' as Role,     name: 'Maria Oliveira',         bairro: 'Nazaré',     icon: '👤', lat: -1.455, lng: -48.488, email: 'cliente@teste.com', password: '123' },
    mot_1:    { id: 'mot_1',    role: 'motorista' as Role,   name: 'Ana',                    bairro: 'Sacramenta', icon: '🛵', veiculo: 'Moto',    lat: -1.440, lng: -48.468, email: 'moto@teste.com', password: '123' },
    mot_2:    { id: 'mot_2',    role: 'motorista' as Role,   name: 'Beto',                   bairro: 'Entroncamento', icon: '🚚', veiculo: 'Caminhão', lat: -1.396, lng: -48.450, email: 'caminhao@teste.com', password: '123' },
    mot_3:    { id: 'mot_3',    role: 'motorista' as Role,   name: 'Júlio',                  bairro: 'Icoaraci',      icon: '🚛', veiculo: 'Caçamba',  lat: -1.300, lng: -48.480, email: 'cacamba@teste.com', password: '123' },
    forn_1:   { id: 'forn_1',   role: 'fornecedor' as Role,  name: 'Coop. Ribeirinha',       bairro: 'Ver-o-Peso', icon: '👨🌾', priceB2B: 150.00, freteSubsidyPct: 20, lat: -1.455, lng: -48.502, email: 'fornecedor@teste.com', password: '123' },
    ecoponto: { id: 'ecoponto', role: 'ecoponto' as Role,    name: 'Ecoponto Municipal',     bairro: 'Aurá',      icon: '♻️', lat: -1.510, lng: -48.428, email: 'ecoponto@teste.com', password: '123' }
  }
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

      loginWithCredentials: (email, pass) => {
        const state = get();
        const user = Object.values(state.users).find(u => u.email === email && u.password === pass);
        if (user) {
          if (user.status === 'blocked') {
            alert('Conta bloqueada pelo administrador.');
            return false;
          }
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      registerUser: (data) => {
        const state = get();
        const newId = `${data.role}_${Date.now()}`;
        const newUser: User = { ...data, id: newId };
        set({ users: { ...state.users, [newId]: newUser }, currentUser: newUser });
        return newUser;
      },

      authorizeMercadoPago: (userId, token) => {
        set((state) => {
          const user = state.users[userId];
          if (user) {
            user.mercadoPagoToken = token;
          }
          return { users: { ...state.users, [userId]: { ...user } } };
        });
      },

      saveRates: (newRates) => set((state) => ({ rates: { ...state.rates, ...newRates } })),
      
      setFreteSubsidy: (userId, pct) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        return { users: { ...state.users, [userId]: { ...user, freteSubsidyPct: pct } } };
      }),

      updateUserStatus: (userId, status) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        return { users: { ...state.users, [userId]: { ...user, status } } };
      }),

      deleteUser: (userId) => set((state) => {
        const newUsers = { ...state.users };
        delete newUsers[userId];
        return { users: newUsers };
      }),

      updateUserPrice: (userId, b2cPrices, b2bPrice) => set((state) => {
        const user = state.users[userId];
        if (!user) return state;
        const updatedUser = { ...user };
        if (b2cPrices) updatedUser.priceB2C = b2cPrices;
        if (b2bPrice !== undefined) updatedUser.priceB2B = b2bPrice;
        return { users: { ...state.users, [userId]: updatedUser } };
      }),

      criarPedido: (tipo, targetId, subTipoMenu) => {
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
          taxas: { entregaTotal: 0, entregaMotorista: 0, entregaCliente: 0, entregaLoja: 0, entregaFornecedor: 0, plataformaVenda: 0, plataformaEntrega: 0, plataformaTotal: 0, repasse: 0 }
        };

        if (tipo === 'B2C' && subTipoMenu && targetId) {
          const loja = state.users[targetId];
          novoPedido.title = `Açaí ${subTipoMenu} (${loja.name})`;
          novoPedido.clienteId = currentUser.id;
          novoPedido.lojaId = targetId;
          novoPedido.valor = loja.priceB2C![subTipoMenu] || 0;
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
            novoPedido.title = `Lote de Fruto (${forn.name})`;
            novoPedido.valor = forn.priceB2B || 0;
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

        set({ orders: [novoPedido, ...state.orders], orderCounter: state.orderCounter + 1 });
      },

      acaoPedido: (orderId, action) => {
        set((state) => {
          const newOrders = state.orders.map(o => {
            if (o.id !== orderId) return o;
            const newOrder = { ...o };
            if (action === 'cancelar_pedido') newOrder.status = 'cancelado';
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

      clearData: () => set({ orders: [], orderCounter: 1, rates: DB_DEFAULTS.rates })
    }),
    { name: 'acaifood-storage-v4' }
  )
);
