'use client';

import React, { useState, useRef } from 'react';
import { PHOTO_PRESETS, PhotoPreset, compressImageToDataUrl } from '@/lib/photoPresets';
import { Camera, Image as ImageIcon, X, Check, Upload, Trash2 } from 'lucide-react';

interface PhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImageUrl?: string;
  onSelectPhoto: (url: string | undefined) => void;
  title?: string;
  category?: 'acai' | 'adicional' | 'b2b';
}

export function PhotoPickerModal({
  isOpen,
  onClose,
  currentImageUrl,
  onSelectPhoto,
  title = 'Foto do Produto',
  category = 'acai'
}: PhotoPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(currentImageUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const filteredPresets = category 
    ? PHOTO_PRESETS.filter(p => p.category === category || p.category === 'acai' || p.category === 'adicional')
    : PHOTO_PRESETS;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const compressedDataUrl = await compressImageToDataUrl(file, 350, 0.75);
      setSelectedUrl(compressedDataUrl);
    } catch (err) {
      alert('Erro ao processar imagem. Tente uma foto menor.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    onSelectPhoto(selectedUrl);
    onClose();
  };

  const handleRemove = () => {
    setSelectedUrl(undefined);
    onSelectPhoto(undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-purple-50 dark:bg-purple-950/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Preview Banner if Selected */}
        {selectedUrl && (
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={selectedUrl} 
                alt="Preview" 
                className="w-12 h-12 rounded-lg object-cover border border-purple-500 shadow-sm"
              />
              <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Foto Selecionada</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">✓ Otimizada e ultraleve</p>
              </div>
            </div>
            <button 
              onClick={handleRemove}
              className="text-xs text-red-600 hover:text-red-700 font-bold px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1 transition"
            >
              <Trash2 size={13} /> Remover
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'presets'
                ? 'border-purple-600 text-purple-600 bg-white dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <ImageIcon size={15} /> Galeria Pronta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'custom'
                ? 'border-purple-600 text-purple-600 bg-white dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Camera size={15} /> Minha Foto / Câmera
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[50vh]">
          {activeTab === 'presets' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredPresets.map((preset) => {
                const isCurrent = selectedUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedUrl(preset.url)}
                    className={`group relative rounded-xl overflow-hidden border-2 text-left transition-all aspect-square flex flex-col justify-end p-2 ${
                      isCurrent
                        ? 'border-purple-600 ring-2 ring-purple-600/30 shadow-md'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
                    }`}
                  >
                    <img
                      src={preset.thumbnail}
                      alt={preset.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {isCurrent && (
                      <span className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1 shadow">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}

                    <span className="relative z-10 text-white font-bold text-[11px] leading-tight drop-shadow line-clamp-2">
                      {preset.title}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-xs border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-2xl p-6 cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {isProcessing ? 'Comprimindo foto...' : 'Tirar Foto ou Escolher'}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Compressão automática para carregar instantaneamente no cliente
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50 dark:bg-zinc-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <Check size={14} /> Confirmar Foto
          </button>
        </div>
      </div>
    </div>
  );
}
