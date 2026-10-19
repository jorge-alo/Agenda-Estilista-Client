export interface PetFirstVisitFormValues {
  responsableNombre: string;
  responsableTelefono: string;
  responsableTelefonoSecundario: string;
  mascotaNombre: string;
  mascotaRaza: string;
  mascotaFechaNacimiento: string;
  mascotaTamano: string;
  mascotaSexo: string;
  motivoContacto: string;
}

export interface CreatePetRequestPayload {
  responsable: {
    nombre: string;
    telefono: string;
    telefonoSecundario?: string;
  };
  mascota: {
    nombre: string;
    raza?: string;
    fechaNacimiento?: string;
    tamano?: string;
    sexo?: string;
  };
  motivoContacto?: string;
}

export class PublicPetRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super("No se pudo crear la solicitud PET");
    this.status = status;
    this.code = code;
  }
}
