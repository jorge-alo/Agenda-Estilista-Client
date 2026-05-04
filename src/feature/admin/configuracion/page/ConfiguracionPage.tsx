import { useEffect, useState } from "react";
import { getConfiguracion } from "../services/configuracion.service";
import { ConfiguracionForm } from "../components/ConfiguracionForm";

export const ConfiguracionPage = () => {
  const [config, setConfig] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfiguracion()
      .then(setConfig)
      .catch(() => setError("No se pudo cargar la configuración"))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-hint)" }}>Cargando...</p>;
  if (error) return <p style={{ color: "#e53935", fontSize: 13 }}>{error}</p>;
  if (!config) return null;

  return (
    <div>
      <ConfiguracionForm
        inicial={{
          nombre: config.nombre ?? "",
          telefono: config.telefono ?? "",
          direccion: config.direccion ?? "",
          descripcion: config.descripcion ?? "",
          horario_apertura: config.horario_apertura ?? "",
          horario_cierre: config.horario_cierre ?? "",
        }}
        onActualizado={setConfig}
      />
    </div>
  );
};