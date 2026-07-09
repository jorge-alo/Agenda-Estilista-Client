import { useQuery } from "@tanstack/react-query";
import { reservaService } from "../services/reserva.service";

interface Props {
  slug: string;
  fecha: string;
  estilistaId: number | null;
  servicioId: number | null;
}

export const useDisponibilidadQuery = ({
  slug,
  fecha,
  estilistaId,
  servicioId,
}: Props) => {
  console.log({
    slug,
    fecha,
    estilistaId,
    servicioId
  });

  return useQuery({

    queryKey: [
      "disponibilidad",
      slug,
      fecha,
      estilistaId,
      servicioId
    ],

    queryFn: () =>
      reservaService.getDisponibilidad(
        slug,
        fecha,
        estilistaId!,
        servicioId!
      ),

    enabled:
      !!slug &&
      !!fecha &&
      estilistaId !== null &&
      servicioId !== null,

       retry: false,
  });
};