export interface ResponsableDraft {
  nombre: string;
  telefono: string;
}
export type ResponsableErrors = Partial<Record<keyof ResponsableDraft, string>>;

export const emptyResponsableDraft = (): ResponsableDraft => ({ nombre: "", telefono: "" });

export function normalizeResponsableDraft(draft: ResponsableDraft): ResponsableDraft {
  return { nombre: draft.nombre.trim(), telefono: draft.telefono.trim() };
}

export function validateResponsableDraft(draft: ResponsableDraft): ResponsableErrors {
  const data = normalizeResponsableDraft(draft);
  const errors: ResponsableErrors = {};
  if (!data.nombre) errors.nombre = "Ingresá el nombre del responsable.";
  else if (data.nombre.length > 255) errors.nombre = "Usá hasta 255 caracteres.";
  if (!data.telefono) errors.telefono = "Ingresá el teléfono del responsable.";
  else if (data.telefono.length > 50) errors.telefono = "Usá hasta 50 caracteres.";
  // International parsing and canonical identity belong exclusively to the backend.
  return errors;
}
