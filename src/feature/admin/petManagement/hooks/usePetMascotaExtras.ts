import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { petExtrasQuery } from "../../petExtras/queries/petExtrasQueries.ts";
import { petMascotaExtrasQuery } from "../queries/petMascotaExtrasQueries.ts";
import { createPetMascotaExtrasController } from "../state/petMascotaExtrasController.ts";
import { petMascotaExtraRemoveConfirmation } from "../types/petMascotaExtras.types.ts";
import { confirmPetManagementDiscard } from "../components/petManagementConfirm.ts";

export function usePetMascotaExtras(localId: string, mascotaId: number | null, enabled: boolean, canWrite: () => boolean) {
  const client = useQueryClient();
  const [controller] = useState(() => createPetMascotaExtrasController(client, {
    localId, canWrite, confirmDiscard: confirmPetManagementDiscard,
    confirmRemove: nombre => window.confirm(petMascotaExtraRemoveConfirmation(nombre)),
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const catalog = useQuery({ ...petExtrasQuery(localId), enabled: enabled && Boolean(localId.trim()), refetchOnWindowFocus: true, refetchOnReconnect: true });
  const relations = useQuery({ ...petMascotaExtrasQuery(localId, mascotaId), enabled: enabled && mascotaId !== null });
  useEffect(() => { controller.connect(); return () => controller.disconnect(); }, [controller]);
  useEffect(() => { controller.syncSelection(enabled ? mascotaId : null); }, [controller, enabled, mascotaId]);
  useEffect(() => {
    if (enabled && mascotaId !== null && catalog.data && relations.data) controller.syncData(mascotaId, catalog.data, relations.data);
  }, [controller, enabled, mascotaId, catalog.data, relations.data]);
  return { controller, state, loading: catalog.isLoading || relations.isLoading,
    fetching: catalog.isFetching || relations.isFetching, error: relations.error ?? catalog.error,
    refresh: () => { if (!state.busy) { void catalog.refetch(); void relations.refetch(); } },
  };
}
