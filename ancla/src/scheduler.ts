import { localParts, toMinutes } from "./time.ts";
import type { User } from "./types.ts";

/** Ventana después de la hora programada en la que todavía se manda el mensaje (por si el cron se atrasa). */
const GRACE_MINUTES = 90;

export type DueEvent = "morning" | "evening" | "checkin";

/**
 * Decide qué mensaje proactivo le toca a una persona en este momento (como máximo uno por tick).
 * Función pura: fácil de probar.
 */
export function dueEvent(user: User, now: Date): DueEvent | null {
  if (!user.proactive) return null;
  const local = localParts(now, user.timezone);

  const inWindow = (hhmm: string) => {
    const diff = local.minutes - toMinutes(hhmm);
    return diff >= 0 && diff < GRACE_MINUTES;
  };

  if (user.checkinAt && new Date(user.checkinAt).getTime() <= now.getTime()) return "checkin";
  if (user.lastMorningDate !== local.date && inWindow(user.morningTime)) return "morning";
  if (user.lastEveningDate !== local.date && inWindow(user.eveningTime)) return "evening";
  return null;
}

/** ¿Seguimos dentro de la ventana de 24 h de WhatsApp para mandar texto libre? */
export function withinServiceWindow(user: User, now: Date): boolean {
  if (!user.lastInboundAt) return false;
  return now.getTime() - new Date(user.lastInboundAt).getTime() < 24 * 60 * 60 * 1000 - 5 * 60 * 1000;
}
