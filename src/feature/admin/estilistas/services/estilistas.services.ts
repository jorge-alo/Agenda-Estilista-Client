import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth";

import type {
    Estilista,
    CrearEstilistaDTO
} from "../types/estilistas.types";

const API_URL =
    import.meta.env.VITE_API_URL;

export const estilistasService = {

    obtener:
        async (): Promise<Estilista[]> => {

            const res =
                await fetchWithAuth(
                    `${API_URL}/api/estilistas/admin`
                );

            if (!res.ok) {
                throw new Error(
                    "Error cargando estilistas"
                );
            }

            return res.json();
        },

    crear:
        async (
            body: CrearEstilistaDTO
        ) => {

            const res = await fetchWithAuth(
                `${API_URL}/api/estilistas/admin`,
                {
                    method: "POST",
                    body: JSON.stringify(body),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                    "Error creando estilista"
                );
            }

            return data;
        },
};
