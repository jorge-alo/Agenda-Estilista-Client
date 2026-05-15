import { useQuery } from "@tanstack/react-query";
import { reservaService } from "../services/reserva.service";

export const useServiciosQuery = (
  estilistaId: number | null
) => {

  return useQuery({

    queryKey: [
      "servicios",
      estilistaId
    ],

    queryFn: () =>
      reservaService.getServicios(
        estilistaId!
      ),

    enabled: !!estilistaId,
  });
};