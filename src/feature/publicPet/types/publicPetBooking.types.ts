export interface PetBookingContext {
  slug: string;
  token: string;
}

export interface PetBookingService {
  id: number;
  nombre: string;
  duracionMinutos: number;
}

export interface PetBookingExtra {
  id: number;
  nombre: string;
  duracionExtraMinutos: number;
}

export interface PetBookingOptions {
  servicios: PetBookingService[];
  extras: PetBookingExtra[];
}

export interface PetAvailabilitySlot {
  horaInicio: string;
  horaFin: string;
}

export interface PetAvailability {
  fecha: string;
  duracionMinutos: number;
  slots: PetAvailabilitySlot[];
}

export interface PetAvailabilityInput {
  mascotaId: number;
  servicioId: number;
  extraIds: number[];
  fecha: string;
}

export interface PetCreateBookingInput extends PetAvailabilityInput {
  hora: string;
}

export interface PetCreatedBooking {
  id: number;
  fecha: string;
  hora: string;
  horaFin: string;
  estado: "activo";
}
