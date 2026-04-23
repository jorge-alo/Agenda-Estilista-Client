import { useState } from "react";
import { getAuthHeaders } from "../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const CrearLocalModal = ({ onClose, onSuccess }: Props) => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombreLocal: "",
    telefono: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password || !form.nombreLocal) {
      setError("Email, contraseña y nombre del local son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/superadmin/register`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear el local");
        return;
      }
      onSuccess();
      onClose();
    } catch (error) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="sa-modal-title">Nuevo local</h2>

        <div className="sa-form">
          <div className="sa-field">
            <label>Nombre del local</label>
            <input
              name="nombreLocal"
              value={form.nombreLocal}
              onChange={handleChange}
              placeholder="Ej: Estudio Valentina"
            />
          </div>
          <div className="sa-field">
            <label>Email del admin</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@ejemplo.com"
            />
          </div>
          <div className="sa-field">
            <label>Contraseña</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="sa-field">
            <label>Teléfono <span className="sa-opcional">(opcional)</span></label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="+54 11 1234-5678"
            />
          </div>

          {error && <p className="sa-error">{error}</p>}

          <div className="sa-modal-acciones">
            <button className="sa-btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Creando..." : "Crear local"}
            </button>
            <button className="sa-btn" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};