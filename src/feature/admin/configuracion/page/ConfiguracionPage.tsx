
import { ConfiguracionForm } from "../components/ConfiguracionForm";
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
    return <p>Cargando...</p>;
  }

  if (isError || !config) {
    return (
      <p>
        Error cargando configuración
      </p>
    );
  }

  return (

    <ConfiguracionForm
      inicial={config}
    />

  );
};