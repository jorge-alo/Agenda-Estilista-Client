import { useState } from "react";
import '../../../reserva/styles/Estilistas.css'
import '../../../reserva/styles/Servicios.css'
import '../../../reserva/styles/FormCliente.css'
import '../../../reserva/styles/Horarios.css'
import { SelectEstilistas } from "./SelectEstilistas";
import { SelectServicios } from "./SelectServicios";
import { SelectFormCliente } from "./SelectFormClient";
import { useReservarTurnoAdmin } from "../mutations/useReservarTurnoAdmin";
import { useDisponibilidadAdmin } from "../hooks/useDisponibilidadAdmin";

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
    const reservarMutation = useReservarTurnoAdmin();

    const {
        data: disponibles = [],
        
    } = useDisponibilidadAdmin({
        fecha,
        estilistaId,
        servicioId,
    });

    const reservar = async (
        hora: string
    ) => {

        if (
            !nombre ||
            !telefono ||
            !fecha ||
            !estilistaId ||
            !servicioId
        ) {
            alert("Completa todos los campos");
            return;
        }

            await reservarMutation.mutateAsync({
                fecha,
                hora,
                estilista_id: estilistaId,
                servicio_id: servicioId,
                cliente_nombre: nombre,
                cliente_telefono: telefono,
            });

            setNombre("");
            setTelefono("");
            setServicioId(null);
            setEstilistaId(null);

        
    };

    return (
        reservarMutation.isPending ? 
            <p>Reservando turno...</p>
            : 
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