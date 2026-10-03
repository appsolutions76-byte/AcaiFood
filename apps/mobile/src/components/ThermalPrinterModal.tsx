'use client';

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Bluetooth, 
  Check, 
  RefreshCw, 
  X, 
  Power, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Info,
  Sliders,
  Smartphone,
  Leaf
} from 'lucide-react';
import { 
  PrinterConfig, 
  PrinterProfile,
  PaperSavingMode,
  TicketLayout,
  getPrinterConfig, 
  savePrinterConfig, 
  printTestTicket 
} from '@/lib/thermalPrinter';
import { 
  isWebBluetoothSupported, 
  getConnectedBluetoothDeviceName, 
  connectBluetoothPrinter, 
  disconnectBluetoothPrinter,
  subscribeBluetoothStatus,
  autoReconnectBluetoothPrinter
} from '@/lib/bluetoothPrinter';

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
}

export const ThermalPrinterModal: React.FC<ThermalPrinterModalProps> = ({
  isOpen,
  onClose,
  storeName = 'Batedeira / Loja AçaíFood'
}) => {
  const [config, setConfig] = useState<PrinterConfig>(getPrinterConfig);
  const [btSupported, setBtSupported] = useState(true);
  const [btConnected, setBtConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBtSupported(isWebBluetoothSupported());
      setConfig(getPrinterConfig());
    }

    if (isOpen) {
      autoReconnectBluetoothPrinter();
    }

    const unsubscribe = subscribeBluetoothStatus((connected, name) => {
      setBtConnected(connected);
      setDeviceName(name);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateConfig = (partial: Partial<PrinterConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    savePrinterConfig(updated);
  };

  const handleSelectProfile = (profile: PrinterProfile) => {
    let paperWidth: '58mm' | '80mm' = '58mm';
    let customColumns = 32;
    let hasCutter = false;

    if (profile === 'generic-58mm') {
      paperWidth = '58mm';
      customColumns = 32;
      hasCutter = false;
    } else if (profile === 'compact-58mm') {
      paperWidth = '58mm';
      customColumns = 42;
      hasCutter = false;
    } else if (profile === 'generic-80mm') {
      paperWidth = '80mm';
      customColumns = 48;
      hasCutter = true;
    } else if (profile === 'large-80mm') {
      paperWidth = '80mm';
      customColumns = 42;
      hasCutter = true;
    }

    handleUpdateConfig({
      profile,
      paperWidth,
      customColumns,
      hasCutter
    });
  };

  const handleConnectBluetooth = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const res = await connectBluetoothPrinter();
      if (res.success) {
        setBtConnected(true);
        setDeviceName(res.name);
        setStatusMessage({ text: `Conectado com sucesso a: ${res.name}`, type: 'success' });
        handleUpdateConfig({ connectionType: 'bluetooth' });
      } else {
        setStatusMessage({ text: res.error || 'Não foi possível conectar.', type: 'error' });
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Erro inesperado na conexão Bluetooth.', type: 'error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectBluetooth = async () => {
    await disconnectBluetoothPrinter();
    setBtConnected(false);
    setDeviceName(undefined);
    setStatusMessage({ text: 'Impressora Bluetooth desconectada.', type: 'info' });
  };

  const handleTestPrint = async () => {
    setStatusMessage({ text: 'Enviando teste de impressão...', type: 'info' });
    try {
      const res = await printTestTicket(storeName, config);
      if (res.success) {
        setStatusMessage({ 
          text: config.connectionType === 'bluetooth' && btConnected 
            ? '✅ Cupom impresso na impressora Bluetooth!' 
            : config.connectionType === 'rawbt'
            ? '✅ Enviado para o app RawBT!'
            : '✅ Janela de impressão enviada.', 
          type: 'success' 
        });
      } else {
        setStatusMessage({ text: res.message || 'Erro ao emitir teste.', type: 'error' });
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Falha no teste.', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[250] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800 my-auto">
        
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Printer className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Configurações de Impressora</h3>
              <p className="text-xs text-purple-200">Compatibilidade Universal (58mm & 80mm - Qualquer Marca)</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Card de Conexão Bluetooth Direta */}
          <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bluetooth className={`w-5 h-5 ${btConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`} />
                <span className="font-bold text-sm text-zinc-900 dark:text-white">
                  Conexão Bluetooth Direta (BLE / ESC-POS)
                </span>
              </div>
              
              {btConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conectado
                </span>
              ) : (
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                  Desconectado
                </span>
              )}
            </div>

            {btConnected ? (
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/40">
                <div className="min-w-0 pr-2">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Aparelho Conectado:</p>
                  <p className="text-sm font-bold text-purple-950 dark:text-purple-200 truncate">
                    {deviceName || 'Impressora Bluetooth'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectBluetooth}
                  className="shrink-0 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Power size={14} /> Desconectar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Ligue sua impressora (DIR-E58V, GoldenSky, Elgin, Epson, Bematech, Xprinter ou qualquer modelo Bluetooth) e clique abaixo:
                </p>
                
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleConnectBluetooth}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Buscando dispositivos...
                    </>
                  ) : (
                    <>
                      <Bluetooth size={16} /> Parear Impressora Bluetooth
                    </>
                  )}
                </button>
              </div>
            )}

            {!btSupported && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span>Para pareamento direto via Bluetooth pelo navegador, use o <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong> no Android ou Windows.</span>
              </div>
            )}
          </div>

          {/* Feedback de Mensagem */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* SELETOR DE FORMATO DO CUPOM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-1">
                <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                Formato do Cupom
              </label>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                {config.ticketLayout === 'detailed' ? '⚡ Completo (~13 a 14 cm)' : '🍃 Ultra Compacto (~9 a 11 cm)'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ ticketLayout: 'detailed' })}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.ticketLayout === 'detailed'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>⚡ Completo & Operacional</span>
                  {config.ticketLayout === 'detailed' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">
                  Distância (km), frete detalhado com subsídio da loja, PIN com instruções e rodapé legal Asaas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ ticketLayout: 'compact', paperSavingMode: 'ultra', feedLines: 2 })}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.ticketLayout === 'compact'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>🍃 Ultra Compacto</span>
                  {config.ticketLayout === 'compact' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">
                  Economia máxima de bobina (~9 a 11 cm), linhas reduzidas e rodapé direto.
                </p>
              </button>
            </div>
          </div>

          {/* Economia de Papel & Altura do Cupom */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-1">
                <Leaf size={14} className="text-emerald-600 dark:text-emerald-400" />
                Espaçamento & Entrelinhas
              </label>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                {config.paperSavingMode === 'ultra' ? '🍃 Reduz 60% do papel' : config.paperSavingMode === 'standard' ? '⚡ Padrão' : '🔍 Espaçoso'}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ paperSavingMode: 'ultra', feedLines: 2 })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.paperSavingMode === 'ultra'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>🍃 Ultra Econômico</span>
                  {config.paperSavingMode === 'ultra' && <Check size={13} />}
                </div>
                <p className="text-[9px] font-normal opacity-85">Entrelinhas reduzido (20 dots)</p>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ paperSavingMode: 'standard', feedLines: 2 })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.paperSavingMode === 'standard'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>⚡ Equilibrado</span>
                  {config.paperSavingMode === 'standard' && <Check size={13} />}
                </div>
                <p className="text-[9px] font-normal opacity-85">Entrelinhas padrão (24 dots)</p>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ paperSavingMode: 'spacious', feedLines: 4 })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.paperSavingMode === 'spacious'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>🔍 Espaçoso</span>
                  {config.paperSavingMode === 'spacious' && <Check size={13} />}
                </div>
                <p className="text-[9px] font-normal opacity-85">Espaçamento tradicional</p>
              </button>
            </div>
          </div>

          {/* Perfis de Compatibilidade Universal */}
          <div>
            <label className="text-xs uppercase text-zinc-500 dark:text-zinc-400 font-bold block mb-1.5">
              Perfil da Impressora
            </label>
            <div className="grid grid-cols-2 gap-2">
              
              <button
                type="button"
                onClick={() => handleSelectProfile('generic-58mm')}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.profile === 'generic-58mm'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>📜 Genérica 58mm (32 Col.)</span>
                  {config.profile === 'generic-58mm' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">DIR-E58V, GoldenSky, POS-58, Goojprt, Mini POS</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectProfile('generic-80mm')}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.profile === 'generic-80mm'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>📄 Balcão 80mm (48 Col.)</span>
                  {config.profile === 'generic-80mm' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">Elgin i7/i9, Bematech MP-4200, Epson TM-T20, Daruma</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectProfile('compact-58mm')}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.profile === 'compact-58mm'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>📜 58mm Condensada (42 Col.)</span>
                  {config.profile === 'compact-58mm' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">Fonte compacta para 58mm caber mais texto</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectProfile('large-80mm')}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.profile === 'large-80mm'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>📄 80mm Fonte Grande (42 Col.)</span>
                  {config.profile === 'large-80mm' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">Letras maiores e mais legíveis para balcão</p>
              </button>

            </div>
          </div>

          {/* Método de Envio */}
          <div>
            <label className="text-xs uppercase text-zinc-500 dark:text-zinc-400 font-bold block mb-1.5">
              Método de Envio / Conexão
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ connectionType: 'bluetooth' })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.connectionType === 'bluetooth'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1"><Bluetooth size={13} /> Bluetooth</span>
                  {config.connectionType === 'bluetooth' && <Check size={12} />}
                </div>
                <p className="text-[9px] font-normal opacity-85">Disparo direto sem diálogo</p>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ connectionType: 'browser' })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.connectionType === 'browser'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1"><Printer size={13} /> Sistema / USB</span>
                  {config.connectionType === 'browser' && <Check size={12} />}
                </div>
                <p className="text-[9px] font-normal opacity-85">Driver do Windows/Android</p>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ connectionType: 'rawbt' })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition flex flex-col justify-between cursor-pointer ${
                  config.connectionType === 'rawbt'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1"><Smartphone size={13} /> RawBT App</span>
                  {config.connectionType === 'rawbt' && <Check size={12} />}
                </div>
                <p className="text-[9px] font-normal opacity-85">App ponte Android</p>
              </button>
            </div>
          </div>

          {/* Disparo Automático ou Manual */}
          <div>
            <label className="text-xs uppercase text-zinc-500 dark:text-zinc-400 font-bold block mb-1.5">
              Disparo da Impressão
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ printMode: 'auto' })}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                  config.printMode === 'auto'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="flex items-center gap-1.5"><Sparkles size={14} /> Automático</span>
                  {config.printMode === 'auto' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">Imprime comanda ao aceitar o pedido para preparo</p>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ printMode: 'manual' })}
                className={`p-3 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                  config.printMode === 'manual'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span>👆 Manual</span>
                  {config.printMode === 'manual' && <Check size={14} />}
                </div>
                <p className="text-[10px] font-normal opacity-85">Imprime apenas ao clicar no botão de impressora</p>
              </button>
            </div>
          </div>

          {/* Vias */}
          <div>
            <label className="text-xs uppercase text-zinc-500 dark:text-zinc-400 font-bold block mb-1.5">
              Vias por Pedido
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ copies: 1 })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  config.copies === 1
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                1 Via (Cozinha/Preparo)
              </button>

              <button
                type="button"
                onClick={() => handleUpdateConfig({ copies: 2 })}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  config.copies === 2
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                }`}
              >
                2 Vias (Cozinha + Entrega)
              </button>
            </div>
          </div>

          {/* Configurações Avançadas Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders size={14} /> {showAdvanced ? 'Ocultar Ajustes Avançados' : 'Mostrar Ajustes Avançados (Colunas, Guilhotina, Linhas)'}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Colunas de Caracteres:
                    </label>
                    <select
                      value={config.customColumns || (config.paperWidth === '58mm' ? 32 : 48)}
                      onChange={(e) => handleUpdateConfig({ profile: 'custom', customColumns: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2 font-bold"
                    >
                      <option value={32}>32 Colunas (Padrão 58mm)</option>
                      <option value={40}>40 Colunas</option>
                      <option value={42}>42 Colunas (58mm Condensada)</option>
                      <option value={48}>48 Colunas (Padrão 80mm)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Avanço de Papel Final:
                    </label>
                    <select
                      value={config.feedLines ?? 2}
                      onChange={(e) => handleUpdateConfig({ feedLines: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2 font-bold"
                    >
                      <option value={1}>1 Linha (Mínimo absoluto)</option>
                      <option value={2}>2 Linhas (Econômico Recomendado)</option>
                      <option value={3}>3 Linhas</option>
                      <option value={4}>4 Linhas (Padrão)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Corte Automático com Guilhotina (Autocut):</span>
                  <input
                    type="checkbox"
                    checked={config.hasCutter ?? (config.paperWidth === '80mm')}
                    onChange={(e) => handleUpdateConfig({ hasCutter: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botão Teste de Impressão */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestPrint}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer size={16} /> Imprimir Cupom de Teste Agora
            </button>
          </div>

        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
          >
            Concluir e Salvar
          </button>
        </div>

      </div>
    </div>
  );
};
