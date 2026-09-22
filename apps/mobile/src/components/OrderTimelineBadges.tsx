"use client";

import React from 'react';
import { Order } from '@/store/useAppStore';

export function getNormalizedOrderTimestamps(order: {
  createdAt?: string;
  acceptedAt?: string;
  readyAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  receivedAt?: string;
}) {
  const tCreated = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  let tAccepted = order.acceptedAt ? new Date(order.acceptedAt).getTime() : 0;
  let tReady = order.readyAt ? new Date(order.readyAt).getTime() : 0;
  let tPickedUp = order.pickedUpAt ? new Date(order.pickedUpAt).getTime() : 0;
  let tDelivered = order.deliveredAt ? new Date(order.deliveredAt).getTime() : 0;
  let tReceived = order.receivedAt ? new Date(order.receivedAt).getTime() : 0;

  if (tAccepted > 0 && tCreated > 0 && tAccepted < tCreated) {
    tAccepted = tCreated;
  }

  if (tReady > 0) {
    if (tAccepted > tReady) tAccepted = tReady;
    if (tCreated > 0 && tReady < tCreated) tReady = tCreated;
  }

  if (tPickedUp > 0) {
    if (tReady > tPickedUp) tReady = tPickedUp;
    if (tAccepted > tPickedUp) tAccepted = tPickedUp;
    if (tCreated > 0 && tPickedUp < tCreated) tPickedUp = tCreated;
  }

  if (tDelivered > 0) {
    if (tPickedUp > tDelivered) tPickedUp = tDelivered;
    if (tReady > tDelivered) tReady = tDelivered;
    if (tAccepted > tDelivered) tAccepted = tDelivered;
    if (tCreated > 0 && tDelivered < tCreated) tDelivered = tCreated;
  }

  if (tReceived > 0) {
    if (tDelivered > tReceived) tDelivered = tReceived;
    if (tPickedUp > tReceived) tPickedUp = tReceived;
    if (tReady > tReceived) tReady = tReceived;
    if (tAccepted > tReceived) tAccepted = tReceived;
    if (tCreated > 0 && tReceived < tCreated) tReceived = tCreated;
  }

  return {
    createdAt: tCreated > 0 ? new Date(tCreated).toISOString() : order.createdAt,
    acceptedAt: tAccepted > 0 ? new Date(tAccepted).toISOString() : undefined,
    readyAt: tReady > 0 ? new Date(tReady).toISOString() : undefined,
    pickedUpAt: tPickedUp > 0 ? new Date(tPickedUp).toISOString() : undefined,
    deliveredAt: tDelivered > 0 ? new Date(tDelivered).toISOString() : undefined,
    receivedAt: tReceived > 0 ? new Date(tReceived).toISOString() : undefined,
  };
}

const formatTime = (isoStr?: string) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDate = (isoStr?: string) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

export function OrderTimelineBadges({ order, className = "flex flex-wrap gap-1.5 mt-2 mb-1" }: { order: Order; className?: string }) {
  const ts = getNormalizedOrderTimestamps(order);

  return (
    <div className={className}>
      {ts.createdAt && (
        <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">
          🕒 Pedido: {formatDate(ts.createdAt)} {formatTime(ts.createdAt)}
        </span>
      )}
      {ts.acceptedAt && (
        <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">
          👨‍🍳 Aceito: {formatTime(ts.acceptedAt)}
        </span>
      )}
      {ts.readyAt && (
        <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold">
          🛎️ Pronto: {formatTime(ts.readyAt)}
        </span>
      )}
      {ts.pickedUpAt && (
        <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">
          📦 Retirada: {formatTime(ts.pickedUpAt)}
        </span>
      )}
      {ts.deliveredAt && (
        <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded font-bold">
          📍 Chegou: {formatTime(ts.deliveredAt)}
        </span>
      )}
      {ts.receivedAt && (
        <span className="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">
          ✅ Recebido: {formatTime(ts.receivedAt)}
        </span>
      )}
    </div>
  );
}
