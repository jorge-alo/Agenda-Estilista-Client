import { useState } from "react";
import { updateConfiguracion } from "../services/configuracion.service";
import "../styles/ConfiguracionForm.css";

interface Props {
  inicial: {
    nombre: string;
    telefono: string;
    direccion: string;
    descripcion: string;
    horario_apertura: string;
    horario_cierre: string;
  };
  onActualizado: (data: any) => void;
}

export const ConfiguracionForm = ({ inicial, onActualizado }: Props) => {
  const [form, setForm] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      const updated = await updateConfiguracion(form);
      onActualizado(updated.data);
      setMensaje("Configuración guardada correctamente");
    } catch {
      setError("Error al guardar la configuración");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="config-form">
      <div className="config-field">
        <label>Nombre del local</label>
        <input name="nombre" value={form.nombre} onChange={handleChange} />
      </div>
      <div className="config-field">
        <label>Teléfono</label>
        <input name="telefono" value={form.telefono} onChange={handleChange} />
      </div>
      <div className="config-field">
        <label>Dirección</label>
        <input name="direccion" value={form.direccion} onChange={handleChange} />
      </div>
      <div className="config-field">
        <label>Descripción</label>
        <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows={3} />
      </div>
      <div className="config-row">
        <div className="config-field">
          <label>Apertura</label>
          <input type="time" name="horario_apertura" value={form.horario_apertura} onChange={handleChange} />
        </div>
        <div className="config-field">
          <label>Cierre</label>
          <input type="time" name="horario_cierre" value={form.horario_cierre} onChange={handleChange} />
        </div>
      </div>

      {mensaje && <p className="config-success">{mensaje}</p>}
      {error && <p className="config-error">{error}</p>}

      <button className="config-btn" onClick={handleSubmit} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
};