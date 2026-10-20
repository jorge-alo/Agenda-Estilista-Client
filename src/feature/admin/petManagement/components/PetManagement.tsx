import { usePetManagement } from "../hooks/usePetManagement.ts";
import { PetManagementDetail } from "./PetManagementDetail.tsx";
import { PetManagementSearch } from "./PetManagementSearch.tsx";
import "../styles/petManagement.css";

interface Props {
  localId: string;
}

export function PetManagement({ localId }: Props) {
  const management = usePetManagement(localId);

  return (
    <section className="pet-management" aria-labelledby="pet-management-title">
      <header className="pet-management__header">
        <h1 id="pet-management-title">Mascotas</h1>
        <p>Buscá y consultá la información de las mascotas del local.</p>
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
          onSelect={management.selectMascota}
          onRetry={management.retrySearch}
          onClear={management.clearSearch}
        />

        <PetManagementDetail
          selectedMascotaId={management.selectedMascotaId}
          detail={management.detail}
          loading={management.detailLoading}
          fetching={management.detailFetching}
          errorMessage={management.detailErrorMessage}
          notFound={management.detailNotFound}
          onRefresh={management.refetchDetail}
        />
      </div>
    </section>
  );
}
