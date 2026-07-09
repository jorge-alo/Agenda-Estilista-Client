import { z } from "zod";

export const reservaSchema = z.object({
  nombre: z.string().min(3, "Nombre muy corto"),
  telefono: z.string().min(8, "Teléfono inválido"),
  // fecha ya no va acá
});

export type ReservaFormData =
  z.infer<typeof reservaSchema>;