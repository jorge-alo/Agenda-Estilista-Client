import { toast }
from "sonner";

export const useLogoutMutation =
() => {

  const logout = () => {

    localStorage.removeItem(
      "token"
    );

    toast.success(
      "Sesión cerrada"
    );
  };

  return {
    logout,
  };
};