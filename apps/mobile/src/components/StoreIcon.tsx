import React from "react";

// Ícone oficial de loja/batedeira do AçaíFood: lojinha roxa com toldo listrado.
// Desenho próprio (SVG), igual em todos os celulares — substitui o emoji de tigela 🥣 onde ele representava loja.
// Para textos puros (WhatsApp, <option>), use o emoji STORE_EMOJI.

export const STORE_EMOJI = '🏪';

const SHAPES =
  '<rect x="4" y="10" width="16" height="11" rx="1" fill="#f5f3ff" stroke="#4c1d95" stroke-width="1.2"/>' +
  '<rect x="10" y="14" width="4" height="7" fill="#6d28d9"/>' +
  '<rect x="5.8" y="13" width="3" height="3" fill="#c4b5fd" stroke="#4c1d95" stroke-width=".6"/>' +
  '<rect x="15.2" y="13" width="3" height="3" fill="#c4b5fd" stroke="#4c1d95" stroke-width=".6"/>' +
  '<path d="M3 5h18l1 4H2z" fill="#6d28d9"/>' +
  '<path d="M6.6 5h3.6l-.4 4H6z M13.8 5h3.6l.6 4h-3.8z" fill="#fff"/>' +
  '<path d="M2 9a2.5 2 0 0 0 5 0a2.5 2 0 0 0 5 0a2.5 2 0 0 0 5 0a2.5 2 0 0 0 5 0z" fill="#6d28d9"/>';

/** HTML do ícone (para marcadores e popups do Leaflet, que recebem string). */
export const storeIconSvg = (size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="display:inline-block;vertical-align:middle">${SHAPES}</svg>`;

/** Componente React do ícone de lojinha. */
export function StoreIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Loja"
      className={`inline-flex items-center justify-center align-middle leading-none ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: storeIconSvg(size) }}
    />
  );
}
