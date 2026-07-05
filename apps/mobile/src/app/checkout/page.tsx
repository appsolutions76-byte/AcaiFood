"use client";

import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Valores simulados do carrinho
  const subtotal = 43.80; // Produtos (Ex: 1 Pote + 1 Combo)
  const deliveryDistanceKM = 5.2; 
  const isB2B = false;
  
  // O Frete final e as taxas serão calculadas e registradas pelo Supabase
  // graças à nossa arquitetura de Triple Split!

  const handleCheckout = async () => {
    setLoading(true);
    
    // Simular o ID de um parceiro e do cliente logado
    const partnerId = "00000000-0000-0000-0000-000000000001";
    const clientId = "00000000-0000-0000-0000-000000000002";

    try {
      // O INSERT real na tabela que dispara o Triplo Split
      // Como estamos sem auth real no momento, isso pode dar erro de RLS
      // Mas a estrutura do código é esta:
      const { error } = await supabase.from('orders').insert({
        partner_id: partnerId,
        client_id: clientId,
        type: isB2B ? "B2B" : "B2C",
        status: "PENDING_PAYMENT",
        gross_amount: subtotal,
        delivery_distance_km: deliveryDistanceKM,
        payment_method: "PIX",
      });

      if (error) {
        console.warn("Erro ao inserir pedido (possivelmente RLS):", error.message);
        // Em um cenário real, tratariamos o erro aqui.
      }
      
      // Para fins de demonstração da interface:
      setTimeout(() => {
        setSuccess(true);
        setLoading(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 size={64} className="text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">Pedido Confirmado!</h1>
        <p className="text-gray-500 mt-2 mb-8">
          Seu pedido foi processado. O pagamento já foi devidamente dividido (Triplo Split) entre a Plataforma, a Loja e o Entregador!
        </p>
        <Link href="/">
          <button className="bg-purple-900 text-white font-semibold py-3 px-8 rounded-xl hover:bg-purple-800 transition">
            Voltar para o Catálogo
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white p-4 sticky top-0 z-50 border-b border-gray-200">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/">
            <ArrowLeft className="text-gray-800" size={24} />
          </Link>
          <h1 className="text-lg font-bold text-gray-800">Finalizar Pedido</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-24 space-y-6">
        
        {/* Endereço */}
        <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="text-purple-900" size={20} />
            <h2 className="font-semibold text-gray-800">Entregar em</h2>
          </div>
          <p className="text-sm text-gray-600">Av. Nazaré, 1000 - Nazaré</p>
          <p className="text-xs text-gray-400 mt-1">Belém, PA • Distância: {deliveryDistanceKM} km</p>
        </section>

        {/* Resumo */}
        <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Resumo da Compra</h2>
          
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal (Produtos)</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Frete (Cálculo Automático)</span>
              <span>A calcular no BD</span>
            </div>
          </div>
          
          <div className="border-t border-dashed border-gray-200 my-4"></div>
          
          <div className="flex justify-between items-center font-bold text-gray-800">
            <span>Total Inicial</span>
            <span className="text-purple-900 text-lg">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
          </div>
        </section>

        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <ShieldCheck size={14} /> Sistema com Triplo Split Integrado
        </p>

      </main>

      {/* Checkout Button */}
      <div className="fixed bottom-0 w-full bg-white p-4 border-t border-gray-200">
        <div className="max-w-lg mx-auto">
          <button 
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-purple-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-purple-800 active:scale-95 transition shadow-md disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? "Processando..." : "Confirmar Pedido (PIX)"}
          </button>
        </div>
      </div>
    </div>
  );
}
