import type { PetManagementDetail } from "../types/petManagement.types.ts";
import type { ReactNode } from "react";
import {
  PET_MANAGEMENT_UNAVAILABLE_MESSAGE,
  petManagementDateLabel,
  petManagementText,
} from "./petManagementView.ts";

interface Props {
  selectedMascotaId: number | null;
  detail: PetManagementDetail | null;
  loading: boolean;
  fetching: boolean;
  errorMessage: string | null;
  notFound: boolean;
  onRefresh: () => void;
  refreshDisabled?: boolean;
  editDisabled?: boolean;
  onEdit?: () => void;
  dataForm?: ReactNode;
  responsablesContent: ReactNode;
  flagsContent: ReactNode;
  serviciosContent: ReactNode;
}

export function PetManagementDetail({
  selectedMascotaId, detail, loading, fetching, errorMessage, notFound, onRefresh,
  refreshDisabled = false, editDisabled = false, onEdit, dataForm, responsablesContent, flagsContent, serviciosContent,
}: Props) {
  if (selectedMascotaId === null) {
    return (
      <section className="pet-management__detail-panel" aria-labelledby="pet-management-detail-title">
        <h2 id="pet-management-detail-title" tabIndex={-1}>Ficha de la mascota</h2>
        {notFound
          ? <p className="pet-management__alert" role="status">{PET_MANAGEMENT_UNAVAILABLE_MESSAGE}</p>
          : <p className="pet-management__hint">Elegí una mascota de los resultados para consultar su ficha.</p>}
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="pet-management__detail-panel" aria-labelledby="pet-management-detail-title">
        <h2 id="pet-management-detail-title" tabIndex={-1}>Ficha de la mascota</h2>
        <p className="pet-management__alert" role="status">{PET_MANAGEMENT_UNAVAILABLE_MESSAGE}</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="pet-management__detail-panel" aria-labelledby="pet-management-detail-title" aria-busy="true">
        <h2 id="pet-management-detail-title" tabIndex={-1}>Ficha de la mascota</h2>
        <p className="pet-management__status" role="status">Cargando ficha…</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="pet-management__detail-panel" aria-labelledby="pet-management-detail-title">
        <h2 id="pet-management-detail-title" tabIndex={-1}>Ficha de la mascota</h2>
        {errorMessage ? (
          <div className="pet-management__alert" role="alert">
            <p>{errorMessage}</p>
            <button className="pet-management__secondary" type="button" onClick={onRefresh} disabled={refreshDisabled}>Reintentar</button>
          </div>
        ) : <p className="pet-management__hint">No pudimos mostrar la ficha de esta mascota.</p>}
      </section>
    );
  }

  return (
    <section className="pet-management__detail-panel" aria-labelledby="pet-management-detail-title" aria-busy={fetching}>
      <h2 id="pet-management-detail-title" tabIndex={-1}>Ficha de la mascota</h2>

      <header className="pet-management__detail-header">
        <div>
          <p className="pet-management__kicker">Mascota</p>
          <h3>{detail.nombre}</h3>
          <span className={`pet-management__badge${detail.activo ? "" : " is-inactive"}`}>
            {detail.activo ? "Activa" : "Inactiva"}
          </span>
        </div>
        <button
          className="pet-management__secondary"
          type="button"
          onClick={onRefresh}
          disabled={fetching || refreshDisabled}
        >
          {fetching ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {errorMessage && (
        <div className="pet-management__alert" role="alert">
          <p>{errorMessage}</p>
          <button className="pet-management__secondary" type="button" onClick={onRefresh} disabled={refreshDisabled}>Reintentar</button>
        </div>
      )}

      <section className="pet-management__detail-section" aria-labelledby="pet-management-data-title">
        <h4 id="pet-management-data-title">Datos</h4>
        {!dataForm && onEdit && <button className="pet-management__secondary" type="button" onClick={onEdit}
          disabled={editDisabled}>Editar datos</button>}
        {dataForm}
        <dl className="pet-management__data">
          {!dataForm && <>
          <div><dt>Raza</dt><dd>{petManagementText(detail.raza)}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{petManagementDateLabel(detail.fechaNacimiento)}</dd></div>
          <div><dt>Sexo</dt><dd>{petManagementText(detail.sexo)}</dd></div>
          <div><dt>Tamaño</dt><dd>{petManagementText(detail.tamano)}</dd></div>
          <div><dt>Tipo de pelo</dt><dd>{petManagementText(detail.tipoPelo)}</dd></div>
          </>}
          {!dataForm && <div className="pet-management__data-wide">
            <dt>Observaciones</dt>
            <dd className="pet-management__notes">{petManagementText(detail.observaciones)}</dd>
          </div>}
        </dl>
      </section>

      {flagsContent}
      {responsablesContent}
      {serviciosContent}
    </section>
  );
}
