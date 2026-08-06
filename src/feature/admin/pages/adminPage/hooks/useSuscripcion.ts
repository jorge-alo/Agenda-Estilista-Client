import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "../../../../../shared/lib/fetchWithAuth";


const API_URL = import.meta.env.VITE_API_URL;

export const useSuscripcion = () => {
 
  // Obtener estado actual
  const { data, isLoading } = useQuery({
    queryKey: ["suscripcion-local"],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/suscripcion/estado`);
      return res.json();
    },
  });

  // Mutación para generar el link de pago
  const pagarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/suscripcion/pagar`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error al generar el pago");
      return res.json();
    },
    onSuccess: (data) => {
      // Redirigir a Mercado Pago
      window.location.href = data.link;
    },
    onError: () => {
      alert("Hubo un error al generar el link de pago. Intenta de nuevo.");
    },
  });

  return { data, isLoading, pagarMutation };
};