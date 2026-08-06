import { useSuscripcion } from "../hooks/useSuscripcion";

interface Props {
  localNombre: string;
  onLogout: () => void;
}

export const AdminHeader = ({ localNombre, onLogout }: Props) => {
  const { data: suscripcion, isLoading, pagarMutation } = useSuscripcion();

  // Calcular días restantes si hay fecha de vencimiento
  let diasRestantes = 999;
  let mostrarAlerta = false;
  let mensajeAlerta = "";
  let tipoAlerta: "peligro" | "advertencia" = "advertencia";

  if (suscripcion?.suscripcion_vencimiento) {
    const hoy = new Date();
    const vencimiento = new Date(suscripcion.suscripcion_vencimiento);
    const diferenciaTiempo = vencimiento.getTime() - hoy.getTime();
    diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));

    if (suscripcion.suscripcion_estado === "vencido" || diasRestantes <= 0) {
      mostrarAlerta = true;
      mensajeAlerta = "⚠️ Tu suscripción ha vencido. Renueva para seguir usando la agenda.";
      tipoAlerta = "peligro";
    } else if (diasRestantes <= 7) {
      mostrarAlerta = true;
      mensajeAlerta = `⏳ Tu suscripción vence en ${diasRestantes} días.`;
      tipoAlerta = "advertencia";
    }
  } else if (suscripcion?.suscripcion_estado === "pendiente_pago") {
    mostrarAlerta = true;
    mensajeAlerta = "👋 ¡Bienvenido! Activa tu suscripción para comenzar a usar la agenda.";
    tipoAlerta = "advertencia";
  }

  return (
    <div>
      {/* BANNER DE ALERTA DE SUSCRIPCIÓN */}
      {mostrarAlerta && !isLoading && (
        <div
          style={{
            background: tipoAlerta === "peligro" ? "#fee2e2" : "#fef3c7",
            color: tipoAlerta === "peligro" ? "#991b1b" : "#92400e",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "14px",
            fontWeight: "500",
            borderBottom: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          <span>{mensajeAlerta}</span>
          <button
            onClick={() => pagarMutation.mutate()}
            disabled={pagarMutation.isPending}
            style={{
              background: tipoAlerta === "peligro" ? "#dc2626" : "#d97706",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              marginLeft: "16px",
            }}
          >
            {pagarMutation.isPending ? "Generando..." : "Pagar Suscripción"}
          </button>
        </div>
      )}

      {/* HEADER ORIGINAL */}
      <div className="admin-header">
        <div>
          <span className="admin-header-title">{localNombre.toUpperCase()}</span>
          <div className="admin-subtitle">Panel Admin</div>
        </div>
        <button className="admin-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};