/**
 * El feed de estaciones solo trae `IDCCAA` (sin nombre), así que se mapea aquí.
 * Verificado contra el endpoint oficial:
 *   .../PreciosCarburantes/Listados/Provincias/
 * que devuelve { IDPovincia, IDCCAA, Provincia, CCAA }.
 */
export const CCAA_NAMES: Record<string, string> = {
  '01': 'Andalucía',
  '02': 'Aragón',
  '03': 'Asturias',
  '04': 'Baleares',
  '05': 'Canarias',
  '06': 'Cantabria',
  '07': 'Castilla-La Mancha',
  '08': 'Castilla y León',
  '09': 'Cataluña',
  '10': 'Comunitat Valenciana',
  '11': 'Extremadura',
  '12': 'Galicia',
  '13': 'Madrid',
  '14': 'Murcia',
  '15': 'Navarra',
  '16': 'País Vasco',
  '17': 'La Rioja',
  '18': 'Ceuta',
  '19': 'Melilla',
};

export function getCcaaName(id: string): string {
  return CCAA_NAMES[id] ?? 'Desconocida';
}
