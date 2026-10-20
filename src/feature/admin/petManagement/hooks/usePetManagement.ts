import { useEffect, useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PET_MANAGEMENT_SEARCH_DEBOUNCE_MS,
  PET_MANAGEMENT_SEARCH_LIMIT,
  type PetManagementEstado,
} from "../types/petManagement.types.ts";
import {
  petManagementInitialState,
  petManagementNormalizedTerm,
  petManagementReducer,
  petManagementSearchInputState,
  petManagementSearchRequestTerm,
  petManagementValidId,
} from "../state/petManagementState.ts";
import {
  petManagementDetailQuery,
  petManagementSearchQuery,
} from "../queries/petManagementQueries.ts";
import {
  petManagementDetailErrorMessage,
  petManagementErrorKind,
  petManagementSearchErrorMessage,
  PET_MANAGEMENT_LIMIT_MESSAGE,
  petManagementShowsLimitCopy,
} from "../components/petManagementView.ts";

export function usePetManagement(localId: string) {
  const [state, dispatch] = useReducer(petManagementReducer, undefined, petManagementInitialState);
  const [committedTerm, setCommittedTerm] = useState("");

  useEffect(() => {
    const requestTerm = petManagementSearchRequestTerm(state.rawTerm);
    const nextTerm = requestTerm ?? "";
    const timer = setTimeout(() => {
      setCommittedTerm(current => current === nextTerm ? current : nextTerm);
    }, requestTerm === null ? 0 : PET_MANAGEMENT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.rawTerm]);

  const normalizedRawTerm = petManagementNormalizedTerm(state.rawTerm);
  const requestTerm = petManagementSearchRequestTerm(state.rawTerm);
  const effectiveTerm = requestTerm === null ? "" : committedTerm;
  const termIsCurrent = effectiveTerm === normalizedRawTerm && effectiveTerm.length >= 2;
  const searchOptions = petManagementSearchQuery(
    localId,
    effectiveTerm,
    state.estado,
    PET_MANAGEMENT_SEARCH_LIMIT,
  );
  const searchQuery = useQuery({ ...searchOptions, enabled: searchOptions.enabled && termIsCurrent });
  const detailQuery = useQuery(
    petManagementDetailQuery(localId, state.selectedMascotaId),
  );

  const searchErrorKind = termIsCurrent && searchQuery.isError
    ? petManagementErrorKind(searchQuery.error, "search")
    : null;
  const detailErrorKind = detailQuery.isError
    ? petManagementErrorKind(detailQuery.error, "detail")
    : null;

  useEffect(() => {
    const selectedMascotaId = state.selectedMascotaId;
    if (selectedMascotaId === null || !detailQuery.isError) return;
    if (petManagementErrorKind(detailQuery.error, "detail") === "detail-not-found") {
      dispatch({ type: "DETAIL_NOT_FOUND", mascotaId: selectedMascotaId });
    }
  }, [detailQuery.error, detailQuery.isError, state.selectedMascotaId]);

  const searchResults = termIsCurrent && searchQuery.isSuccess ? searchQuery.data : [];
  const searchLoading = requestTerm !== null && (!termIsCurrent || searchQuery.isFetching);
  const searchSettled = termIsCurrent && !searchQuery.isFetching
    && (searchQuery.isSuccess || searchQuery.isError);
  const detail = detailQuery.data?.id === state.selectedMascotaId ? detailQuery.data : null;
  const detailNotFound = state.detailNotFound || detailErrorKind === "detail-not-found";

  return {
    rawTerm: state.rawTerm,
    estado: state.estado,
    selectedMascotaId: state.selectedMascotaId,
    searchInputState: petManagementSearchInputState(state.rawTerm),
    searchResults,
    searchLoading,
    searchSettled,
    searchErrorKind,
    searchErrorMessage: petManagementSearchErrorMessage(searchErrorKind),
    limitMessage: petManagementShowsLimitCopy(searchResults.length) ? PET_MANAGEMENT_LIMIT_MESSAGE : null,
    detail,
    detailLoading: detailQuery.isLoading,
    detailFetching: detailQuery.isFetching,
    detailErrorKind,
    detailErrorMessage: petManagementDetailErrorMessage(detailErrorKind),
    detailNotFound,
    confirmDetailNotFound: (mascotaId: number) => dispatch({ type: "DETAIL_NOT_FOUND", mascotaId }),
    setRawTerm: (rawTerm: string) => dispatch({ type: "SET_RAW_TERM", rawTerm }),
    setEstado: (estado: PetManagementEstado) => dispatch({ type: "SET_ESTADO", estado }),
    selectMascota: (mascotaId: number) => {
      if (petManagementValidId(mascotaId)) dispatch({ type: "SELECT_MASCOTA", mascotaId });
    },
    clearSearch: () => dispatch({ type: "SET_RAW_TERM", rawTerm: "" }),
    retrySearch: () => {
      if (searchQuery.isFetching || !termIsCurrent) return;
      void searchQuery.refetch();
    },
    refetchDetail: () => {
      if (state.selectedMascotaId === null || detailQuery.isFetching) return;
      void detailQuery.refetch();
    },
  };
}
