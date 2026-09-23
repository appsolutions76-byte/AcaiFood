import React from 'react';

export function AppSolutionsBrandCard({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full max-w-sm mx-auto bg-[#12131a] border border-zinc-800 rounded-3xl p-6 shadow-2xl text-left font-sans ${className}`}>
      {/* Header: Icon + Title */}
      <div className="flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-950/60 border border-purple-400/30 shrink-0">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
            <circle cx="2" cy="17" r="1.5" fill="#34d399" stroke="none" />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-extrabold tracking-tight text-white flex items-center leading-none">
            AppSolutions<span className="text-emerald-400">76</span>
          </h3>
          <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase mt-1">
            SISTEMAS INTELIGENTES
          </p>
        </div>
      </div>

      {/* Pill Badge */}
      <div className="mt-4 mb-4">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[11px] text-zinc-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
          <span>Empresa Paraense · Belém, PA</span>
        </span>
      </div>

      {/* Corporate Info */}
      <p className="text-xs text-zinc-300 leading-relaxed font-normal">
        AppSolutions76 é uma marca de <strong className="font-bold text-white">Eletromecânica Baia Engenharia e Tecnologia Ltda</strong>
      </p>
      <p className="text-[11px] text-zinc-500 font-medium mt-1">
        CNPJ 42.035.623/0001-40
      </p>

      {/* Contact & Location */}
      <div className="mt-4 pt-3 border-t border-zinc-800/60">
        <a 
          href="mailto:appsolutions76@gmail.com" 
          className="text-emerald-400 font-bold text-xs hover:underline transition block"
        >
          appsolutions76@gmail.com
        </a>
        <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">
          Pará · Brasil
        </span>
      </div>
    </div>
  );
}

export default AppSolutionsBrandCard;
