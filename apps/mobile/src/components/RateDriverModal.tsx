'use client';

import React, { useState, useEffect } from 'react';
import { Star, X, Check, Loader2, Bike, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';

export interface RateDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  driverName?: string;
  driverPhoto?: string;
  onRate: (orderId: string, rating: number, comment?: string) => Promise<void>;
}

const RATING_LABELS: Record<number, { label: string; desc: string; color: string }> = {
  0: { label: '0 estrelas', desc: 'Péssimo — Houve problemas sérios na entrega', color: 'text-red-500' },
  1: { label: '1 estrela', desc: 'Ruim — Entrega insatisfatória', color: 'text-orange-500' },
  2: { label: '2 estrelas', desc: 'Regular — Precisa melhorar', color: 'text-amber-500' },
  3: { label: '3 estrelas', desc: 'Bom — Atendeu o esperado', color: 'text-yellow-500' },
  4: { label: '4 estrelas', desc: 'Muito bom — Entrega rápida e educada', color: 'text-lime-500' },
  5: { label: '5 estrelas', desc: 'Excelente — Perfeito! Rápido, cuidadoso e atencioso', color: 'text-emerald-500' },
};

const QUICK_TAGS_POSITIVE = [
  '⚡ Entrega rápida',
  '🛵 Muito educado',
  '🥣 Açaí intacto e gelado',
  '📍 Achou fácil o endereço',
  '🤝 Ótima comunicação'
];

const QUICK_TAGS_NEGATIVE = [
  '⏳ Atraso excessivo',
  '📦 Produto revirado/vazou',
  '❌ Falta de educação',
  '🗺️ Dificuldade para encontrar endereço',
  '📞 Não respondeu mensagens'
];

export function RateDriverModal({
  isOpen,
  onClose,
  order,
  driverName,
  driverPhoto,
  onRate
}: RateDriverModalProps) {
  const initialRating = order?.driverRating !== undefined && order?.driverRating !== null
    ? Number(order.driverRating)
    : 5;

  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>(order?.driverRatingComment || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existingRating = order?.driverRating !== undefined && order?.driverRating !== null
        ? Number(order.driverRating)
        : 5;
      setRating(existingRating);
      setHoverRating(null);
      setComment(order?.driverRatingComment || '');
      setSelectedTags([]);
      setIsSubmitting(false);
      setSubmitted(false);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const activeRating = hoverRating !== null ? hoverRating : rating;
  const ratingInfo = RATING_LABELS[activeRating] || RATING_LABELS[5];

  const handleTagToggle = (tag: string) => {
    let newTags: string[];
    if (selectedTags.includes(tag)) {
      newTags = selectedTags.filter(t => t !== tag);
    } else {
      newTags = [...selectedTags, tag];
    }
    setSelectedTags(newTags);

    // Adiciona as tags ao comentário de forma inteligente
    const tagPrefix = newTags.length > 0 ? `[${newTags.join(', ')}] ` : '';
    const cleanComment = comment.replace(/^\[.*?\]\s*/, '');
    setComment(tagPrefix + cleanComment);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order?.id) return;

    try {
      setIsSubmitting(true);
      await onRate(order.id, rating, comment.trim());
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Erro ao enviar avaliação:', err);
      alert('Não foi possível registrar a avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedDriverName = driverName || order?.motoristaNome || 'Entregador Motoboy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-amber-500/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              {driverPhoto ? (
                <img src={driverPhoto} alt={resolvedDriverName} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Bike size={24} />
              )}
            </div>
            <div>
              <h3 id="rating-modal-title" className="font-black text-zinc-900 dark:text-zinc-100 text-base leading-tight">
                Avaliar Entrega
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]">
                Motoboy: <strong className="text-zinc-800 dark:text-zinc-200">{resolvedDriverName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3 animate-in zoom-in-90 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg border-2 border-emerald-400">
              <Check size={32} />
            </div>
            <h4 className="font-black text-lg text-zinc-900 dark:text-white">
              Avaliação Registrada!
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Você avaliou a entrega com <strong className="text-amber-500 font-bold">{rating} estrela(s)</strong>. Seu feedback ajuda a valorizar os melhores motoboys da comunidade AçaíFood!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
            {/* Seletor de 0 a 5 Estrelas */}
            <div className="text-center py-2 space-y-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Toque para escolher de 0 a 5 estrelas:
              </span>

              {/* Botões das Estrelas (1 a 5) + Opção 0 estrelas */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = starValue <= activeRating;
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 sm:p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-hidden"
                      title={`${starValue} estrela(s)`}
                    >
                      <Star
                        size={34}
                        className={`transition-colors duration-150 ${
                          isFilled
                            ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                            : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Botão para opção de 0 estrelas */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setRating(0)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    rating === 0
                      ? 'bg-red-500 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                  }`}
                >
                  {rating === 0 ? '❌ 0 Estrelas Selecionado' : 'Dar 0 estrelas (Péssimo)'}
                </button>
              </div>

              {/* Descrição da Nota */}
              <div className="pt-1">
                <p className={`text-xs font-black transition-colors ${ratingInfo.color}`}>
                  {ratingInfo.label} — {ratingInfo.desc}
                </p>
              </div>
            </div>

            {/* Tags rápidas */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {rating >= 3 ? 'O que se destacou?' : 'O que deu errado?'} (Opcional):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(rating >= 3 ? QUICK_TAGS_POSITIVE : QUICK_TAGS_NEGATIVE).map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition border cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo de comentário */}
            <div>
              <label htmlFor="driver-rating-comment" className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                <MessageSquare size={12} />
                <span>Mensagem ou Comentário (Opcional):</span>
              </label>
              <textarea
                id="driver-rating-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                placeholder="Ex: Entrega impecável, motoboy chegou rápido e foi muito atencioso!"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-xs placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none transition"
              />
              <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-1">
                <span>Visível no histórico do pedido e na reputação do entregador</span>
                <span>{comment.length}/500</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Star size={14} className="fill-white" />
                    <span>Salvar Avaliação ({rating}★)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
