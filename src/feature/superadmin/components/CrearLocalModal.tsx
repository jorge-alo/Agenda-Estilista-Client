import { useState } from "react";
import { useCrearLocal } from "../mutations/useCrearLocal";
import { crearLocalSchema, type CrearLocalInput } from "../schema/superadmin.schema";


interface Props {
  onClose: () => void;
}

export const CrearLocalModal = ({ onClose }: Props) => {
  const [form, setForm] = useState<CrearLocalInput>({
    email: "",
    password: "",
    nombreLocal: "",
    telefono: "",
  });
  const [error, setError] = useState("");
  
  const crearMutation = useCrearLocal();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(""); // Limpiar error al escribir
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");

    // ✅ Validación con Zod
    const validationResult = crearLocalSchema.safeParse(form);
    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      return;
    }

    // ✅ Delegar a la mutación
    await crearMutation.mutateAsync(validationResult.data, {
      onSuccess: () => {
        onClose(); // Cierra el modal al tener éxito
      },
    });
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="sa-modal-title">Nuevo local</h2>

        <form onSubmit={handleSubmit} className="sa-form">
          <div className="sa-field">
            <label>Nombre del local</label>
            <input
              name="nombreLocal"
              value={form.nombreLocal}
              onChange={handleChange}
              placeholder="Ej: Estudio Valentina"
              disabled={crearMutation.isPending}
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
              disabled={crearMutation.isPending}
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
              disabled={crearMutation.isPending}
            />
          </div>
          <div className="sa-field">
            <label>Teléfono <span className="sa-opcional">(opcional)</span></label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="+54 11 1234-5678"
              disabled={crearMutation.isPending}
            />
          </div>

          {error && <p className="sa-error">{error}</p>}

          <div className="sa-modal-acciones">
            <button 
              className="sa-btn-primary" 
              type="submit" 
              disabled={crearMutation.isPending}
            >
              {crearMutation.isPending ? "Creando..." : "Crear local"}
            </button>
            <button 
              className="sa-btn" 
              type="button" 
              onClick={onClose}
              disabled={crearMutation.isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};