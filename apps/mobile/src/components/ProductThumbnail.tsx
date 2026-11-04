"use client";

import React from "react";
import {
  Soup,
  Fish,
  Drumstick,
  Utensils,
  UtensilsCrossed,
  Wheat,
  Snowflake,
  Sparkles,
  CupSoda,
  ShoppingBag,
  Palmtree
} from "lucide-react";

interface ProductThumbnailProps {
  photo?: string | null;
  name: string;
  isTeal?: boolean;
  isCongelado?: boolean;
  className?: string;
}

export function ProductThumbnail({
  photo,
  name,
  isTeal,
  isCongelado,
  className = "w-12 h-12 sm:w-14 sm:h-14"
}: ProductThumbnailProps) {
  if (photo) {
    return (
      <div className={`${className} rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-xs bg-zinc-100 dark:bg-zinc-900`}>
        <img src={photo} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  const lower = (name || "").toLowerCase();

  // Caso especial: congelado / para viagem
  if (isCongelado || lower.includes("congelado") || lower.includes("viagem")) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950/70 dark:to-cyan-900/50 border border-teal-200/80 dark:border-teal-800/60 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-teal-600 dark:text-teal-300`}
      >
        <Snowflake className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Açaí Branco
  if (lower.includes("branco")) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-amber-50 to-emerald-50 dark:from-amber-950/40 dark:to-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-emerald-600 dark:text-emerald-300`}
      >
        <Sparkles className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Fruto B2B / Insumo bruto
  if (lower.includes("fruto") || lower.includes("caroço") || lower.includes("lata")) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-emerald-50 to-purple-50 dark:from-emerald-950/50 dark:to-purple-950/50 border border-emerald-200/80 dark:border-emerald-800/60 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-emerald-700 dark:text-emerald-300`}
      >
        <Palmtree className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Açaí Geral (Popular, Médio, Grosso, Tradicional)
  if (lower.includes("açaí") || lower.includes("acai")) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-purple-100/90 via-purple-50 to-purple-100 dark:from-purple-950/80 dark:via-purple-900/50 dark:to-purple-950/80 border border-purple-200/90 dark:border-purple-800/70 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-purple-700 dark:text-purple-300`}
      >
        <Soup className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Peixes e frutos do mar
  if (
    lower.includes("peixe") ||
    lower.includes("posta") ||
    lower.includes("filé") ||
    lower.includes("file") ||
    lower.includes("camarão") ||
    lower.includes("camarao") ||
    lower.includes("pescado")
  ) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/40 border border-blue-200/70 dark:border-blue-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-blue-600 dark:text-blue-300`}
      >
        <Fish className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Frango / Carnes / Espetinhos / Charque
  if (
    lower.includes("frango") ||
    lower.includes("coxa") ||
    lower.includes("espeto") ||
    lower.includes("espetinho") ||
    lower.includes("carne") ||
    lower.includes("charque") ||
    lower.includes("bacon") ||
    lower.includes("calabresa")
  ) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/60 dark:to-amber-950/40 border border-orange-200/70 dark:border-orange-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-orange-600 dark:text-orange-300`}
      >
        <Drumstick className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Massas / Refeições
  if (
    lower.includes("macarr") ||
    lower.includes("massa") ||
    lower.includes("lasanh") ||
    lower.includes("prato") ||
    lower.includes("almoço") ||
    lower.includes("jantar")
  ) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/60 dark:to-orange-950/40 border border-orange-200/70 dark:border-orange-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-orange-600 dark:text-orange-300`}
      >
        <UtensilsCrossed className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Farinhas / Grãos / Tapioca
  if (
    lower.includes("farinha") ||
    lower.includes("tapioca") ||
    lower.includes("goma") ||
    lower.includes("grao") ||
    lower.includes("grão") ||
    lower.includes("portel")
  ) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/60 dark:to-yellow-950/40 border border-amber-200/70 dark:border-amber-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-amber-600 dark:text-amber-300`}
      >
        <Wheat className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Bebidas
  if (
    lower.includes("suco") ||
    lower.includes("refrigerante") ||
    lower.includes("água") ||
    lower.includes("agua") ||
    lower.includes("cerveja") ||
    lower.includes("bebida")
  ) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/60 dark:to-blue-950/40 border border-cyan-200/70 dark:border-cyan-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-cyan-600 dark:text-cyan-300`}
      >
        <CupSoda className="w-6 h-6 stroke-[1.8]" />
      </div>
    );
  }

  // Fallback geral elegante para produtos / refeições
  return (
    <div
      className={`${className} rounded-xl bg-gradient-to-br from-purple-50 to-zinc-100 dark:from-purple-950/40 dark:to-zinc-900 border border-purple-200/60 dark:border-purple-800/50 overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-purple-600 dark:text-purple-400`}
    >
      <Utensils className="w-6 h-6 stroke-[1.8]" />
    </div>
  );
}
