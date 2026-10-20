import { useId } from "react";
import type { PetManagementEstado, PetManagementSearchResult } from "../types/petManagement.types.ts";
import type { PetManagementSearchInputState } from "../state/petManagementState.ts";
import {
  PET_MANAGEMENT_EMPTY_SEARCH_MESSAGE,
  PET_MANAGEMENT_INITIAL_MESSAGE,
  PET_MANAGEMENT_TOO_LONG_MESSAGE,
  PET_MANAGEMENT_TOO_SHORT_MESSAGE,
  petManagementResultMeta,
} from "./petManagementView.ts";

interface Props {
  rawTerm: string;
  estado: PetManagementEstado;
  inputState: PetManagementSearchInputState;
  results: readonly PetManagementSearchResult[];
  loading: boolean;
  settled: boolean;
  errorMessage: string | null;
  limitMessage: string | null;
  selectedMascotaId: number | null;
  selectionDisabled?: boolean;
  onTermChange: (value: string) => void;
  onEstadoChange: (value: PetManagementEstado) => void;
  onSelect: (mascotaId: number) => void;
  onRetry: () => void;
  onClear: () => void;
}

export function PetManagementSearch({
  rawTerm, estado, inputState, results, loading, settled, errorMessage, limitMessage, selectedMascotaId,
  onTermChange, onEstadoChange, onSelect, onRetry, onClear,
  selectionDisabled = false,
}: Props) {
  const inputId = useId();
  const estadoId = useId();
  const listId = useId();

  return (
    <section className="pet-management__search-panel" aria-labelledby="pet-management-search-title" aria-busy={loading}>
      <header className="pet-management__panel-header">
        <h2 id="pet-management-search-title">Buscar mascota</h2>
        <p>Por nombre, responsable o teléfono.</p>
      </header>

      <div className="pet-management__controls">
        <label className="pet-management__field" htmlFor={inputId}>
          <span>Término de búsqueda</span>
          <input
            id={inputId}
            type="search"
            value={rawTerm}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej. Firulais, Ana o 11 2345-6789"
            onChange={event => onTermChange(event.target.value)}
          />
        </label>

        <label className="pet-management__field" htmlFor={estadoId}>
          <span>Estado</span>
          <select
            id={estadoId}
            value={estado}
            onChange={event => onEstadoChange(event.target.value as PetManagementEstado)}
          >
            <option value="todas">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </label>

        <button
          className="pet-management__secondary pet-management__clear"
          type="button"
          onClick={onClear}
          disabled={rawTerm.length === 0}
        >
          Limpiar búsqueda
        </button>
      </div>

      {inputState === "empty" && <p className="pet-management__hint">{PET_MANAGEMENT_INITIAL_MESSAGE}</p>}
      {inputState === "too-short" && <p className="pet-management__hint">{PET_MANAGEMENT_TOO_SHORT_MESSAGE}</p>}
      {inputState === "too-long" && <p className="pet-management__hint">{PET_MANAGEMENT_TOO_LONG_MESSAGE}</p>}

      {loading && <p className="pet-management__status" role="status">Buscando mascotas…</p>}

      {!loading && errorMessage && (
        <div className="pet-management__alert" role="alert">
          <p>{errorMessage}</p>
          <button className="pet-management__secondary" type="button" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !errorMessage && settled && inputState === "ready" && results.length === 0 && (
        <p className="pet-management__status" role="status">{PET_MANAGEMENT_EMPTY_SEARCH_MESSAGE}</p>
      )}

      {results.length > 0 && (
        <ul className="pet-management__results" id={listId} aria-label="Resultados de mascotas">
          {results.map(result => {
            const selected = result.id === selectedMascotaId;
            return (
              <li key={result.id}>
                <button
                  className={`pet-management__result${selected ? " is-selected" : ""}`}
                  type="button"
                  disabled={selectionDisabled}
                  onClick={() => onSelect(result.id)}
                  aria-current={selected ? "true" : undefined}
                >
                  <span className="pet-management__result-heading">
                    <strong>{result.nombre}</strong>
                    <span className={`pet-management__badge${result.activo ? "" : " is-inactive"}`}>
                      {result.activo ? "Activa" : "Inactiva"}
                    </span>
                  </span>
                  <span className="pet-management__result-meta">{petManagementResultMeta(result)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {limitMessage && <p className="pet-management__limit">{limitMessage}</p>}
    </section>
  );
}
