import {
  useMutation
} from "@tanstack/react-query";

import { toast }
from "sonner";

import { whatsappService }
from "../services/whatsapp.service";

export const useGenerarQR =
() => {

  return useMutation({

    mutationFn:
      whatsappService.generarQR,

    onError: (
      error: any
    ) => {

      toast.error(
        error.message
      );
    },
  });
};