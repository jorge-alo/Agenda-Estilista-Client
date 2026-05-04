import { useEffect, useRef, useState } from "react";
import { getDisponibilidad } from "./reserva.api";

export const useReservaHooks = () => {
    const [horarios, setHorarios] = useState<string[]>([]);
    // generar horarios base
    useEffect(() => {
        const horas = [];
        for (let h = 9; h <= 18; h++) {
            // Convertimos el número a String y aplicamos padStart
            const horaFormateada = h.toString().padStart(2, '0');

            horas.push(`${horaFormateada}:00:00`);
            horas.push(`${horaFormateada}:30:00`);
        }
        setHorarios(horas);
    }, []);
    return { horarios }
}

export interface InfoLocal {
  nombreLocal: string;
  descripcion: string;
  direccion: string;
  telefono: string;
  horario_apertura: string;
  horario_cierre: string;
}

interface Props {
  slug: string;
  fecha: string;
  estilistaId: number | null;
  servicioId: number | null;
  setDisponibles: (valor: string[]) => void;
  setInfoLocal: (valor: InfoLocal) => void;
}

export const useDisponibilidad = ({ slug, fecha, estilistaId, servicioId, setDisponibles, setInfoLocal }: Props) => {
  const prevRef = useRef<string[]>([]);

  // EFECTO 1: Info del local al cargar el slug
  useEffect(() => {
    if (!slug) return;
    getDisponibilidad(slug, fecha, null, null).then((data) => {
      setInfoLocal({
        nombreLocal: data.nombreLocal
          ? data.nombreLocal.charAt(0).toUpperCase() + data.nombreLocal.slice(1)
          : "",
        descripcion: data.descripcion ?? "",
        direccion: data.direccion ?? "",
        telefono: data.telefono ?? "",
        horario_apertura: data.horario_apertura ?? "",
        horario_cierre: data.horario_cierre ?? "",
      });
    });
  }, [slug]);

  // EFECTO 2: Disponibilidad cuando hay estilista y servicio
  useEffect(() => {
    if (!slug || !estilistaId || !servicioId) return;
    const fetchTurnos = async () => {
      const data = await getDisponibilidad(slug, fecha, estilistaId, servicioId);
      if (data.disponibles && JSON.stringify(prevRef.current) !== JSON.stringify(data.disponibles)) {
        prevRef.current = data.disponibles;
        setDisponibles(data.disponibles || []);
      }
    };
    fetchTurnos();
  }, [slug, fecha, estilistaId, servicioId]);
};






