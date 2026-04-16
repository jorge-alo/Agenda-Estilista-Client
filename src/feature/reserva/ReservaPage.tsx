import { useState } from "react";
import { Estilistas } from "./components/Estilistas";
import { FormCliente } from "./components/FormCliente";
import { reservarTurno } from "./reserva.api";
import { useDisponibilidad } from "./reserva.hooks";
import { Servicios } from "./components/Servicios";
import { useParams } from "react-router-dom";
import './ReservaPage.css'

export const ReservaPage = () => {

    const [fecha, setFecha] = useState("2026-03-31");
    const [servicioId, setServicioId] = useState<number | null>(null);
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [estilistaId, setEstilistaId] = useState<number | null>(null);
    const [disponibles, setDisponibles] = useState<string[]>([]);
    const [nombreLocal, setNombreLocal] = useState("");
    const [servicio, setServicio] = useState("");
    const { slug } = useParams();

    useDisponibilidad({ slug: slug || "", fecha, estilistaId, servicioId, setDisponibles, setNombreLocal })

    if (!slug) {
        return <p>Local no encontrado</p>;
    }
    console.log("Valor de disponibles en ReservaPage", disponibles);

    const reservar = async (hora: string) => {
        if (!nombre || !telefono || !fecha || !estilistaId) {
            alert("Completa todos los campos");
            return;
        }

        try {
            const data = await reservarTurno({
                slug,
                fecha,
                hora,
                estilista_id: estilistaId,
                servicio_id: servicioId,
                cliente_nombre: nombre,
                cliente_telefono: telefono,
            });

            console.log("Valor de data en  reservar", data);

            if (data.error) {
                alert(data.error);
            } else {

                // 🔥 MENSAJE WHATSAPP
                const mensaje = `💈 Nuevo turno

📅 Fecha: ${fecha}
⏰ Hora: ${hora}
💇 Servicio: ${servicio}
👤 Cliente: ${nombre}
📞 Teléfono: ${telefono}`;

                const telefonoLocal = `${data.telefono}`;

                const url = `https://wa.me/${telefonoLocal}?text=${encodeURIComponent(mensaje)}`;

                // 🔥 abrir WhatsApp
                alert("Turno reservado con éxito. Te redirigimos a WhatsApp...");
                    window.open(url, "_blank");
                
                setNombre("");
                setTelefono("");
                setServicioId(null);
                setEstilistaId(null);
            }
        } catch (error) {
            alert("Error de conexión con el servidor");
        }
    };

    return (
        <div>
            <div className="rp-hero">
                <p className="rp-hero-tag">Reserva tu turno</p>
                <h1 className="rp-hero-title">{nombreLocal || "Cargando..."}</h1>
                <p className="rp-hero-sub">Elegí tu estilista, servicio y horario</p>
            </div>

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
}

