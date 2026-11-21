// Utilidades de fecha/hora en la zona horaria de cada persona (sin dependencias).

export interface LocalParts {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  minutes: number; // minutos desde medianoche
  weekday: string; // "lunes", "martes", ...
}

export function localParts(now: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const weekday = new Intl.DateTimeFormat("es", { timeZone, weekday: "long" }).format(now);
  const time = `${p.hour}:${p.minute}`;
  return { date: `${p.year}-${p.month}-${p.day}`, time, minutes: toMinutes(time), weekday };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Instante UTC de la medianoche local de hoy, en ISO (aprox. correcto salvo el día de cambio de horario). */
export function localMidnightIso(now: Date, timeZone: string): string {
  const { minutes } = localParts(now, timeZone);
  const ms = now.getTime() - minutes * 60_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds();
  return new Date(ms).toISOString();
}
