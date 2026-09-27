import type { FuelKey } from '../types/fuel';

/**
 * Catálogo de carburantes: correspondencia entre el campo del MITECO
 * ("Precio ...") y la clave interna. Solo se incluyen los campos que el
 * feed oficial realmente proporciona.
 */
export interface FuelDefinition {
  key: FuelKey;
  /** Nombre exacto del campo en la respuesta del MITECO. */
  apiField: string;
  label: string;
  short: string;
}

export const FUELS: FuelDefinition[] = [
  { key: 'gasoline95', apiField: 'Precio Gasolina 95 E5', label: 'Gasolina 95', short: '95' },
  { key: 'gasoline95Premium', apiField: 'Precio Gasolina 95 E5 Premium', label: 'Gasolina 95 Premium', short: '95+' },
  { key: 'gasoline95E10', apiField: 'Precio Gasolina 95 E10', label: 'Gasolina 95 E10', short: '95 E10' },
  { key: 'gasoline98', apiField: 'Precio Gasolina 98 E5', label: 'Gasolina 98', short: '98' },
  { key: 'gasoline98E10', apiField: 'Precio Gasolina 98 E10', label: 'Gasolina 98 E10', short: '98 E10' },
  { key: 'diesel', apiField: 'Precio Gasoleo A', label: 'Diésel', short: 'D' },
  { key: 'dieselPremium', apiField: 'Precio Gasoleo Premium', label: 'Diésel Premium', short: 'D+' },
  { key: 'dieselB', apiField: 'Precio Gasoleo B', label: 'Gasóleo B', short: 'B' },
  { key: 'dieselC', apiField: 'Precio Gasoleo C', label: 'Gasóleo C', short: 'C' },
  { key: 'biodiesel', apiField: 'Precio Biodiesel', label: 'Biodiésel', short: 'BIO' },
  { key: 'bioethanol', apiField: 'Precio Bioetanol', label: 'Bioetanol', short: 'Etanol' },
  { key: 'lpg', apiField: 'Precio Gases licuados del petróleo', label: 'GLP / Autogás', short: 'GLP' },
  { key: 'cng', apiField: 'Precio Gas Natural Comprimido', label: 'Gas natural comprimido', short: 'GNC' },
  { key: 'lng', apiField: 'Precio Gas Natural Licuado', label: 'Gas natural licuado', short: 'GNL' },
  { key: 'hydrogen', apiField: 'Precio Hidrogeno', label: 'Hidrógeno', short: 'H₂' },
  { key: 'adblue', apiField: 'Precio Adblue', label: 'AdBlue', short: 'AdBlue' },
  { key: 'dieselRenovable', apiField: 'Precio Diésel Renovable', label: 'Diésel renovable', short: 'D ren.' },
  { key: 'gasolineRenovable', apiField: 'Precio Gasolina Renovable', label: 'Gasolina renovable', short: '95 ren.' },
  { key: 'e85', apiField: 'Precio Gasolina 95 E85', label: 'E85', short: 'E85' },
];

/** Carburantes principales mostrados en el selector rápido. */
export const MAIN_FUELS: FuelKey[] = ['gasoline95', 'gasoline98', 'diesel', 'dieselPremium'];

export const FUEL_LABELS: Record<FuelKey, string> = Object.fromEntries(
  FUELS.map((f) => [f.key, f.label]),
) as Record<FuelKey, string>;

export function getFuelLabel(key: FuelKey): string {
  return FUEL_LABELS[key] ?? key;
}
