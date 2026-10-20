import { usePetManagement } from "../hooks/usePetManagement.ts";
import { PetManagementDetail } from "./PetManagementDetail.tsx";
import { PetManagementSearch } from "./PetManagementSearch.tsx";
import { PetMascotaDataForm } from "./PetMascotaDataForm.tsx";
import { usePetMascotaForm } from "../hooks/usePetMascotaForm.ts";
import "../styles/petManagement.css";

interface Props {
  localId: string;
}

export function PetManagement({ localId }: Props) {
  const management = usePetManagement(localId);
  const { controller, state: form } = usePetMascotaForm(localId, management);
  const creating = form.mode === "creating" || form.mode === "submittingCreate";
  const editing = form.mode === "editing" || form.mode === "submittingEdit";

  return (
    <section className="pet-management" aria-labelledby="pet-management-title">
      <header className="pet-management__header">
        <h1 id="pet-management-title">Mascotas</h1>
        <p>Buscá y consultá la información de las mascotas del local.</p>
        <button className="pet-management__primary" type="button" onClick={controller.beginCreate}
          disabled={form.submitting || form.checking || creating}>Nueva mascota</button>
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
          onSelect={controller.selectMascota}
          selectionDisabled={form.submitting || form.checking}
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
              refreshDisabled={form.dirty || form.submitting || form.checking}
              editDisabled={management.detailFetching || Boolean(management.detailErrorMessage)}
              onEdit={() => { if (management.detail) controller.beginEdit(management.detail); }}
              dataForm={editing ? <PetMascotaDataForm controller={controller} state={form} /> : undefined}
            />
          )}
        </div>
      </div>
    </section>
  );
}
