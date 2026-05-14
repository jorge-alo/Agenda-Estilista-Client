import { useQuery }
from "@tanstack/react-query";

import { whatsappService }
from "../services/whatsapp.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useWhatsAppEstado =
(
  localId: string
) => {

  return useQuery({

    queryKey:
      queryKeys.whatsapp
        .estado(localId),

    queryFn: () =>
      whatsappService
        .estado(localId),

    refetchInterval:
      30000,
  });
};