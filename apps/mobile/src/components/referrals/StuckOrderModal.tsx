"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore, Order } from "@/store/useAppStore";
import { playNewOrderChime } from "@/lib/soundAlerts";
import { AlertTriangle, Radio, PackageCheck, X } from "lucide-react";

interface StuckOrderModalProps {
  orders: Order[];
  rates: any;
  referralsEnabled?: boolean;
  onOrderUpdated?: () => void;
}

export function StuckOrderModal({
  orders,
  rates,
  referralsEnabled = false,
  onOrderUpdated
}: StuckOrderModalProps) {
  const currentUser = useAppStore((s: any) => s.currentUser);
  const [stuckOrder, setStuckOrder] = useState<Order | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const alertedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!referralsEnabled || !currentUser?.id) return;

    const checkStuck = async () => {
      const nowMs = Date.now();
      for (const o of orders || []) {
        if (!o || o.status !== "pronto") continue;
        if (o.motoristaId) continue;
        if (o.self_delivery) continue;
        const mode = o.dispatch_mode || o.dispatch_mode_snapshot || "ALL";
        if (mode !== "REFERRED_ONLY") continue;
        // Se já foi aberto para o app (radar_open_at preenchido no passado), não está mais travado
        if (o.radar_open_at && new Date(o.radar_open_at).getTime() <= nowMs) continue;

        const calledAtStr = o.dispatch_called_at || o.readyAt || o.createdAt;
        if (!calledAtStr) continue;
        const calledAtMs = new Date(calledAtStr).getTime();
        if (isNaN(calledAtMs)) continue;

        const stuckSecs =
          o.type === "B2B"
            ? Number(rates?.b2b_stuck_order_alert_seconds || 300)
            : o.type === "COLETA"
            ? Number(rates?.col_stuck_order_alert_seconds || 300)
            : Number(rates?.b2c_stuck_order_alert_seconds || 300);

        if (nowMs - calledAtMs >= stuckSecs * 1000) {
          if (!o.stuck_alert_sent_at && !alertedIdsRef.current.has(o.id)) {
            alertedIdsRef.current.add(o.id);
            const { data } = await supabase.rpc("dispatch_mark_stuck_alert_sent", {
              p_order_id: o.id
            });
            if (data?.success && !data?.already_sent) {
              playNewOrderChime();
            }
          } else if (!alertedIdsRef.current.has(o.id)) {
            alertedIdsRef.current.add(o.id);
          }

          if (!dismissedIds.has(o.id)) {
            setStuckOrder(o);
            return;
          }
        }
      }
    };

    checkStuck();
    const timer = setInterval(checkStuck, 5000);
    return () => clearInterval(timer);
  }, [orders, rates, referralsEnabled, currentUser?.id, dismissedIds]);

  if (!stuckOrder) return null;

  const isColeta = stuckOrder.type === "COLETA";
  const driverLabel =
    stuckOrder.type === "B2B"
      ? "caminhoneiros indicados"
      : isColeta
      ? "caçambas indicadas"
      : "motoboys indicados";

  const handleOpenToApp = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc("dispatch_open_order_to_app", {
        p_order_id: stuckOrder.id
      });
      if (error || !data?.success) {
        setErrorMsg(data?.error || error?.message || "Não foi possível abrir o pedido para o app.");
      } else {
        setDismissedIds((prev) => new Set(prev).add(stuckOrder.id));
        setStuckOrder(null);
        if (currentUser?.id) {
          await useAppStore.getState().fetchOrders(currentUser.id, true);
        }
        if (onOrderUpdated) onOrderUpdated();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro ao abrir pedido para o app.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelfDelivery = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (!stuckOrder.stuck_alert_sent_at) {
        await supabase.rpc("dispatch_mark_stuck_alert_sent", {
          p_order_id: stuckOrder.id
        });
      }
      const { data, error } = await supabase.rpc("dispatch_set_self_delivery", {
        p_order_id: stuckOrder.id
      });
      if (error || !data?.success) {
        setErrorMsg(
          data?.error || error?.message || "Não foi possível marcar entrega por conta própria."
        );
      } else {
        setDismissedIds((prev) => new Set(prev).add(stuckOrder.id));
        setStuckOrder(null);
        if (currentUser?.id) {
          await useAppStore.getState().fetchOrders(currentUser.id, true);
        }
        if (onOrderUpdated) onOrderUpdated();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro ao ativar entrega por conta própria.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[260] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-amber-300 dark:border-amber-700 overflow-hidden">
        <div className="bg-amber-500 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <h3 className="font-black text-sm sm:text-base">
              Pedido aguardando nos seus indicados
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setDismissedIds((prev) => new Set(prev).add(stuckOrder.id));
              setStuckOrder(null);
            }}
            className="text-white/80 hover:text-white p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            O pedido <strong>{stuckOrder.title || `#${stuckOrder.id.slice(0, 6)}`}</strong> está
            no modo <strong>&quot;Só indicados&quot;</strong> e nenhum dos seus {driverLabel} aceitou até agora.
          </p>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            O pedido nunca abre sozinho quando está em &quot;Só indicados&quot;. Escolha como deseja prosseguir:
          </p>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={handleOpenToApp}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Radio size={16} />
              Abrir para o app (todos os motoristas do radar)
            </button>

            {!isColeta && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSelfDelivery}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <PackageCheck size={16} />
                Entregar por conta própria (confirmar com PIN do cliente)
              </button>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setDismissedIds((prev) => new Set(prev).add(stuckOrder.id));
                setStuckOrder(null);
              }}
              className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
            >
              Continuar aguardando meus indicados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
