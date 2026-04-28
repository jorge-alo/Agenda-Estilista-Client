import { useEffect, useState } from "react";
import { obtenerTurnos } from "../../../api/Admin.api";
import type { Turno } from "../types/agenda.types";


export const useTurnos = (fecha?: string) => {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);

  const cargarTurnos = async () => {
    try {
      setLoading(true);

      const data = await obtenerTurnos(fecha);

      setTurnos(Array.isArray(data) ? data : []);

    } catch (error) {
      console.log(error);
      setTurnos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTurnos();
  }, [fecha]);

  return {
    turnos,
    loading,
    recargar: cargarTurnos
  };
};