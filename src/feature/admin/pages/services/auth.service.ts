import type { ForgotPasswordInput, ResetPasswordInput } from "../schemas/auth.schema";

const API_URL = import.meta.env.VITE_API_URL;

export const authService = {
  forgotPassword: async (data: ForgotPasswordInput) => {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const responseData = await res.json();
    if (!res.ok) {
      throw new Error(responseData.error || "Error al procesar la solicitud");
    }
    return responseData;
  },

  resetPassword: async (data: ResetPasswordInput) => {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const responseData = await res.json();
    if (!res.ok) {
      throw new Error(responseData.error || "Error al restablecer la contraseña");
    }
    return responseData;
  },
};