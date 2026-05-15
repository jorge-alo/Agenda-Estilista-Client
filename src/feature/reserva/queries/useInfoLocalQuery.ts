import { useQuery } from "@tanstack/react-query";

import { reservaService } from "../services/reserva.service";

export const useInfoLocal = (
  slug: string
) => {

  return useQuery({

    queryKey: [
      "info-local",
      slug
    ],

    queryFn: () =>
      reservaService.getInfoLocal(slug),

    enabled: !!slug,
  });
};