import type { PetFirstVisitData } from "../schemas/petFirstVisit.schema";
import type { CreatePetRequestPayload } from "../types/publicPet.types";
import { PublicPetRequestError } from "../types/publicPet.types.ts";
import { publicPetHttpErrorFromResponse } from "./publicPetHttp.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";

function construirPayload(values: PetFirstVisitData): CreatePetRequestPayload {
  const responsable: CreatePetRequestPayload["responsable"] = {
    nombre: values.responsableNombre,
    telefono: values.responsableTelefono,
  };
  if (values.responsableTelefonoSecundario) responsable.telefonoSecundario = values.responsableTelefonoSecundario;

  const mascota: CreatePetRequestPayload["mascota"] = { nombre: values.mascotaNombre };
  if (values.mascotaRaza) mascota.raza = values.mascotaRaza;
  if (values.mascotaFechaNacimiento) mascota.fechaNacimiento = values.mascotaFechaNacimiento;
  if (values.mascotaTamano) mascota.tamano = values.mascotaTamano;
  if (values.mascotaSexo) mascota.sexo = values.mascotaSexo;

  const payload: CreatePetRequestPayload = { responsable, mascota };
  if (values.motivoContacto) payload.motivoContacto = values.motivoContacto;
  return payload;
}

export const publicPetService = {
  async createRequest(slug: string, values: PetFirstVisitData): Promise<void> {
    const response = await fetch(`${API_URL}/api/pet/public/${encodeURIComponent(slug)}/solicitudes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(construirPayload(values)),
    });
    if (!response.ok) {
      const parsed = await publicPetHttpErrorFromResponse(response);
      throw new PublicPetRequestError(parsed.status, parsed.code);
    }
  },
};
