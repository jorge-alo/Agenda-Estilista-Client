import { ErrorBoundary } from "../../../../../shared/ui/ErrorBoundary";
import { PetAgenda } from "../../../petAgenda/components/PetAgenda";
import { PetAdminBookingForm } from "../../../petBooking/components/PetAdminBookingForm";
import { WhatsAppStatus } from "../../../whatsapp/components/whatsappStatus";
import { getAdminTabLabel } from "../adminTabs";
import { getPetAdminContentKind } from "../petAdminContent";
import type { AdminTab } from "../types/adminPage.types";
import { PetAdminPlaceholder } from "./PetAdminPlaceholder";

interface Props {
  tabActiva: AdminTab;
  localId: string;
}

const DESCRIPTIONS: Partial<Record<AdminTab, string>> = {
  solicitudes: "Esta sección PET todavía no está implementada.",
  mascotas: "Esta sección PET todavía no está implementada.",
  servicios: "Esta sección PET todavía no está implementada.",
  extras: "Esta sección PET todavía no está implementada.",
  horarios: "Esta sección PET todavía no está implementada.",
  bloqueos: "Esta sección PET todavía no está implementada.",
  configuracion:
    "La configuración compartida actual incluye opciones de BEAUTY. Se implementará una vista específica para PET.",
};

export const PetAdminContent = ({ tabActiva, localId }: Props) => {
  const contentKind = getPetAdminContentKind(tabActiva);

  if (contentKind === "placeholder") {
    const description = DESCRIPTIONS[tabActiva] ?? "Esta sección PET todavía no está implementada.";

    return (
      <ErrorBoundary key={`pet-${tabActiva}`}>
        <PetAdminPlaceholder
          id={tabActiva}
          title={`${getAdminTabLabel(tabActiva)} PET`}
          description={description}
        />
      </ErrorBoundary>
    );
  }

  if (contentKind === "agenda") {
    return (
      <ErrorBoundary key="pet-agenda"><PetAgenda /></ErrorBoundary>
    );
  }

  if (contentKind === "reservar") {
    return (
      <ErrorBoundary key="pet-reservar"><PetAdminBookingForm /></ErrorBoundary>
    );
  }

  if (contentKind === "whatsapp") {
    return (
      <ErrorBoundary key="pet-whatsapp"><WhatsAppStatus localId={localId} /></ErrorBoundary>
    );
  }

  return null;
};
