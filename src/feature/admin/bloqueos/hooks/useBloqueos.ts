import {
  useEffect,
  useState
} from "react";

import {
  bloqueosService
} from "../services/bloqueos.service";

import type {
  Bloqueo,
  CrearBloqueoDTO
} from "../types/bloqueos.types";

export const useBloqueos = () => {

  const [loading,
    setLoading] =
      useState(false);

  const [bloqueos,
    setBloqueos] =
      useState<Bloqueo[]>([]);

  // 🔄 cargar bloqueos

  const cargarBloqueos =
    async () => {

      try {

        const data =
          await bloqueosService
            .getBloqueos();

        setBloqueos(data);

      } catch (error) {

        console.error(error);

      }
    };

  useEffect(() => {
    cargarBloqueos();
  }, []);

  // ➕ crear bloqueo

  const crearBloqueo =
    async (
      data: CrearBloqueoDTO
    ) => {

      try {

        setLoading(true);

        await bloqueosService
          .crear(data);

        await cargarBloqueos();

        alert("Bloqueo creado");

      } catch (error: any) {

        alert(
          error.message ||
          "Error creando bloqueo"
        );

      } finally {

        setLoading(false);
      }
    };

  // ❌ eliminar bloqueo

  const eliminarBloqueo =
    async (id: number) => {

      try {

        await bloqueosService
          .eliminarBloqueo(id);

        setBloqueos(prev =>
          prev.filter(
            b => b.id !== id
          )
        );

      } catch (error) {

        console.error(error);

        alert(
          "Error eliminando bloqueo"
        );
      }
    };

  return {

    bloqueos,

    crearBloqueo,

    eliminarBloqueo,

    loading
  };
};