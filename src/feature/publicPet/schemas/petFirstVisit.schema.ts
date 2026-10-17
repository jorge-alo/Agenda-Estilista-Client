import { z } from "zod";

const requiredText = (maximum: number, message: string) =>
  z.string().trim().min(1, message).max(maximum, `Máximo ${maximum} caracteres`);

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum, `Máximo ${maximum} caracteres`);

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const petFirstVisitSchema = z.object({
  responsableNombre: requiredText(255, "Ingresá tu nombre"),
  responsableTelefono: requiredText(50, "Ingresá tu teléfono"),
  responsableTelefonoSecundario: optionalText(50),
  mascotaNombre: requiredText(255, "Ingresá el nombre de tu mascota"),
  mascotaRaza: optionalText(100),
  mascotaFechaNacimiento: z.string().refine(value => !value || isCalendarDate(value), "Ingresá una fecha válida"),
  mascotaTamano: optionalText(20),
  mascotaSexo: optionalText(20),
  motivoContacto: optionalText(500),
});

export type PetFirstVisitInput = z.input<typeof petFirstVisitSchema>;
export type PetFirstVisitData = z.output<typeof petFirstVisitSchema>;
