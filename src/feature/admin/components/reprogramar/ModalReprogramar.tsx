import { useState } from "react";
import { getAuthHeaders } from "../../../auth/auth.helpers";
import './modalReprogramar.css'
interface ModalReprogramarProps {
    turno: any; // el turno que querés editar
    estilistas: any[];
    servicios: any[];
    onClose: () => void;
    onSuccess: () => void; // para recargar agenda
}
const API_URL = import.meta.env.VITE_API_URL;

export const ModalReprogramar = ({ turno, estilistas, servicios, onClose, onSuccess }: ModalReprogramarProps) => {
    const [form, setForm] = useState({
        fecha: turno.fecha,
        hora: turno.hora?.slice(0, 5),
        estilista_id: turno.estilista_id,
        servicio_id: turno.servicio_id,
        cliente_nombre: turno.cliente_nombre,
        cliente_telefono: turno.cliente_telefono,
    });
console.log("Valor de form en ModalReprogramar", form);
    const handleChange = (e: any) => {
        const { name, value } = e.target;

        setForm({
            ...form,
            [name]: name.includes("_id") ? Number(value) : value,
        });
    };

    const handleSubmit = async () => {
        try {
            const res = await fetch(`${API_URL}/api/turnos/${turno.id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Error");
                return;
            }

            onSuccess(); // recargar agenda
            onClose();   // cerrar modal
        } catch (error) {
            console.log(error);
        }
    };

    return (
    <div className="modal-overlay">
        <div className="modal">
            <h2 className="modal-titulo">Reprogramar turno</h2>

            <label className="modal-label">Fecha</label>
            <input className="modal-input" type="date" name="fecha" value={form.fecha} onChange={handleChange} />

            <label className="modal-label">Hora</label>
            <input className="modal-input" type="time" name="hora" value={form.hora} onChange={handleChange} />

            <label className="modal-label">Estilista</label>
            <select className="modal-input" name="estilista_id" value={form.estilista_id} onChange={handleChange}>
                <option value="">Seleccionar estilista</option>
                {estilistas.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
            </select>

            <label className="modal-label">Servicio</label>
            <select className="modal-input" name="servicio_id" value={form.servicio_id} onChange={handleChange}>
                <option value="">Seleccionar servicio</option>
                {servicios.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
            </select>

            <label className="modal-label">Nombre del cliente</label>
            <input className="modal-input" type="text" name="cliente_nombre" value={form.cliente_nombre} onChange={handleChange} />

            <label className="modal-label">Teléfono</label>
            <input className="modal-input" type="text" name="cliente_telefono" value={form.cliente_telefono} onChange={handleChange} />

            <div className="modal-acciones">
                <button className="modal-btn primary" onClick={handleSubmit}>
                    Guardar
                </button>
                <button className="modal-btn secondary" onClick={onClose}>
                    Cancelar
                </button>
            </div>
        </div>
    </div>
);
};
