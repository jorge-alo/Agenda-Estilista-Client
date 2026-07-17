// components/AdminContent.tsx

import { Resumen } from "../../../dashboard/components/Resumen";
import { AgendaLista } from "../../../agenda/components/AgendaLista";
import { ReservarTurnoAdmin }from "../../../reservar/components/ReservarTurnoAdmini";
import { ClientesPage }from "../../../clientes/pages/ClientesPage";
import { EstilistasAdmin }from "../../../estilistas/componentes/EstilistasAdmin";
import { ServiciosAdmin }from "../../../servicios/components/ServiciosAdmin";
import { BloqueosAdmin }from "../../../bloqueos/components/BloqueosAdmin";
import { ConfiguracionPage }from "../../../configuracion/page/ConfiguracionPage";
import { WhatsAppStatus }from "../../../whatsapp/components/whatsappStatus";
import { HorariosAdmin } from "../../../horarios/components/HorariosAdmin";
import type { Estilista } from "../../../estilistas/types/estilistas.types";
import { ErrorBoundary } from "../../../../../shared/ui/ErrorBoundary";

interface Props {
  tabActiva: string;
  estilistas: Estilista[];
  estilistaId: number | null;
  setEstilistaId: (id: number | null) => void;
  localId: string;
}

export const AdminContent = ({ tabActiva, estilistas, estilistaId, setEstilistaId, localId }: Props) => {
  return (
    <div className="admin-content">
      {tabActiva === "dashboard" && (
        <ErrorBoundary key="dashboard"><Resumen /></ErrorBoundary>
      )}

      {tabActiva === "agenda" && (
        <ErrorBoundary key="agenda"><AgendaLista estilistas={estilistas} /></ErrorBoundary>
      )}

      {tabActiva === "reservar" && (
        <ErrorBoundary key="reservar">
          <ReservarTurnoAdmin
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
            estilistas={estilistas}
          />
        </ErrorBoundary>
      )}

      {tabActiva === "clientes" && (
        <ErrorBoundary key="clientes"><ClientesPage /></ErrorBoundary>
      )}

      {tabActiva === "estilistas" && (
        <ErrorBoundary key="estilistas"><EstilistasAdmin /></ErrorBoundary>
      )}

      {tabActiva === "servicios" && (
        <ErrorBoundary key="servicios">
          <ServiciosAdmin
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
            estilistas={estilistas}
          />
        </ErrorBoundary>
      )}

      {tabActiva === "horarios" && (
        <ErrorBoundary key="horarios">
          <HorariosAdmin
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
            estilistas={estilistas}
          />
        </ErrorBoundary>
      )}

      {tabActiva === "bloqueos" && (
        <ErrorBoundary key="bloqueos"><BloqueosAdmin estilistas={estilistas} /></ErrorBoundary>
      )}

      {tabActiva === "configuracion" && (
        <ErrorBoundary key="configuracion"><ConfiguracionPage /></ErrorBoundary>
      )}

      {tabActiva === "whatsapp" && (
        <ErrorBoundary key="whatsapp"><WhatsAppStatus localId={localId} /></ErrorBoundary>
      )}
    </div>
  );
};