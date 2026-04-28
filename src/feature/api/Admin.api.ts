
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

export const getWhatsAppEstado = async (localId: string, headers: HeadersInit) => {
  const res = await fetch(`${API_URL}/api/whatsapp/estado/${localId}`, { headers });
  return res.json();
};

export const getWhatsAppQR = async (localId: string, headers: HeadersInit) => {
  const res = await fetch(`${API_URL}/api/whatsapp/conectar/${localId}`, { headers });
  return res.json();
};

export const obtenerServicios = async () => {
  const res = await fetch(`${API_URL}/api/servicios/admin`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    throw new Error("Error cargando servicios");
  }

  return res.json();
};

export const obtenerTurnos = async (fecha?: string, desde?: string, hasta?: string) => {
  let url: string;

  if (desde && hasta) {
    url = `${API_URL}/api/turnos/rango?desde=${desde}&hasta=${hasta}`;
  } else if (fecha) {
    url = `${API_URL}/api/turnos?fecha=${fecha}`;
  } else {
    url = `${API_URL}/api/turnos/futuros`;
  }

  const res = await fetch(url, { headers: getAuthHeaders() });

  if (!res.ok) throw new Error("Error cargando turnos");

  return res.json();
};