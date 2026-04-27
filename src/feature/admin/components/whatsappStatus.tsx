// src/feature/admin/components/WhatsAppStatus.tsx
import { useEffect, useState } from "react";
import { getWhatsAppEstado, getWhatsAppQR } from "../Admin.api";
import { getAuthHeaders } from "../../auth/auth.helpers";
import './whatsappStatus.css'
interface Props {
  localId: string;
}

export const WhatsAppStatus = ({ localId }: Props) => {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const verificarEstado = async () => {
    try {
      const data = await getWhatsAppEstado(localId, getAuthHeaders());
      setConectado(data.conectado);
      if (data.conectado) setQr(null);
    } catch {
      setConectado(false);
    }
  };

  const solicitarQR = async () => {
    setCargando(true);
    setQr(null);
    try {
      const data = await getWhatsAppQR(localId, getAuthHeaders());
      if (data.qr) setQr(data.qr);
    } catch {
      console.error("Error obteniendo QR");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    verificarEstado();
    // Verifica el estado cada 30 segundos
    const interval = setInterval(verificarEstado, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="whatsapp-status">
      <div className="whatsapp-status-header">
        <span className="whatsapp-status-title">WhatsApp</span>
        <div className={`whatsapp-badge ${conectado ? "conectado" : "desconectado"}`}>
          {conectado === null
            ? "Verificando..."
            : conectado
            ? "✓ Conectado"
            : "✗ Desconectado"}
        </div>
      </div>

      {conectado === false && (
        <div className="whatsapp-status-body">
          <p className="whatsapp-hint">
            Escaneá el QR con el WhatsApp del local para activar las notificaciones automáticas.
          </p>
          <button
            className="whatsapp-btn"
            onClick={solicitarQR}
            disabled={cargando}
          >
            {cargando ? "Generando QR..." : "Mostrar QR"}
          </button>

          {qr && (
            <div className="whatsapp-qr-wrapper">
              <img
                src={qr}
                alt="QR WhatsApp"
                className="whatsapp-qr"
              />
              <p className="whatsapp-qr-hint">
                El QR expira en 20 segundos. Si vence, generá uno nuevo.
              </p>
              <button className="whatsapp-btn-secondary" onClick={solicitarQR}>
                Generar nuevo QR
              </button>
            </div>
          )}
        </div>
      )}

      {conectado === true && (
        <div className="whatsapp-status-body">
          <p className="whatsapp-hint">
            Las notificaciones automáticas están activas. Los clientes recibirán confirmación y recordatorio de turno.
          </p>
          <button className="whatsapp-btn-secondary" onClick={verificarEstado}>
            Verificar conexión
          </button>
        </div>
      )}
    </div>
  );
};