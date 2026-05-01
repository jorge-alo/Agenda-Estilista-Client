import { useEffect, useState } from "react";



import type { Cliente }
  from "../types/clientes.types";
import { clientesService } from "../services/clientes.services";

export const useClientes = () => {

  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    clientesService
      .getAll()
      .then(setClientes)
      .finally(() => setLoading(false));

  }, []);

  return {
    clientes,
    loading
  };
};