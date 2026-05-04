import { getAuthHeaders }
  from "../../../auth/auth.helpers";

const API_URL =
  import.meta.env.VITE_API_URL;

export const cancelarTurno =
  async (id: number) => {

    const res = await fetch(
      `${API_URL}/api/turnos/${id}/cancelar`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      throw new Error(
        "Error cancelando turno"
      );
    }

    return res.json();
};

export const completarTurno =
  async (id: number) => {

    const res = await fetch(
      `${API_URL}/api/turnos/${id}/completar`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      throw new Error(
        "Error completando turno"
      );
    }

    return res.json();
};

export const reprogramarTurno =
  async (
    id: number,
    body: any
  ) => {

    const res = await fetch(
      `${API_URL}/api/turnos/${id}`,
      {
        method: "PUT",

        headers: getAuthHeaders(),

        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!res.ok) {

      throw new Error(
        data.error ||
        "Error reprogramando turno"
      );
    }

    return data;
};