import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { petServiciosQuery } from "../../petServicios/queries/petServiciosQueries.ts";
import { petMascotaServiciosQuery } from "../queries/petMascotaServiciosQueries.ts";
import { createPetMascotaServiciosController } from "../state/petMascotaServiciosController.ts";
import { petMascotaServicioRemoveConfirmation } from "../types/petMascotaServicios.types.ts";
import { confirmPetManagementDiscard } from "../components/petManagementConfirm.ts";

export function usePetMascotaServicios(localId: string, mascotaId: number | null, enabled: boolean, canWrite: () => boolean) {
  const client = useQueryClient();
  const [controller] = useState(() => createPetMascotaServiciosController(client, {
    localId, canWrite, confirmDiscard: confirmPetManagementDiscard,
    confirmRemove: nombre => window.confirm(petMascotaServicioRemoveConfirmation(nombre)),
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const catalog = useQuery({ ...petServiciosQuery(localId), enabled: enabled && Boolean(localId.trim()), refetchOnWindowFocus: true, refetchOnReconnect: true });
  const relations = useQuery({ ...petMascotaServiciosQuery(localId, mascotaId), enabled: enabled && mascotaId !== null });
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
