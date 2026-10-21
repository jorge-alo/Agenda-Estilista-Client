import { useEffect } from "react";
import { createPetManagementNavigation, type RegisterPetManagementNavigation } from "../state/petManagementNavigation.ts";
import { usePetManagement } from "../hooks/usePetManagement.ts";
import { PetManagementDetail } from "./PetManagementDetail.tsx";
import { PetManagementSearch } from "./PetManagementSearch.tsx";
import { PetMascotaDataForm } from "./PetMascotaDataForm.tsx";
import { usePetMascotaForm } from "../hooks/usePetMascotaForm.ts";
import { usePetResponsables } from "../hooks/usePetResponsables.ts";
import { PetResponsables } from "./PetResponsables.tsx";
import { usePetMascotaFlags } from "../hooks/usePetMascotaFlags.ts";
import { PetMascotaFlags } from "./PetMascotaFlags.tsx";
import { usePetMascotaServicios } from "../hooks/usePetMascotaServicios.ts";
import { PetMascotaServicios } from "./PetMascotaServicios.tsx";
import { usePetMascotaExtras } from "../hooks/usePetMascotaExtras.ts";
import { PetMascotaExtras } from "./PetMascotaExtras.tsx";
import "../styles/petManagement.css";

interface Props {
  localId: string;
  registerNavigation?: RegisterPetManagementNavigation;
}

export function PetManagement({ localId, registerNavigation }: Props) {
  const management = usePetManagement(localId);
  const { controller, state: form } = usePetMascotaForm(localId, management);
  const creating = form.mode === "creating" || form.mode === "submittingCreate";
  const editing = form.mode === "editing" || form.mode === "submittingEdit";
  const responsables = usePetResponsables(localId, management, creating);
  const flags = usePetMascotaFlags(localId, management, creating, () =>
    !controller.getSnapshot().submitting && !controller.getSnapshot().checking && !responsables.controller.getSnapshot().busy);
  const servicios = usePetMascotaServicios(localId, management.selectedMascotaId, !creating && Boolean(management.detail), () =>
    !controller.getSnapshot().submitting && !controller.getSnapshot().checking
      && !responsables.controller.getSnapshot().busy && !flags.controller.getSnapshot().busy);
  const extras = usePetMascotaExtras(localId, management.selectedMascotaId, !creating && Boolean(management.detail), () =>
    !controller.getSnapshot().submitting && !controller.getSnapshot().checking
      && !responsables.controller.getSnapshot().busy && !flags.controller.getSnapshot().busy);

  useEffect(() => {
    registerNavigation?.(createPetManagementNavigation(controller, responsables.controller, flags.controller, servicios.controller, extras.controller));
    return () => registerNavigation?.(null);
  }, [registerNavigation, controller, responsables.controller, flags.controller, servicios.controller, extras.controller]);

  function beginCreate() {
    const current = responsables.controller.getSnapshot();
    if (current.busy || flags.controller.getSnapshot().busy || servicios.controller.getSnapshot().busy
      || extras.controller.getSnapshot().busy) return;
    if (controller.beginCreate(current.dirty || flags.controller.getSnapshot().dirty || servicios.controller.getSnapshot().dirty
      || extras.controller.getSnapshot().dirty)) {
      responsables.controller.syncSelection(null, null);
      flags.controller.syncSelection(null, null);
      servicios.controller.syncSelection(null);
      extras.controller.syncSelection(null);
    }
  }
  function selectMascota(id: number) {
    const current = responsables.controller.getSnapshot();
    if (current.busy || flags.controller.getSnapshot().busy || servicios.controller.getSnapshot().busy
      || extras.controller.getSnapshot().busy) return;
    if (controller.selectMascota(id, current.dirty || flags.controller.getSnapshot().dirty || servicios.controller.getSnapshot().dirty
      || extras.controller.getSnapshot().dirty)) {
      responsables.controller.syncSelection(id, null);
      flags.controller.syncSelection(id, null);
      servicios.controller.syncSelection(id);
      extras.controller.syncSelection(id);
    }
  }

  return (
    <section className="pet-management" aria-labelledby="pet-management-title">
      <header className="pet-management__header">
        <h1 id="pet-management-title">Mascotas</h1>
        <p>Buscá y consultá la información de las mascotas del local.</p>
        <button className="pet-management__primary" type="button" onClick={beginCreate}
          disabled={form.submitting || form.checking || creating || responsables.state.busy || flags.state.busy || servicios.state.busy || extras.state.busy}>Nueva mascota</button>
      </header>

      <div className="pet-management__layout">
        <PetManagementSearch
          rawTerm={management.rawTerm}
          estado={management.estado}
          inputState={management.searchInputState}
          results={management.searchResults}
          loading={management.searchLoading}
          settled={management.searchSettled}
          errorMessage={management.searchErrorMessage}
          limitMessage={management.limitMessage}
          selectedMascotaId={management.selectedMascotaId}
          onTermChange={management.setRawTerm}
          onEstadoChange={management.setEstado}
          onSelect={selectMascota}
          selectionDisabled={form.submitting || form.checking || responsables.state.busy || flags.state.busy || servicios.state.busy || extras.state.busy}
          onRetry={management.retrySearch}
          onClear={management.clearSearch}
        />

        <div className="pet-management__workspace">
          {form.notice && <p className="pet-management__status" role="status">{form.notice}</p>}
          {creating ? (
            <section className="pet-management__detail-panel">
              <PetMascotaDataForm controller={controller} state={form} />
            </section>
          ) : (
            <PetManagementDetail
              selectedMascotaId={management.selectedMascotaId}
              detail={management.detail}
              loading={management.detailLoading}
              fetching={management.detailFetching}
              errorMessage={management.detailErrorMessage}
              notFound={management.detailNotFound}
              onRefresh={management.refetchDetail}
              refreshDisabled={form.dirty || form.submitting || form.checking || responsables.state.busy || flags.state.busy || servicios.state.busy || extras.state.busy}
              editDisabled={management.detailFetching || Boolean(management.detailErrorMessage)}
              onEdit={() => { if (management.detail) controller.beginEdit(management.detail); }}
              dataForm={editing ? <PetMascotaDataForm controller={controller} state={form} /> : undefined}
              flagsContent={management.detail && <PetMascotaFlags detail={management.detail}
                controller={flags.controller} state={flags.state}
                disabled={management.detailFetching || Boolean(management.detailErrorMessage) || form.submitting || form.checking || responsables.state.busy}
              />}
              responsablesContent={<PetResponsables
                responsables={management.detail?.responsables ?? []}
                controller={responsables.controller} state={responsables.state}
                disabled={management.detailFetching || Boolean(management.detailErrorMessage)}
              />}
              serviciosContent={<PetMascotaServicios servicios={servicios}
                disabled={management.detailFetching || Boolean(management.detailErrorMessage) || form.submitting || form.checking || responsables.state.busy || flags.state.busy} />}
              extrasContent={<PetMascotaExtras extras={extras}
                disabled={management.detailFetching || Boolean(management.detailErrorMessage) || form.submitting || form.checking || responsables.state.busy || flags.state.busy} />}
            />
          )}
        </div>
      </div>
    </section>
  );
}
