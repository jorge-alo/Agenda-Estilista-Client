import { getAuthHeaders } from "../../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

interface DisponibilidadParams {
    fecha: string;
    estilistaId: number;
    servicioId: number;
}

export const getDisponibilidadAdmin =
    async ({
        fecha,
        estilistaId,
        servicioId
    }: DisponibilidadParams) => {

        const res = await fetch(
            `${API_URL}/api/turnos/disponibilidad/Admin?fecha=${fecha}&estilista_id=${estilistaId}&servicio_id=${servicioId}`,
            {
                headers: getAuthHeaders()
            }
        );

        if (!res.ok) {
            throw new Error(
                "Error obteniendo disponibilidad"
            );
        }

        const data = await res.json();

        return data.disponibles || [];
    };

export const getServiciosPorEstilista =
    async (estilistaId: number) => {

        const res = await fetch(
            `${API_URL}/api/servicios/estilista/${estilistaId}`,
            {
                headers: getAuthHeaders(),
            }
        );

        if (!res.ok) {
            throw new Error(
                "Error cargando servicios"
            );
        }

        return res.json();
    };