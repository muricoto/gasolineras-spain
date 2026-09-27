const priceFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** 1.489 → "1,489 €/l" */
export function formatPrice(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${priceFormatter.format(value)}/l`;
}

const shortFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** 1.489 → "1,489" (etiquetas compactas, p. ej. marcadores del mapa). */
export function formatPriceShort(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return shortFormatter.format(value);
}

/**
 * Normaliza para búsqueda tolerante ("avila" encuentra "Ávila").
 * Tras NFD, quita todo lo que no sea letra/número/espacio (ASCII seguro).
 */
export function normalizeSearchText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g, '');
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Última actualización: 27 sept, 14:06" */
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormatter.format(d);
}

/** "hace 2 min" / "hace 1 h" / fecha corta. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMin = Math.max(0, Math.round((now - t) / 60000));
  if (diffMin < 1) return 'ahora mismo';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return formatUpdatedAt(iso);
}

/**
 * Desfase en ms de una zona IANA respecto a UTC para un instante dado.
 * Se usa para interpretar la `Fecha` del MITECO como hora peninsular.
 */
function tzOffsetMs(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/**
 * Convierte la `Fecha` del feed MITECO ("27/09/2026 14:06:30", hora
 * peninsular Europe/Madrid) a ISO UTC. Si no se puede parsear, `fallback`.
 */
export function parseMitecoFecha(fecha: string | null, fallback: string): string {
  if (!fecha) return fallback;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})[ ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(fecha.trim());
  if (!m) return fallback;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  const utcGuess = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    Number(ss ?? '00'),
  );
  const offset = tzOffsetMs('Europe/Madrid', utcGuess);
  const d = new Date(utcGuess - offset);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}
