import { getAuthHeaders } from "../../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

export const getConfiguracion = async () => {
  const res = await fetch(`${API_URL}/api/configuracion`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener configuración");
  return res.json();
};

export const updateConfiguracion = async (data: {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  descripcion?: string;
  horario_apertura?: string;
  horario_cierre?: string;
}) => {
  const res = await fetch(`${API_URL}/api/configuracion`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al actualizar configuración");
  return res.json();
};