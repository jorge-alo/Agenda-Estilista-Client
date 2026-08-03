import { useState } from "react";
import { useUpdateConfiguracion } from "../mutations/useUpdateConfiguracion";
import { useEstadoMP } from "../hooks/useEstadoMP";
import { useConfigurarMP } from "../mutations/useConfigurarMP";
import "../styles/ConfiguracionForm.css";

interface Props {
  inicial: {
    nombre: string;
    telefono: string;
    direccion: string;
    descripcion: string;
    horario_apertura: string;
    horario_cierre: string;
     requiere_sena?: boolean; 
  };
}

export const ConfiguracionForm = ({ inicial }: Props) => {
    const [form, setForm] = useState({
    ...inicial,
    requiere_sena: inicial.requiere_sena ?? true,
  });
  const [mpToken, setMpToken] = useState("");
  
  const updateMutation = useUpdateConfiguracion();
  const mpMutation = useConfigurarMP();
  const { data: estadoMP, isLoading: loadingMP } = useEstadoMP();

    const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setForm({ 
      ...form, 
      [name]: type === "checkbox" ? checked : value 
    });
  };

  const handleSubmit = async () => {
    await updateMutation.mutateAsync(form);
  };

  const handleConfigurarMP = async () => {
    if (!mpToken.trim()) return;
    await mpMutation.mutateAsync(mpToken.trim());
    setMpToken(""); // Limpiar el input después de guardar
  };

  return (
    <div className="config-form">
      {/* SECCIÓN: Datos del local */}
      <h3 className="config-section-title">Datos del local</h3>

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
        <textarea
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className="config-row">
        <div className="config-field">
          <label>Apertura</label>
          <input
            type="time"
            name="horario_apertura"
            value={form.horario_apertura}
            onChange={handleChange}
          />
        </div>

        <div className="config-field">
          <label>Cierre</label>
          <input
            type="time"
            name="horario_cierre"
            value={form.horario_cierre}
            onChange={handleChange}
          />
        </div>
      </div>

      <button
        className="config-btn"
        onClick={handleSubmit}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
      </button>

      {/* ✅ NUEVA SECCIÓN: Mercado Pago */}
      <div className="config-mp-section">
        <h3 className="config-section-title">Pagos Online - Mercado Pago</h3>
        <p className="config-mp-desc">
          Configurá tu cuenta de Mercado Pago para que los pagos de los turnos lleguen directamente a tu cuenta.
        </p>

        {loadingMP ? (
          <p className="config-loading">Cargando estado...</p>
        ) : (
          <>
            {/* Estado actual */}
            {estadoMP?.configurado ? (
              <div className="config-mp-status success">
                <span className="config-mp-icon">✅</span>
                <div>
                  <strong>Mercado Pago configurado</strong>
                  <p className="config-mp-token">
                    Token actual: <code>{estadoMP.token_preview}</code>
                  </p>
                </div>
              </div>
            ) : (
              <div className="config-mp-status warning">
                <span className="config-mp-icon">⚠️</span>
                <div>
                  <strong>Mercado Pago no configurado</strong>
                  <p className="config-mp-text">
                    Los clientes no pueden pagar online hasta que configures tu token.
                  </p>
                </div>
              </div>
            )}

            {/* Formulario para configurar/cambiar token */}
            <div className="config-mp-form">
              <label>Access Token de Mercado Pago</label>
              <input
                type="text"
                value={mpToken}
                onChange={(e) => setMpToken(e.target.value)}
                placeholder="APP_USR-..."
                disabled={mpMutation.isPending}
                className="config-mp-input"
              />

              <button
                className="config-btn"
                onClick={handleConfigurarMP}
                disabled={mpMutation.isPending || !mpToken.trim()}
              >
                {mpMutation.isPending ? "Validando..." : "Guardar token"}
              </button>
            </div>

            {/* Tutorial */}
            <details className="config-mp-tutorial">
              <summary>📖 ¿Cómo obtener tu Access Token?</summary>
              <ol>
                <li>
                  Ingresá a{" "}
                  <a
                    href="https://www.mercadopago.com.ar/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    mercadopago.com.ar/developers
                  </a>{" "}
                  con tu cuenta de Mercado Pago.
                </li>
                <li>
                  Hacé clic en <strong>"Tus integraciones"</strong> →{" "}
                  <strong>"Crear aplicación"</strong>.
                </li>
                <li>
                  Elegí <strong>"Pagos online"</strong> y completá los datos de tu negocio.
                </li>
                <li>
                  En el panel de tu aplicación, copiá el{" "}
                  <strong>Access Token de PRODUCCIÓN</strong> (empieza con{" "}
                  <code>APP_USR-</code>).
                </li>
                <li>
                  Pegalo en el campo de arriba y hacé clic en{" "}
                  <strong>"Guardar token"</strong>.
                </li>
              </ol>
              <div className="config-mp-notice">
                💡 <strong>Importante:</strong> Los pagos llegarán directamente a tu cuenta de Mercado Pago. Tu plataforma no retiene ningún dinero.
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
};