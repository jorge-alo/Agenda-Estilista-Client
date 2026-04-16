
import { getAuthHeaders } from "../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

export const getEstilistas = async (slug: string) => {
  return fetch(`${API_URL}/api/estilistas?slug=${slug}`)
    .then(res => res.json());
};

export const getServicios = async (slug: string) => {
  return fetch(`${API_URL}/api/servicios?slug=${slug}`)
    .then(res => res.json());
};

export const getServiciosPorEstilista = async (id: number) => {
  return fetch(`${API_URL}/api/servicios/estilista/${id}`)
    .then(res => res.json());
};

export const asignarServicio = async (data: any) => {
  return fetch(`${API_URL}/api/servicios/asignar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then(res => res.json());
};

export const desasignarServicio = async (data: any) => {
  return fetch(`${API_URL}/api/servicios/desasignar`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then(res => res.json());
};

export const reservarTurnoAdmin = async (data: any) => {
  return fetch(`${API_URL}/api/turnos/admin`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(res => res.json());
}

export const getDisponibilidadAdmin = async (fecha: string, estilistaId: number, servicioId: number | null, setDisponibles: (horas: string[]) => void) => {
    if (!servicioId) return;
    return await fetch(
        `${API_URL}/api/turnos/disponibilidad/Admin?fecha=${fecha}&estilista_id=${estilistaId}&servicio_id=${servicioId}`, {
        headers: getAuthHeaders()
    }
    ).then(res => res.json())
        .then(data => {
            setDisponibles(data.disponibles || []);
        });
};