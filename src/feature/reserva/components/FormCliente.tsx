import { Horarios } from "./Horarios"
import '../styles/FormCliente.css'

interface props {
    nombre: string
    telefono: string
    fecha: string
    disponibles: string[]
    setNombre: (val: string) => void
    setTelefono: (val: string) => void
    setFecha: (val: string) => void
    reservar: (val: string) => void
    servicioId: number | null
}
export const FormCliente = ({
    nombre,
    telefono,
    fecha,
    disponibles,
    setNombre,
    setTelefono,
    setFecha,
    reservar,
    servicioId
}: props) => {

    return (
        <div>
            <div className="rp-step">
                <p className="rp-step-label">Tus datos</p>
                <input
                    className="fc-input"
                    placeholder="Tu nombre completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                />
                <input
                    className="fc-input"
                    placeholder="Tu teléfono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                />
                <input
                    className="fc-input"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                />
            </div>

            {servicioId && (
                <div className="rp-step">
                    <p className="rp-step-label">Horario disponible</p>
                    <Horarios disponibles={disponibles} onSelect={reservar} />
                </div>
            )}
        </div>
    );
}
