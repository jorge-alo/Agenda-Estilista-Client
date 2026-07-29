import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "../services/auth.service";

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: authService.forgotPassword,
    onSuccess: () => {
      toast.success("Si el correo está registrado, recibirás un enlace de recuperación.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};