
import { ConfiguracionForm } from "../components/ConfiguracionForm";
import { ConfiguracionSkeleton } from "../components/ConfiguracionSkeleton";
import {
  useConfiguracion
} from "../hooks/useConfiguracion";

export const ConfiguracionPage =
() => {

  const {
    data: config,
    isLoading,
    isError,
  } = useConfiguracion();

  if (isLoading) {
     return <ConfiguracionSkeleton />;
  }

  if (isError || !config) {
    return (
        <p className="config-error">Error cargando configuración</p>
    );
  }

  return (

    <ConfiguracionForm
      inicial={config}
    />

  );
};