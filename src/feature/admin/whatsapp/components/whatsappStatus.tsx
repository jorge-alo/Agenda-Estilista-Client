import "../styles/whatsappStatus.css";

import {useWhatsAppEstado} from "../hooks/useWhatsAppEstado";

import {useGenerarQR} from "../mutations/useGenerarQR";

interface Props {
  localId: string;
}

export const WhatsAppStatus =
({
  localId
}: Props) => {

  const {
    data,
    isLoading,
    refetch,
  } = useWhatsAppEstado(
    localId
  );

  const qrMutation =
    useGenerarQR();

  const conectado =
    data?.conectado;

  const qr =
    qrMutation.data?.qr;

  return (

    <div className="whatsapp-status">

      <div className="whatsapp-status-header">

        <span className="whatsapp-status-title">
          WhatsApp
        </span>

        <div
          className={`whatsapp-badge ${
            conectado
              ? "conectado"
              : "desconectado"
          }`}
        >

          {isLoading
            ? "Verificando..."
            : conectado
            ? "✓ Conectado"
            : "✗ Desconectado"}

        </div>

      </div>

      {conectado === false && (

        <div className="whatsapp-status-body">

          <p className="whatsapp-hint">

            Escaneá el QR con el
            WhatsApp del local para
            activar las notificaciones.

          </p>

          <button
            className="whatsapp-btn"

            onClick={() =>
              qrMutation.mutate(
                localId
              )
            }

            disabled={
              qrMutation.isPending
            }
          >

            {qrMutation.isPending
              ? "Generando QR..."
              : "Mostrar QR"}

          </button>

          {qr && (

            <div className="whatsapp-qr-wrapper">

              <img
                src={qr}
                alt="QR WhatsApp"
                className="whatsapp-qr"
              />

              <p className="whatsapp-qr-hint">

                El QR expira en
                20 segundos.

              </p>

              <button
                className="whatsapp-btn-secondary"

                onClick={() =>
                  qrMutation.mutate(
                    localId
                  )
                }
              >

                Generar nuevo QR

              </button>

            </div>
          )}

        </div>
      )}

      {conectado === true && (

        <div className="whatsapp-status-body">

          <p className="whatsapp-hint">

            Las notificaciones
            automáticas están activas.

          </p>

          <button
            className="whatsapp-btn-secondary"
            onClick={() => refetch()}
          >

            Verificar conexión

          </button>

        </div>
      )}

    </div>
  );
};