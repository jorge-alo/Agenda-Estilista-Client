import { z } from "zod";
import { BUSINESS_TYPE } from "../../../shared/types/businessType";

export const crearLocalSchema = z.object({
  nombreLocal: z.string().min(1, "El nombre del local es requerido"),
  email: z.string().min(1, "El email es requerido").email("Formato de email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  telefono: z.string().optional(),
  business_type: z.enum([BUSINESS_TYPE.BEAUTY, BUSINESS_TYPE.PET_GROOMING]).default(BUSINESS_TYPE.BEAUTY),
});

export type CrearLocalInput = z.infer<typeof crearLocalSchema>;
