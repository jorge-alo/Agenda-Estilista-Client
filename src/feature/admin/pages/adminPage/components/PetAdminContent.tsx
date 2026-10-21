import { ErrorBoundary } from "../../../../../shared/ui/ErrorBoundary";
import { PetAgenda } from "../../../petAgenda/components/PetAgenda";
import { PetAdminBookingForm } from "../../../petBooking/components/PetAdminBookingForm";
import { PetManagement } from "../../../petManagement/components/PetManagement";
import type { RegisterPetManagementNavigation } from "../../../petManagement/state/petManagementNavigation";
import { PetServiciosAdmin } from "../../../petServicios/components/PetServiciosAdmin";
import { PetExtrasAdmin } from "../../../petExtras/components/PetExtrasAdmin";
import { PetHorariosAdmin } from "../../../petHorarios/components/PetHorariosAdmin";
import { PetBloqueosAdmin } from "../../../petBloqueos/components/PetBloqueosAdmin";
import { PetSettingsAdmin } from "../../../petSettings/components/PetSettingsAdmin";
import { WhatsAppStatus } from "../../../whatsapp/components/whatsappStatus";
import { getAdminTabLabel } from "../adminTabs";
import { getPetAdminContentKind } from "../petAdminContent";
import type { AdminTab } from "../types/adminPage.types";
import { PetAdminPlaceholder } from "./PetAdminPlaceholder";

interface Props {
  tabActiva: AdminTab;
  localId: string;
  registerNavigation?: RegisterPetManagementNavigation;
}

const DESCRIPTIONS: Partial<Record<AdminTab, string>> = {
  solicitudes: "Esta sección PET todavía no está implementada.",
  bloqueos: "Esta sección PET todavía no está implementada.",
};

export const PetAdminContent = ({ tabActiva, localId, registerNavigation }: Props) => {
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

  if (contentKind === "mascotas") {
    return (
      <ErrorBoundary key="pet-mascotas"><PetManagement key={localId} localId={localId} registerNavigation={registerNavigation} /></ErrorBoundary>
    );
  }

  if (contentKind === "servicios") {
    return <ErrorBoundary key="pet-servicios"><PetServiciosAdmin localId={localId} /></ErrorBoundary>;
  }

  if (contentKind === "extras") {
    return <ErrorBoundary key="pet-extras"><PetExtrasAdmin localId={localId} /></ErrorBoundary>;
  }

  if (contentKind === "horarios") {
    return <ErrorBoundary key="pet-horarios"><PetHorariosAdmin localId={localId} registerNavigation={registerNavigation} /></ErrorBoundary>;
  }

  if (contentKind === "bloqueos") {
    return <ErrorBoundary key="pet-bloqueos"><PetBloqueosAdmin localId={localId} registerNavigation={registerNavigation} /></ErrorBoundary>;
  }

  if (contentKind === "configuracion") {
    return <ErrorBoundary key="pet-configuracion"><PetSettingsAdmin localId={localId} registerNavigation={registerNavigation} /></ErrorBoundary>;
  }

  if (contentKind === "whatsapp") {
    return (
      <ErrorBoundary key="pet-whatsapp"><WhatsAppStatus localId={localId} /></ErrorBoundary>
    );
  }

  return null;
};
