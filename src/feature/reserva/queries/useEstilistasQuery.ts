import { useQuery } from "@tanstack/react-query";
import { reservaService } from "../services/reserva.service";

export const useEstilistasQuery = (
  slug: string
) => {

  return useQuery({
    queryKey: ["estilistas", slug],

    queryFn: () =>
      reservaService.getEstilistas(slug),

    enabled: !!slug,
  });
};