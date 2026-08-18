import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Estilistas } from "../components/Estilistas";
import { FormCliente } from "../components/FormCliente";
import { Servicios } from "../components/Servicios";
import { useReservarTurno } from "../mutations/useReservarTurno";
import "../styles/ReservaPage.css";
import { useDisponibilidadQuery } from "../queries/useDisponibilidadQuery";
import { useInfoLocal } from "../queries/useInfoLocalQuery";
import { useReservaForm } from "../hooks/useReservaForm";
import { getFechaLocal } from "../../../shared/helpers/date.helpers";
import { toast } from "sonner";
import { ErrorBoundary } from "../../../shared/ui/ErrorBoundary";

export const ReservaPage = () => {
  const { slug } = useParams();

  const {
    reset,
    handleSubmit,
    control,
    formState: { errors }
  } = useReservaForm();

  const [fecha, setFecha] = useState(getFechaLocal());
  const [servicioId, setServicioId] = useState<number | null>(null);
  const [estilistaId, setEstilistaId] = useState<number | null>(null);
  const [servicio, setServicio] = useState("");
  const reservarMutation = useReservarTurno();

  // 1. OBTENER INFO DEL LOCAL
  const { data: infoLocal, error, isLoading } = useInfoLocal(slug || "");

  // ✅ FIX: este hook ahora se llama SIEMPRE, antes de cualquier return.
  // Así el orden y la cantidad de hooks es igual en todos los renders.
  const {
    data: disponibilidadData,
    isLoading: loadingDisponibilidad,
  } = useDisponibilidadQuery({
    slug: slug || "",
    fecha,
    estilistaId,
    servicioId,
  });

  const disponibles = disponibilidadData?.disponibles || [];

   useEffect(() => {
    if (infoLocal?.nombreLocal) {
      document.title = `${infoLocal.nombreLocal} | AgendaOK`;
    } else if (slug) {
      // Mientras carga el local, mostramos el slug formateado
      const slugFormateado = slug
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      document.title = `${slugFormateado} | AgendaOK`;
    }
  }, [infoLocal?.nombreLocal, slug]);

  // 2. ✅ BLOQUEO TOTAL: recién ACÁ, después de haber llamado todos los hooks,
  // podemos cortar el render condicionalmente.
  if (error?.message === "LOCAL_SUSCRIPCION_VENCIDA") {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
          <h1 style={{
            fontFamily: 'var(--font-serif, serif)',
            fontSize: '24px',
            marginBottom: '16px',
            color: '#111827'
          }}>
            Agenda temporalmente no disponible
          </h1>
          <p style={{
            color: '#6b7280',
            maxWidth: '400px',
            margin: '0 auto',
            lineHeight: '1.5'
          }}>
            Este negocio está actualizando su cuenta. Por favor, intenta reservar más tarde o contacta al local por otros medios.
          </p>
        </div>
      </div>
    );
  }

  // 3. Si está cargando o no hay slug, mostramos loaders o mensajes simples
  if (!slug) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Local no encontrado</p>;
  if (isLoading) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Cargando información del local...</p>;

  const reservar = (hora: string) =>
    handleSubmit(
      async (formData) => {
        try {
          const data = await reservarMutation.mutateAsync({
            slug,
            fecha,
            hora,
            estilista_id: estilistaId,
            servicio_id: servicioId,
            cliente_nombre: formData.nombre,
            cliente_telefono: formData.telefono,
          });

          if (data.mpLink) {
            toast.success("¡Turno pre-reservado! Redirigiendo al pago de la seña...");
            setTimeout(() => {
              window.location.href = data.mpLink;
            }, 1500);
            return;
          }

          const mensaje = `💈 Nuevo turno\n\n📅 Fecha: ${fecha}\n⏰ Hora: ${hora}\n💇 Servicio: ${servicio}\n👤 Cliente: ${formData.nombre}\n📞 Teléfono: ${formData.telefono}`;
          const url = `https://wa.me/${data.telefono}?text=${encodeURIComponent(mensaje)}`;

          toast.success("Turno reservado con éxito. Te redirigimos a WhatsApp...");
          reset();
          setFecha(getFechaLocal());
          setServicioId(null);
          setEstilistaId(null);

          window.open(url, "_blank");
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || "Error al reservar el turno");
        }
      },
      (formErrors) => {
        console.log("❌ Validación falló:", formErrors);
        toast.error("Completá tu nombre y teléfono antes de reservar");
      }
    )();

  // 4. RENDERIZADO NORMAL (Solo si todo está bien)
  return (
    <div className="reserva-page-container">
      <div className="rp-hero">
        <p className="rp-hero-tag">Reserva tu turno</p>
        <h1 className="rp-hero-title">{infoLocal?.nombreLocal || "Cargando..."}</h1>
        <p className="rp-hero-sub">Elegí tu estilista, servicio y horario</p>
      </div>

      {(infoLocal?.descripcion || infoLocal?.direccion || infoLocal?.horario_apertura) && (
        <div className="rp-info-local">
          {infoLocal?.descripcion && <p className="rp-info-desc">{infoLocal.descripcion}</p>}
          {infoLocal?.direccion && <p className="rp-info-item">📍 {infoLocal.direccion}</p>}
          {infoLocal?.horario_apertura && infoLocal?.horario_cierre && (
            <p className="rp-info-item">
              🕐 {infoLocal.horario_apertura.slice(0, 5)} - {infoLocal.horario_cierre.slice(0, 5)}
            </p>
          )}
        </div>
      )}

      <ErrorBoundary>
        <div className="rp-body">
          <div className="rp-step" key="estilista-step">
            <p className="rp-step-label">Profesionales</p>
            <Estilistas slug={slug} estilistaId={estilistaId} setEstilistaId={setEstilistaId} />
          </div>

          {estilistaId && (
            <div className="rp-step" key="servicio-step">
              <p className="rp-step-label">Servicio</p>
              <Servicios estilistaId={estilistaId} servicioId={servicioId} setServicioId={setServicioId} setServicio={setServicio} />
            </div>
          )}

          <FormCliente
            control={control}
            disponibles={disponibles}
            loadingDisponibles={loadingDisponibilidad}
            errors={errors}
            reservar={reservar}
            servicioId={servicioId}
            fecha={fecha}
            onFechaChange={setFecha}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
};
