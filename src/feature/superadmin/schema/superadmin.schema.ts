import { z } from "zod";

export const crearLocalSchema = z.object({
  nombreLocal: z.string().min(1, "El nombre del local es requerido"),
  email: z.string().min(1, "El email es requerido").email("Formato de email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  telefono: z.string().optional(),
});

export type CrearLocalInput = z.infer<typeof crearLocalSchema>;