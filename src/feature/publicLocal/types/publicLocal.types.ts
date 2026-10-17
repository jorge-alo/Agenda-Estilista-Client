import type { BusinessType } from "../../../shared/types/businessType";

export interface PublicLocalContext {
  nombre: string;
  businessType: BusinessType;
}

export class PublicLocalContextError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("No se pudo cargar el contexto público");
    this.status = status;
  }
}
