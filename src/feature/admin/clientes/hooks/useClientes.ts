import { useQuery } from "@tanstack/react-query";
import { clientesService } from "../services/clientes.services";
import { queryKeys } from "../../../../shared/lib/queryKeys";
 // ajustá el path real

export const useClientes = () => {
  return useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesService.getAll,
  });
};