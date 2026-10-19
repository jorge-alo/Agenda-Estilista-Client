export interface PetAdminMascota {
  id: number;
  nombre: string;
  activo: boolean;
  reservaOnlineHabilitada: boolean;
}

export interface PetAdminMascotaSearchResult {
  id: number;
  nombre: string;
  raza: string | null;
  responsables: Array<{
    id: number;
    nombre: string;
    telefono: string;
  }>;
}

export interface PetAdminResponsable {
  clienteId: number;
  nombre: string;
  telefono: string;
}

export interface PetAdminMascotaDetail extends PetAdminMascota {
  responsables: PetAdminResponsable[];
}

export interface PetAdminServicio {
  id: number;
  nombre: string;
  activo: boolean;
  duracionMinutos: number;
}

export interface PetAdminExtra {
  id: number;
  nombre: string;
  activo: boolean;
  duracionMinutos: number;
}

export interface PetAdminAvailabilityInput {
  mascotaId: number;
  servicioId: number;
  fecha: string;
  extraIds: readonly number[];
}

export interface PetAdminAvailability {
  fecha: string;
  duracionMinutos: number;
  slots: Array<{
    horaInicio: string;
    horaFin: string;
  }>;
}

export interface PetAdminCreateBookingInput {
  mascotaId: number;
  clienteId: number;
  servicioId: number;
  extraIds: readonly number[];
  fecha: string;
  hora: string;
}

export interface PetAdminCreatedBooking {
  id: number;
  fecha: string;
  hora: string;
  horaFin: string;
  estado: "activo";
  mascotaId: number;
  clienteId: number;
  servicioId: number;
}
