import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth.service";

export const useResetPassword = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: () => {
      toast.success("¡Contraseña actualizada correctamente!");
      // Pequeño delay para que el usuario lea el toast antes de redirigir
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};