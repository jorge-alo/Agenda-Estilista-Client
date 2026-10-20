import type { Estilista } from "../../../estilistas/types/estilistas.types";
import { BUSINESS_TYPE, type BusinessType } from "../types/adminPage.types";
import type { AdminTab } from "../types/adminPage.types";
import { BeautyAdminContent } from "./BeautyAdminContent";
import { PetAdminContent } from "./PetAdminContent";
import { isWidePetAdminContent } from "../petAdminContent";

interface Props {
  tabActiva: AdminTab;
  businessType: BusinessType;
  estilistas: Estilista[];
  estilistaId: number | null;
  setEstilistaId: (id: number | null) => void;
  localId: string;
}

export const AdminContent = ({
  tabActiva,
  businessType,
  estilistas,
  estilistaId,
  setEstilistaId,
  localId,
}: Props) => {
  return (
    <div className={`admin-content${isWidePetAdminContent(businessType, tabActiva) ? " admin-content--wide" : ""}`}>
      {businessType === BUSINESS_TYPE.PET_GROOMING ? (
        <PetAdminContent tabActiva={tabActiva} localId={localId} />
      ) : (
        <BeautyAdminContent
          tabActiva={tabActiva}
          estilistas={estilistas}
          estilistaId={estilistaId}
          setEstilistaId={setEstilistaId}
          localId={localId}
        />
      )}
    </div>
  );
};
