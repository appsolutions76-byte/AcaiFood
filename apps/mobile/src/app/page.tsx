"use client";

import React, { useState } from "react";
import { ShoppingBag, Search, Star, Package, User, MapPin } from "lucide-react";
import Link from "next/link";

const PRODUCTS = [
  { id: 1, name: "Açaí Tradicional 500ml", price: 18.90, category: "Varejo", rating: 4.8, img: "https://images.unsplash.com/photo-1555122189-9a2c307e5e26?auto=format&fit=crop&q=80&w=400&h=300" },
  { id: 2, name: "Açaí com Morango 700ml", price: 24.90, category: "Varejo", rating: 4.9, img: "https://images.unsplash.com/photo-1626200419189-3b58be40cad6?auto=format&fit=crop&q=80&w=400&h=300" },
  { id: 3, name: "Caixa Açaí Puro 10 Litros", price: 120.00, category: "Atacado", rating: 5.0, img: "https://images.unsplash.com/photo-1590393802688-29bfcfdfbfae?auto=format&fit=crop&q=80&w=400&h=300" },
  { id: 4, name: "Combo Açaí + Acompanhamentos", price: 35.00, category: "Varejo", rating: 4.7, img: "https://images.unsplash.com/photo-1596645089304-43403d6d028e?auto=format&fit=crop&q=80&w=400&h=300" },
];

export default function Storefront() {
  const [activeTab, setActiveTab] = useState<"Varejo" | "Atacado">("Varejo");
  const [cartCount, setCartCount] = useState(0);

  const filteredProducts = PRODUCTS.filter(p => p.category === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-purple-900 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-100">Açaí<span className="text-white">Food</span></h1>
            <p className="text-xs text-purple-300 flex items-center gap-1 mt-1">
              <MapPin size={12} /> Entregando em Belém, PA
            </p>
          </div>
          <div className="relative">
            <Link href="/checkout">
              <div className="bg-purple-800 p-2 rounded-full cursor-pointer hover:bg-purple-700 transition">
                <ShoppingBag size={24} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="bg-purple-900 px-4 pb-6 pt-2 rounded-b-3xl shadow-sm">
        <div className="max-w-5xl mx-auto relative">
          <input 
            type="text" 
            placeholder="Buscar açaí, combos, caixas..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl text-gray-800 outline-none shadow-inner"
          />
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 mt-6">
        {/* Toggle Varejo / Atacado */}
        <div className="flex bg-gray-200 p-1 rounded-2xl mb-6">
          <button 
            onClick={() => setActiveTab("Varejo")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "Varejo" ? "bg-white text-purple-900 shadow-sm" : "text-gray-500"}`}
          >
            Para Consumo (Varejo)
          </button>
          <button 
            onClick={() => setActiveTab("Atacado")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${activeTab === "Atacado" ? "bg-purple-100 text-purple-900 shadow-sm" : "text-gray-500"}`}
          >
            <Package size={16} /> Para Revenda (Atacado)
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {activeTab === "Varejo" ? "Mais Pedidos da Região" : "Caixas & Distribuidores"}
        </h2>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition">
              <div className="h-32 bg-gray-200 overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.img} alt={product.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-gray-700">{product.rating}</span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-gray-800 text-sm leading-tight h-10">{product.name}</h3>
                <div className="flex justify-between items-center mt-3">
                  <span className="font-bold text-purple-900">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                  <button 
                    onClick={() => setCartCount(c => c + 1)}
                    className="bg-purple-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-purple-800 active:scale-95 transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Navigation (Mobile Feel) */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 md:hidden z-50">
        <div className="flex flex-col items-center text-purple-900">
          <ShoppingBag size={24} />
          <span className="text-[10px] font-semibold mt-1">Loja</span>
        </div>
        <div className="flex flex-col items-center text-gray-400 hover:text-purple-900 transition">
          <Package size={24} />
          <span className="text-[10px] font-semibold mt-1">Pedidos</span>
        </div>
        <div className="flex flex-col items-center text-gray-400 hover:text-purple-900 transition">
          <User size={24} />
          <span className="text-[10px] font-semibold mt-1">Perfil</span>
        </div>
      </nav>
    </div>
  );
}
