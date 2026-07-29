import { z } from "zod";

// Esquema para el formulario de login
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Formato de email inválido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Esquema para solicitar recuperación de contraseña
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Formato de email inválido"),
});

// Esquema para restablecer contraseña
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  newPassword: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Esquema para confirmar contraseña (solo frontend)
export const resetPasswordConfirmSchema = resetPasswordSchema.extend({
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Inferir tipos TypeScript automáticamente desde los esquemas
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;