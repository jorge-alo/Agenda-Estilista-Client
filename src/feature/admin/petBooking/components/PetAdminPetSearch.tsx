import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PetAdminMascotaDetail, PetAdminMascotaSearchResult } from "../types/petAdminBooking.types.ts";
import {
  PET_ADMIN_SEARCH_DEBOUNCE_MS,
  PET_ADMIN_SEARCH_EMPTY_MESSAGE,
  PET_ADMIN_SEARCH_LIMIT_MESSAGE,
  PET_ADMIN_SEARCH_MAX_LENGTH,
  PET_ADMIN_SEARCH_TOO_SHORT_MESSAGE,
  petAdminSearchInputState,
  petAdminSearchOptions,
  petAdminSearchRequestTerm,
  petAdminSearchSelectedRaza,
} from "./petAdminPetSearchView.ts";

interface Props {
  disabled: boolean;
  selectedMascotaId: number | null;
  selectedDetail: PetAdminMascotaDetail | null;
  searchResults: readonly PetAdminMascotaSearchResult[];
  searchLoading: boolean;
  searchFailed: boolean;
  onActivate: () => void;
  onSearch: (term: string) => void;
  onClearSearch: () => void;
  onRetry: () => void;
  onSelect: (mascotaId: number) => void;
}

export function PetAdminPetSearch({
  disabled, selectedMascotaId, selectedDetail, searchResults, searchLoading, searchFailed,
  onActivate, onSearch, onClearSearch, onRetry, onSelect,
}: Props) {
  const [rawTerm, setRawTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const focusChangeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const options = petAdminSearchOptions(searchResults);
  const inputState = petAdminSearchInputState(rawTerm);
  const showList = open && !disabled && inputState === "ready";
  const selectedRaza = petAdminSearchSelectedRaza(selectedDetail);
  const resolvedActiveIndex = activeIndex >= 0 && activeIndex < options.length ? activeIndex : -1;
  const activeOption = resolvedActiveIndex >= 0 ? options[resolvedActiveIndex] : undefined;

  const cancelDebounce = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updatePlacement = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setPlacement(below < 260 && rect.top > below ? "above" : "below");
  }, []);

  useEffect(() => {
    const requestTerm = petAdminSearchRequestTerm(rawTerm);
    if (requestTerm === null) {
      cancelDebounce();
      onClearSearch();
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onSearch(requestTerm);
    }, PET_ADMIN_SEARCH_DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rawTerm, onSearch, onClearSearch, cancelDebounce]);

  useEffect(() => {
    if (changing) inputRef.current?.focus();
  }, [changing]);

  useEffect(() => {
    if (!changing && selectedMascotaId !== null && focusChangeRef.current) {
      focusChangeRef.current = false;
      changeButtonRef.current?.focus();
    }
  }, [changing, selectedMascotaId]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  function openSearch() {
    if (disabled) return;
    onActivate();
    updatePlacement();
    setOpen(true);
  }

  function selectOption(option: (typeof options)[number]) {
    if (disabled) return;
    focusChangeRef.current = true;
    cancelDebounce();
    setRawTerm("");
    setOpen(false);
    setActiveIndex(-1);
    setChanging(false);
    onSelect(option.id);
    onClearSearch();
  }

  function startChanging() {
    if (disabled) return;
    cancelDebounce();
    setRawTerm("");
    setActiveIndex(-1);
    setChanging(true);
    setOpen(true);
    onClearSearch();
    onActivate();
    inputRef.current?.focus();
  }

  function retrySearch() {
    onRetry();
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openSearch();
        if (inputState !== "too-short" && options.length > 0) setActiveIndex(0);
        return;
      }
      if (!showList || options.length === 0) return;
      setActiveIndex(index => {
        const current = index >= 0 && index < options.length ? index : -1;
        return current < 0 ? 0 : Math.min(current + 1, options.length - 1);
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openSearch();
        if (inputState !== "too-short" && options.length > 0) setActiveIndex(options.length - 1);
        return;
      }
      if (!showList || options.length === 0) return;
      setActiveIndex(index => {
        const current = index >= 0 && index < options.length ? index : options.length;
        return current <= 0 ? options.length - 1 : current - 1;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        openSearch();
        return;
      }
      if (showList && activeOption) selectOption(activeOption);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="pet-admin-booking__pet-search">
      {selectedMascotaId !== null && (
        <div className="pet-admin-booking__selected-pet" aria-live="polite">
          <span className="pet-admin-booking__selected-kicker">Mascota seleccionada</span>
          <strong>{selectedDetail?.nombre ?? "Cargando mascota…"}</strong>
          {selectedRaza && <span>{selectedRaza}</span>}
          <button ref={changeButtonRef} className="pet-admin-booking__secondary" type="button"
            onClick={startChanging} disabled={disabled}>
            Cambiar mascota
          </button>
        </div>
      )}

      {(selectedMascotaId === null || changing) && (
        <div ref={wrapperRef} className="pet-admin-booking__search">
          <label htmlFor={inputId}>Buscar mascota</label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={rawTerm}
            placeholder="Nombre, responsable o teléfono"
            autoComplete="off"
            spellCheck={false}
            maxLength={PET_ADMIN_SEARCH_MAX_LENGTH}
            disabled={disabled}
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList && options.length > 0 ? listId : undefined}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-activedescendant={showList && activeOption ? `${listId}-option-${activeOption.id}` : undefined}
            aria-describedby={inputState === "too-short" ? hintId : undefined}
            onChange={event => {
              setRawTerm(event.target.value);
              setActiveIndex(-1);
              openSearch();
            }}
            onFocus={openSearch}
            onClick={openSearch}
            onBlur={event => {
              if (event.relatedTarget instanceof Node && wrapperRef.current?.contains(event.relatedTarget)) return;
              setOpen(false);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
          />

          {inputState === "too-short" && (
            <p id={hintId} className="pet-admin-booking__search-hint">{PET_ADMIN_SEARCH_TOO_SHORT_MESSAGE}</p>
          )}

          {showList && (
            <div className={`pet-admin-booking__search-dropdown is-${placement}`}>
              {searchLoading ? (
                <p className="pet-admin-booking__search-status" role="status">Buscando mascotas…</p>
              ) : searchFailed ? (
                <div className="pet-admin-booking__search-status" role="alert">
                  <p>No pudimos buscar mascotas.</p>
                  <button className="pet-admin-booking__secondary" type="button"
                    onMouseDown={event => event.preventDefault()} onClick={retrySearch}>
                    Intentar nuevamente
                  </button>
                </div>
              ) : options.length === 0 ? (
                <p className="pet-admin-booking__search-status" role="status">{PET_ADMIN_SEARCH_EMPTY_MESSAGE}</p>
              ) : (
                <>
                  <ul className="pet-admin-booking__search-list" id={listId} role="listbox">
                    {options.map((option, index) => (
                      <li
                        key={option.id}
                        id={`${listId}-option-${option.id}`}
                        role="option"
                        aria-selected={index === resolvedActiveIndex}
                        className={`pet-admin-booking__search-option${index === resolvedActiveIndex ? " is-active" : ""}`}
                        onMouseDown={event => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectOption(option)}
                      >
                        <strong>{option.nombre}</strong>
                        {option.detalle && <span>{option.detalle}</span>}
                      </li>
                    ))}
                  </ul>
                  {options.length >= 20 && (
                    <p className="pet-admin-booking__search-limit">{PET_ADMIN_SEARCH_LIMIT_MESSAGE}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
