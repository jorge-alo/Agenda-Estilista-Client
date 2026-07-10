import { useForm } from "react-hook-form";

import { zodResolver }
from "@hookform/resolvers/zod";

import {
  reservaSchema,
  type ReservaFormData
} from "../schemas/reserva.schema";

export const useReservaForm = () => {

  return useForm<ReservaFormData>({
    resolver:
      zodResolver(reservaSchema),

    defaultValues: {
      nombre: "",
      telefono: "",
    },
    shouldUnregister: false,
  });
};