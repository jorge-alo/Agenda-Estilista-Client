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

interface props {
    slug: string
    fecha: string
    estilistaId: number | null
    servicioId: number | null
    setDisponibles: (valor: string[]) => void
    setNombreLocal: (valor: string) => void
}

export const useDisponibilidad = ({ slug, fecha, estilistaId, servicioId, setDisponibles, setNombreLocal }: props) => {
    const prevRef = useRef<string[]>([]);

    // EFECTO 1: Para obtener el nombre del local apenas carga el SLUG
    useEffect(() => {
        if (!slug) return;

        const fetchInfoLocal = async () => {
            const data = await getDisponibilidad(slug, fecha, null, null);
            if (data.nombreLocal) {
                // Tomamos el string, la primera en Mayús y el resto como estaba
                const nombreFormateado =
                    data.nombreLocal.charAt(0).toUpperCase() + data.nombreLocal.slice(1);

                setNombreLocal(nombreFormateado);
            }
        };

        fetchInfoLocal();
    }, [slug]); // Solo depende del slug

    // EFECTO 2: Para obtener los horarios disponibles
    useEffect(() => {
        // Solo buscamos turnos si tenemos todos los datos
        if (!slug || !estilistaId || !servicioId) return;

        const fetchTurnos = async () => {
            const data = await getDisponibilidad(slug, fecha, estilistaId, servicioId);

            if (data.disponibles && JSON.stringify(prevRef.current) !== JSON.stringify(data.disponible)) {
                prevRef.current = data.disponibles;
                setDisponibles(data.disponibles || []);
            }
        };

        fetchTurnos();
    }, [slug, fecha, estilistaId, servicioId]);
};






