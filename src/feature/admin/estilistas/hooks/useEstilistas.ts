import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { estilistasService } from "../services/estilistas.services";

export const useEstilistas = () => {

  return useQuery({
    queryKey:
      queryKeys.estilistas.all,

    queryFn: () =>
      estilistasService.obtener(),

  });
};