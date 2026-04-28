import { useState } from "react";
import { reservarTurnoAdmin } from "../../../api/Admin.api";
import { SelectEstilistas } from "./SelectEstilistas";
import { SelectServicios } from "./SelectServicios";
import { SelectFormCliente } from "./SelectFormClient";
import { useDisponibilidadAdmin } from "../../hook/useDisponibilidadAdmin";
import '../../../reserva/components/Estilistas.css'
import '../../../reserva/components/Servicios.css'
import '../../../reserva/components/FormCliente.css'
import '../../../reserva/components/Horarios.css'

interface props {
    estilistas: any[]
    estilistaId: number | null
    setEstilistaId: (val: any) => void
}

export const ReservarTurnoAdmin = ({ estilistas, estilistaId, setEstilistaId }: props) => {

    const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
    const [servicioId, setServicioId] = useState<number | null>(null);
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [disponibles, setDisponibles] = useState<string[]>([]);


    useDisponibilidadAdmin({ fecha, estilistaId, servicioId, setDisponibles })

    const reservar = async (hora: string) => {
        if (!nombre || !telefono || !fecha || !estilistaId) {
            alert("Completa todos los campos");
            return;
        }

        try {
            const data = await reservarTurnoAdmin({
                fecha,
                hora,
                estilista_id: estilistaId, // ¡Importante! Usa el estado, no el número 5 fijo
                servicio_id: servicioId,
                cliente_nombre: nombre,
                cliente_telefono: telefono,
            });

            if (data.error) {
                alert(data.error);
            } else {
                alert("Turno reservado con éxito");
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
            <div className="rp-step">
                <p className="rp-step-label">Estilista</p>
                <SelectEstilistas estilistaId={estilistaId} setEstilistaId={setEstilistaId} estilistas={estilistas} />
            </div>

            {estilistaId && (
                <div className="rp-step">
                    <p className="rp-step-label">Servicio</p>
                    <SelectServicios estilistaId={estilistaId} servicioId={servicioId} setServicioId={setServicioId} />
                </div>
            )}

            <SelectFormCliente
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
    )
}