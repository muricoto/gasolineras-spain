/**
 * Interpreta el campo `Horario` del MITECO para saber si la estación
 * está abierta ahora mismo.
 *
 * Formatos reales observados: "24H", "L-D: 07:00-22:00",
 * "L-V: 08:00-20:00", "L-S: 07:00-22:00", "M-D: ...", etc.
 * Devuelve true/false, o null si el formato no se puede interpretar.
 */

const DAY_INDEX: Record<string, number> = {
  L: 0, // lunes
  M: 1, // martes
  X: 2, // miércoles
  J: 3, // jueves
  V: 4, // viernes
  S: 5, // sábado
  D: 6, // domingo
};

function expandDays(range: string): number[] | null {
  const r = range.trim().toUpperCase();
  if (r.includes('-')) {
    const [a, b] = r.split('-').map((s) => s.trim());
    if (!(a in DAY_INDEX) || !(b in DAY_INDEX)) return null;
    const out: number[] = [];
    let i = DAY_INDEX[a];
    for (let n = 0; n < 7; n++) {
      out.push(i);
      if (i === DAY_INDEX[b]) break;
      i = (i + 1) % 7;
    }
    return out;
  }
  if (r in DAY_INDEX) return [DAY_INDEX[r]];
  return null;
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

export function isOpenNow(schedule: string, now = new Date()): boolean | null {
  const s = (schedule ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === '24H' || s.startsWith('24 H') || s === '24 HORAS') return true;

  // Partes separadas por ";" (ej. "L-V: 08:00-20:00; S: 09:00-14:00")
  const parts = s.split(';').map((p) => p.trim()).filter(Boolean);
  // Día actual en índice L=0..D=6
  const today = (now.getDay() + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let understood = false;

  for (const part of parts) {
    // Ej. "L-D: 24H" → abierta todo el rango de días indicado
    const m24 = /^([LMXJVSD](?:-[LMXJVSD])?)\s*:?\s*24\s*H/.exec(part);
    if (m24) {
      const days24 = expandDays(m24[1]);
      if (!days24) continue;
      understood = true;
      if (days24.includes(today)) return true;
      continue;
    }
    // Ej. "L-D: 07:00-22:00" o "L-D 07:00-22:00"
    const m = /^([LMXJVSD](?:-[LMXJVSD])?)\s*:?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(part);
    if (!m) continue;
    const days = expandDays(m[1]);
    const start = toMinutes(m[2]);
    const end = toMinutes(m[3]);
    if (!days || start === null || end === null) continue;
    understood = true;
    if (!days.includes(today)) continue;
    if (end >= start) {
      if (nowMin >= start && nowMin < end) return true;
    } else {
      // Rango nocturno que cruza la medianoche
      if (nowMin >= start || nowMin < end) return true;
    }
  }

  return understood ? false : null;
}
