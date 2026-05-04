import { useState } from "react";
import { Estilistas } from "./components/Estilistas";
import { FormCliente } from "./components/FormCliente";
import { reservarTurno } from "./reserva.api";
import { useDisponibilidad} from "./reserva.hooks";
import type { InfoLocal } from "./reserva.hooks";
import { Servicios } from "./components/Servicios";
import { useParams } from "react-router-dom";
import './ReservaPage.css'

export const ReservaPage = () => {
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [servicioId, setServicioId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estilistaId, setEstilistaId] = useState<number | null>(null);
  const [disponibles, setDisponibles] = useState<string[]>([]);
  const [servicio, setServicio] = useState("");
  const [infoLocal, setInfoLocal] = useState<InfoLocal>({
    nombreLocal: "",
    descripcion: "",
    direccion: "",
    telefono: "",
    horario_apertura: "",
    horario_cierre: "",
  });

  const { slug } = useParams();

  useDisponibilidad({ slug: slug || "", fecha, estilistaId, servicioId, setDisponibles, setInfoLocal });

  if (!slug) return <p>Local no encontrado</p>;

  const reservar = async (hora: string) => {
    if (!nombre || !telefono || !fecha || !estilistaId) {
      alert("Completa todos los campos");
      return;
    }
    try {
      const data = await reservarTurno({
        slug, fecha, hora,
        estilista_id: estilistaId,
        servicio_id: servicioId,
        cliente_nombre: nombre,
        cliente_telefono: telefono,
      });

      if (data.error) {
        alert(data.error);
      } else {
        const mensaje = `💈 Nuevo turno\n\n📅 Fecha: ${fecha}\n⏰ Hora: ${hora}\n💇 Servicio: ${servicio}\n👤 Cliente: ${nombre}\n📞 Teléfono: ${telefono}`;
        const url = `https://wa.me/${data.telefono}?text=${encodeURIComponent(mensaje)}`;
        alert("Turno reservado con éxito. Te redirigimos a WhatsApp...");
        window.open(url, "_blank");
        setNombre("");
        setTelefono("");
        setServicioId(null);
        setEstilistaId(null);
      }
    } catch {
      alert("Error de conexión con el servidor");
    }
  };

  return (
    <div>
      <div className="rp-hero">
        <p className="rp-hero-tag">Reserva tu turno</p>
        <h1 className="rp-hero-title">{infoLocal.nombreLocal || "Cargando..."}</h1>
        <p className="rp-hero-sub">Elegí tu estilista, servicio y horario</p>
      </div>

      {(infoLocal.descripcion || infoLocal.direccion || infoLocal.horario_apertura) && (
        <div className="rp-info-local">
          {infoLocal.descripcion && (
            <p className="rp-info-desc">{infoLocal.descripcion}</p>
          )}
          {infoLocal.direccion && (
            <p className="rp-info-item">📍 {infoLocal.direccion}</p>
          )}
          {infoLocal.horario_apertura && infoLocal.horario_cierre && (
            <p className="rp-info-item">
              🕐 {infoLocal.horario_apertura.slice(0, 5)} - {infoLocal.horario_cierre.slice(0, 5)}
            </p>
          )}
        </div>
      )}

      <div className="rp-body">
        <div className="rp-step">
          <p className="rp-step-label">Estilista</p>
          <Estilistas slug={slug} estilistaId={estilistaId} setEstilistaId={setEstilistaId} />
        </div>

        {estilistaId && (
          <div className="rp-step">
            <p className="rp-step-label">Servicio</p>
            <Servicios
              estilistaId={estilistaId}
              servicioId={servicioId}
              setServicioId={setServicioId}
              setServicio={setServicio}
            />
          </div>
        )}

        <FormCliente
          nombre={nombre}
          telefono={telefono}
          fecha={fecha}
          disponibles={disponibles}
          setNombre={setNombre}
          setTelefono={setTelefono}
          setFecha={setFecha}
          reservar={reservar}
          servicioId={servicioId}
        />
      </div>
    </div>
  );
};

