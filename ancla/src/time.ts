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

/** "YYYY-MM-DDTHH:MM" en la zona horaria de la persona → ISO UTC. null si no es una fecha válida. */
export function localToIso(local: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(asUtc);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    // dos pasadas para acertar también alrededor de cambios de horario
    const p = localParts(new Date(guess), timeZone);
    const [py, pmo, pd] = p.date.split("-").map(Number);
    const [ph, pmi] = p.time.split(":").map(Number);
    guess -= Date.UTC(py, pmo - 1, pd, ph, pmi) - asUtc;
  }
  return new Date(guess).toISOString();
}

/** Cuándo pasó algo, dicho como lo diría una amiga: "hoy en la mañana (08:42)", "ayer (15:10)". */
export function whenPhrase(thenIso: string, now: Date, timeZone: string): string {
  const t = localParts(new Date(thenIso), timeZone);
  const n = localParts(now, timeZone);
  const days = Math.round((Date.parse(n.date) - Date.parse(t.date)) / 86_400_000);
  const hour = Math.floor(t.minutes / 60);
  if (days <= 0) return `hoy en la ${hour < 12 ? "mañana" : hour < 19 ? "tarde" : "noche"} (${t.time})`;
  if (days === 1) return `ayer (${t.time})`;
  return `hace ${days} días, el ${t.weekday} (${t.time})`;
}
