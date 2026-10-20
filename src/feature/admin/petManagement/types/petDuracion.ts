export const PET_DURACION_MAX = 2147483647;

export const petDuracionEnteroValida = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= PET_DURACION_MAX;

/** Accept decimal digits only: never silently interpret exponent, sign, whitespace or fractions. */
export function parsePetDuracion(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return petDuracionEnteroValida(number) ? number : null;
}
