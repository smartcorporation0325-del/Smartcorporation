// Pista inicial de país, zona horaria y dialecto a partir del prefijo del teléfono.
// Es solo el punto de partida: si la persona dice de dónde es o escribe con otros modismos,
// Ancla lo aprende y guarda su propia "voz" (User.voice), que manda sobre esta pista.

export interface CountryInfo {
  country: string;
  timezone: string;
  dialect: string;
}

const NEUTRAL = "español latinoamericano cercano y natural";

const TABLE: Record<string, CountryInfo> = {
  "58": {
    country: "Venezuela",
    timezone: "America/Caracas",
    dialect:
      "venezolano: tuteo (voseo maracucho solo si ella lo usa), tono de pana o amiga cercana con mucho cariño; modismos como 'chama', 'mi amor', 'mi vida', 'chévere', 'qué fino', 'burda de', 'ya va', 'vale', 'dale', usados con naturalidad y sin exagerar",
  },
  "52": {
    country: "México",
    timezone: "America/Mexico_City",
    dialect: "mexicano: tuteo cálido; 'ándale', 'órale', 'qué padre', 'ahorita', 'neta' con moderación",
  },
  "57": {
    country: "Colombia",
    timezone: "America/Bogota",
    dialect: "colombiano: tuteo o 'usted' cariñoso; 'parce', 'listo', 'de una', 'qué nota', 'chévere' con moderación",
  },
  "54": {
    country: "Argentina",
    timezone: "America/Argentina/Buenos_Aires",
    dialect: "rioplatense: voseo ('vos', 'tenés', 'hacé'); 'dale', 'che', 'bárbaro', 're' con moderación",
  },
  "56": {
    country: "Chile",
    timezone: "America/Santiago",
    dialect: "chileno: tuteo informal; 'cachai', 'bacán', 'al tiro', 'po' con moderación",
  },
  "51": {
    country: "Perú",
    timezone: "America/Lima",
    dialect: "peruano: tuteo; 'chévere', 'causa', 'pe', 'ya' con moderación",
  },
  "593": { country: "Ecuador", timezone: "America/Guayaquil", dialect: NEUTRAL },
  "591": { country: "Bolivia", timezone: "America/La_Paz", dialect: NEUTRAL },
  "595": { country: "Paraguay", timezone: "America/Asuncion", dialect: NEUTRAL },
  "598": { country: "Uruguay", timezone: "America/Montevideo", dialect: "rioplatense: voseo; 'bo', 'dale', 'ta' con moderación" },
  "507": { country: "Panamá", timezone: "America/Panama", dialect: NEUTRAL },
  "506": { country: "Costa Rica", timezone: "America/Costa_Rica", dialect: "costarricense: 'mae', 'pura vida', 'tuanis' con moderación" },
  "502": { country: "Guatemala", timezone: "America/Guatemala", dialect: NEUTRAL },
  "503": { country: "El Salvador", timezone: "America/El_Salvador", dialect: NEUTRAL },
  "504": { country: "Honduras", timezone: "America/Tegucigalpa", dialect: NEUTRAL },
  "505": { country: "Nicaragua", timezone: "America/Managua", dialect: NEUTRAL },
  "53": { country: "Cuba", timezone: "America/Havana", dialect: NEUTRAL },
  "1809": { country: "República Dominicana", timezone: "America/Santo_Domingo", dialect: NEUTRAL },
  "1829": { country: "República Dominicana", timezone: "America/Santo_Domingo", dialect: NEUTRAL },
  "1849": { country: "República Dominicana", timezone: "America/Santo_Domingo", dialect: NEUTRAL },
  "34": {
    country: "España",
    timezone: "Europe/Madrid",
    dialect: "español de España: tuteo; 'vale', 'venga', 'tía', 'mola' con moderación",
  },
  // +1 es EE. UU. y Canadá: la zona horaria es solo una suposición; Ancla la corrige si la persona la dice.
  "1": { country: "EE. UU. o Canadá", timezone: "America/New_York", dialect: NEUTRAL },
};

/** Busca el prefijo más largo que coincida (p. ej. 1809 antes que 1). */
export function countryFromPhone(phone: string): CountryInfo | null {
  const digits = phone.replace(/\D/g, "");
  for (let len = 4; len >= 1; len--) {
    const info = TABLE[digits.slice(0, len)];
    if (info) return info;
  }
  return null;
}
