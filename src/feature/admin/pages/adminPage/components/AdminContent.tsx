// components/AdminContent.tsx

import { Resumen }
from "../../../dashboard/components/Resumen";

import { AgendaLista }
from "../../../agenda/components/AgendaLista";

import { ReservarTurnoAdmin }
from "../../../reservar/components/ReservarTurnoAdmini";

import { ClientesPage }
from "../../../clientes/pages/ClientesPage";

import { EstilistasAdmin }
from "../../../estilistas/componentes/EstilistasAdmin";

import { ServiciosAdmin }
from "../../../servicios/components/ServiciosAdmin";

import { HorariosAdmin }
from "../../../components/HorariosAdmin";

import { BloqueosAdmin }
from "../../../bloqueos/components/BloqueosAdmin";

import { ConfiguracionPage }
from "../../../configuracion/page/ConfiguracionPage";

import { WhatsAppStatus }
from "../../../components/whatsappStatus";

interface Props {
  tabActiva: string;

  estilistas: any[];

  estilistaId: number | null;

  setEstilistaId:
    (id: number | null) => void;

  localId: string;
}

export const AdminContent =
({
  tabActiva,
  estilistas,
  estilistaId,
  setEstilistaId,
  localId,
}: Props) => {

  return (

    <div className="admin-content">

      {tabActiva === "dashboard" && (
        <Resumen />
      )}

      {tabActiva === "agenda" && (
        <AgendaLista
          estilistas={estilistas}
        />
      )}

      {tabActiva === "reservar" && (
        <ReservarTurnoAdmin
          estilistaId={estilistaId}
          setEstilistaId={setEstilistaId}
          estilistas={estilistas}
        />
      )}

      {tabActiva === "clientes" && (
        <ClientesPage />
      )}

      {tabActiva === "estilistas" && (
        <EstilistasAdmin />
      )}

      {tabActiva === "servicios" && (
        <ServiciosAdmin
          estilistaId={estilistaId}
          setEstilistaId={setEstilistaId}
          estilistas={estilistas}
        />
      )}

      {tabActiva === "horarios" && (
        <HorariosAdmin
          estilistaId={estilistaId}
          setEstilistaId={setEstilistaId}
          estilistas={estilistas}
        />
      )}

      {tabActiva === "bloqueos" && (
        <BloqueosAdmin
          estilistas={estilistas}
        />
      )}

      {tabActiva === "configuracion" && (
        <ConfiguracionPage />
      )}

      {tabActiva === "whatsapp" && (
        <WhatsAppStatus
          localId={localId}
        />
      )}

    </div>
  );
};