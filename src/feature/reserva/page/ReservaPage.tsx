import { useState } from "react";
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

export const ReservaPage = () => {

  const { slug } = useParams();
  const {
    register,
    reset,
    handleSubmit,
      getValues,
    formState: { errors }
  } = useReservaForm();

  const [fecha, setFecha] = useState(getFechaLocal());
  const [servicioId, setServicioId] = useState<number | null>(null);
  const [estilistaId, setEstilistaId] = useState<number | null>(null);
  const [servicio, setServicio] = useState("");
  const reservarMutation = useReservarTurno();

  //const fecha = watch("fecha") || getFechaLocal();


  // INFO LOCAL
  const {
    data: infoLocal,
  } = useInfoLocal(slug || "");

  // DISPONIBILIDAD
  const {
    data: disponibilidadData,
  } = useDisponibilidadQuery({
    slug: slug || "",
    fecha,
    estilistaId,
    servicioId,
  });

  const disponibles =
    disponibilidadData?.disponibles || [];

  if (!slug) {
    return <p>Local no encontrado</p>;
  }

  const reservar = (hora: string) =>
    handleSubmit(
      async (formData) => {

        try {

          const data =
            await reservarMutation.mutateAsync({
              slug,
              fecha,
              hora,

              estilista_id:
                estilistaId,

              servicio_id:
                servicioId,

              cliente_nombre:
                formData.nombre,

              cliente_telefono:
                formData.telefono,
            });

          const mensaje =
            `💈 Nuevo turno

📅 Fecha: ${fecha}
⏰ Hora: ${hora}
💇 Servicio: ${servicio}
👤 Cliente: ${formData.nombre}
📞 Teléfono: ${formData.telefono}`;

          const url =
            `https://wa.me/${data.telefono}?text=${encodeURIComponent(mensaje)}`;

          alert(
            "Turno reservado con éxito. Te redirigimos a WhatsApp..."
          );
          console.log("🧹 Reseteando formulario...");
          reset({
            nombre: "",
            telefono: "",
          });
          setFecha(getFechaLocal());
          setServicioId(null);
          setEstilistaId(null);

          window.open(url, "_blank");

        } catch (error) {

          console.error(error);
        }

      },
      (formErrors) => {
        console.log("❌ Validación falló:", formErrors); // 👈 nuevo
         console.log("📋 Valores internos de RHF:", getValues()); 
         toast.error("Completá tu nombre y teléfono antes de reservar");
      }
    )();

  return (
    <div>

      <div className="rp-hero">

        <p className="rp-hero-tag">
          Reserva tu turno
        </p>

        <h1 className="rp-hero-title">
          {infoLocal?.nombreLocal || "Cargando..."}
        </h1>

        <p className="rp-hero-sub">
          Elegí tu estilista, servicio y horario
        </p>

      </div>

      {(infoLocal?.descripcion ||
        infoLocal?.direccion ||
        infoLocal?.horario_apertura) && (

          <div className="rp-info-local">

            {infoLocal?.descripcion && (
              <p className="rp-info-desc">
                {infoLocal.descripcion}
              </p>
            )}

            {infoLocal?.direccion && (
              <p className="rp-info-item">
                📍 {infoLocal.direccion}
              </p>
            )}

            {infoLocal?.horario_apertura &&
              infoLocal?.horario_cierre && (

                <p className="rp-info-item">
                  🕐{" "}
                  {infoLocal.horario_apertura.slice(0, 5)}
                  {" - "}
                  {infoLocal.horario_cierre.slice(0, 5)}
                </p>
              )}
          </div>
        )}

      <div className="rp-body">

        <div className="rp-step">

          <p className="rp-step-label">
            Estilista
          </p>

          <Estilistas
            slug={slug}
            estilistaId={estilistaId}
            setEstilistaId={setEstilistaId}
          />
        </div>

        {estilistaId && (

          <div className="rp-step">

            <p className="rp-step-label">
              Servicio
            </p>

            <Servicios
              estilistaId={estilistaId}
              servicioId={servicioId}
              setServicioId={setServicioId}
              setServicio={setServicio}
            />
          </div>
        )}

        <FormCliente
          disponibles={disponibles}
          register={register}
          errors={errors}
          reservar={reservar}
          servicioId={servicioId}
          fecha={fecha}
          onFechaChange={setFecha}
        />
      </div>
    </div>
  );
};
