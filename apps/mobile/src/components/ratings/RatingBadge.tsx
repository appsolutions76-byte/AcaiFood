"use client";

import React from "react";
import { Star } from "lucide-react";

interface RatingBadgeProps {
  avgStars?: number | null;
  ratingCount?: number | null;
  minCountDisplay?: number;
  ratingsEnabled?: boolean;
  className?: string;
}

export function RatingBadge({
  avgStars,
  ratingCount = 0,
  minCountDisplay = 5,
  ratingsEnabled = false,
  className = ""
}: RatingBadgeProps) {
  if (!ratingsEnabled) return null;

  const count = Number(ratingCount || 0);
  const minCount = Math.max(1, Number(minCountDisplay || 5));
  const avg = Number(avgStars || 0);

  if (count < minCount || avg <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 ${className}`}
      >
        Novo
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 ${className}`}
    >
      <Star size={11} className="fill-amber-500 text-amber-500" />
      <span>{avg.toFixed(1)}</span>
      <span className="text-[10px] opacity-75">({count})</span>
    </span>
  );
}
