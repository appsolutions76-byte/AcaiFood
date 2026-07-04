"use client";

import React, { useState } from "react";

export default function AdminDashboard() {
  // Triple Split Settings
  const [b2cFee, setB2cFee] = useState("5.00");
  const [b2bFee, setB2bFee] = useState("3.00");
  const [motoboyKm, setMotoboyKm] = useState("1.50");
  const [truckKm, setTruckKm] = useState("5.00");
  const [motoboyPlatformFee, setMotoboyPlatformFee] = useState("10.00");
  const [truckPlatformFee, setTruckPlatformFee] = useState("10.00");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <span className="text-xl font-bold tracking-tight">AçaíFood Admin (Triplo Split)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Master Admin</span>
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Bem-vindo ao painel de controle logístico e financeiro.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Faturamento (Taxa B2C)</div>
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-500">R$ 14.590,00</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Faturamento (Taxa B2B)</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">R$ 38.200,00</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Motoboys Ativos</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">142</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Caminhões Ativos</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">18</div>
          </div>
        </div>

        {/* Global Settings Section (Triplo Split) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold">Taxas da Plataforma (Configuração Individual)</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ajuste as taxas que compõem o Triplo Split para vendas e logística.</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Sales Split */}
            <div className="space-y-4">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">Split de Vendas (Plataforma vs Lojas)</h3>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Taxa Vendas B2C (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={b2cFee}
                    onChange={(e) => setB2cFee(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-zinc-500">%</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Taxa retida pela plataforma em vendas Cliente Final {'->'} Batedeira.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Taxa Vendas B2B (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={b2bFee}
                    onChange={(e) => setB2bFee(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-zinc-500">%</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Taxa retida pela plataforma em vendas Batedeira {'->'} Fornecedor.</p>
              </div>
            </div>
            
            {/* Delivery Split */}
            <div className="space-y-4">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">Split Logístico (Entregadores)</h3>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Frete Motoboy (R$ / KM)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-zinc-500">R$</span>
                    </div>
                    <input 
                      type="number" 
                      value={motoboyKm}
                      onChange={(e) => setMotoboyKm(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="relative w-28">
                    <input 
                      type="number" 
                      value={motoboyPlatformFee}
                      onChange={(e) => setMotoboyPlatformFee(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-zinc-500">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Valor por KM cobrado do cliente, e a % que fica para a plataforma.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Frete Caminhão (R$ / KM)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-zinc-500">R$</span>
                    </div>
                    <input 
                      type="number" 
                      value={truckKm}
                      onChange={(e) => setTruckKm(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="relative w-28">
                    <input 
                      type="number" 
                      value={truckPlatformFee}
                      onChange={(e) => setTruckPlatformFee(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-zinc-500">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Valor por KM cobrado da loja, e a % que fica para a plataforma.</p>
              </div>
            </div>
            
            <div className="md:col-span-2 flex justify-end mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 px-8 rounded-lg transition-colors">
                Salvar Configurações Globais
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
