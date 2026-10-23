import { useState } from "react";
import type { Local } from "../types/superadmin.types";
import { useToggleLocal, useEliminarLocal } from "../mutations/useGestionarLocal";
import { BUSINESS_TYPE } from "../../../shared/types/businessType";
import { BUSINESS_TYPE_LABELS, filterLocalesByBusinessType, type BusinessTypeFilter } from "../../../shared/types/businessTypeLabels";

type FiltroTipo = BusinessTypeFilter;

interface Props {
  locales: Local[];
}

export const LocalesLista = ({ locales }: Props) => {
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("ALL");

  const toggleMutation = useToggleLocal();
  const deleteMutation = useEliminarLocal();

  const handleToggle = (id: number) => {
    toggleMutation.mutate(id);
  };

  const handleEliminar = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setConfirmEliminar(null),
    });
  };

  const cantidadBeauty = locales.filter((local) => local.business_type === BUSINESS_TYPE.BEAUTY).length;
  const cantidadPet = locales.filter((local) => local.business_type === BUSINESS_TYPE.PET_GROOMING).length;
  const localesFiltrados = filterLocalesByBusinessType(locales, filtroTipo);

  return (
    <>
      <div className="sa-filtros" role="group" aria-label="Filtrar locales por tipo de negocio">
        {([
          { value: "ALL", label: "Todos", count: locales.length },
          { value: BUSINESS_TYPE.BEAUTY, label: BUSINESS_TYPE_LABELS[BUSINESS_TYPE.BEAUTY], count: cantidadBeauty },
          { value: BUSINESS_TYPE.PET_GROOMING, label: BUSINESS_TYPE_LABELS[BUSINESS_TYPE.PET_GROOMING], count: cantidadPet },
        ] as const).map((filtro) => (
          <button key={filtro.value} type="button"
            className={`sa-filtro ${filtroTipo === filtro.value ? "seleccionado" : ""}`}
            aria-pressed={filtroTipo === filtro.value}
            onClick={() => setFiltroTipo(filtro.value)}>
            {filtro.label} ({filtro.count})
          </button>
        ))}
      </div>
      {localesFiltrados.length === 0 ? (
        <p className="sa-empty">{locales.length === 0 ? "No hay locales registrados" : "No hay locales para este tipo de negocio"}</p>
      ) : <div className="sa-lista">
      {localesFiltrados.map((local) => (
        <div key={local.id} className={`sa-local ${!local.activo ? "bloqueado" : ""}`}>
          <div className="sa-local-header">
            <div>
              <span className="sa-local-nombre">{local.nombre}</span>
              <span className="sa-badge sa-badge-tipo">{BUSINESS_TYPE_LABELS[local.business_type]}</span>
              <span className={`sa-badge ${local.activo ? "activo" : "inactivo"}`}>
                {local.activo ? "Activo" : "Bloqueado"}
              </span>
            </div>
            <span className="sa-local-fecha">
              {new Date(local.created_at).toLocaleDateString("es-AR")}
            </span>
          </div>

          <div className="sa-local-info">
            <span>📧 {local.email}</span>
            <span>📞 {local.telefono || "—"}</span>
          </div>

          {confirmEliminar === local.id ? (
            <div className="sa-confirm">
              <span>¿Seguro que querés eliminar este local?</span>
              <div className="sa-confirm-btns">
                <button
                  className="sa-btn eliminar"
                  onClick={() => handleEliminar(local.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  className="sa-btn"
                  onClick={() => setConfirmEliminar(null)}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="sa-local-acciones">
              <button
                className={`sa-btn ${local.activo ? "bloquear" : "activar"}`}
                onClick={() => handleToggle(local.id)}
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending && toggleMutation.variables === local.id 
                  ? "Procesando..." 
                  : (local.activo ? "Bloquear" : "Activar")}
              </button>
              <button
                className="sa-btn eliminar"
                onClick={() => setConfirmEliminar(local.id)}
                disabled={toggleMutation.isPending}
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      ))}
      </div>}
    </>
  );
};
