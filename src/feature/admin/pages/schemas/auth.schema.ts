import { z } from "zod";

// 📌 Validación SOLO de formato (para LOGIN)
// No importa la fortaleza, solo que no esté vacía
const passwordInputSchema = z
  .string()
  .min(1, "La contraseña es requerida");

// 📌 Validación de FORTALEZA (para CREAR/CAMBIAR contraseña)
const passwordSeguraSchema = z
  .string()
  .min(6, "La contraseña debe tener al menos 6 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Debe contener al menos un símbolo");

// 🔐 LOGIN: valida email + password (formato básico)
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Formato de email inválido"),
  password: passwordInputSchema,
});

// 📧 FORGOT PASSWORD: solo valida el email
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Formato de email inválido"),
});

// 🔄 RESET PASSWORD: valida token + contraseña segura
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  newPassword: passwordSeguraSchema,
});

// 🔄 RESET PASSWORD CONFIRM: incluye confirmación de contraseña
export const resetPasswordConfirmSchema = resetPasswordSchema.extend({
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// ✅ Tipos inferidos automáticamente desde los esquemas
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;