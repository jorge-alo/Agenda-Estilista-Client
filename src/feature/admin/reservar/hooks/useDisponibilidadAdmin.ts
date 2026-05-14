import { useQuery }
    from "@tanstack/react-query";
import { getDisponibilidadAdmin } from "../services/reservar.service";
import { queryKeys } from "../../../../shared/lib/queryKeys";


export const useDisponibilidadAdmin =
    ({
        fecha,
        estilistaId,
        servicioId,
    }: {
        fecha: string;
        estilistaId: number | null;
        servicioId: number | null;
    }) => {

        return useQuery({
            queryKey:
                queryKeys.disponibilidad
                    .admin(
                        fecha,
                        estilistaId!,
                        servicioId!
                    ),

            queryFn: () =>
                getDisponibilidadAdmin({
                    fecha,
                    estilistaId: estilistaId!,
                    servicioId: servicioId!,
                }),

            enabled:
                !!fecha &&
                !!estilistaId &&
                !!servicioId,
        });
    };