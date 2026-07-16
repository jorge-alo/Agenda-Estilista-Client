import { Skeleton } from "../../components/ui/Skeleton";


export const ConfiguracionSkeleton = () => {
  return (
    <div className="config-form">
      {/* Nombre del local */}
      <div className="config-field">
        <Skeleton width="110px" height="11px" />
        <Skeleton width="100%" height="40px" radius="var(--radius-sm)" />
      </div>

      {/* Teléfono */}
      <div className="config-field">
        <Skeleton width="70px" height="11px" />
        <Skeleton width="100%" height="40px" radius="var(--radius-sm)" />
      </div>

      {/* Dirección */}
      <div className="config-field">
        <Skeleton width="90px" height="11px" />
        <Skeleton width="100%" height="40px" radius="var(--radius-sm)" />
      </div>

      {/* Descripción (textarea, rows=3) */}
      <div className="config-field">
        <Skeleton width="100px" height="11px" />
        <Skeleton width="100%" height="72px" radius="var(--radius-sm)" />
      </div>

      {/* Apertura / Cierre */}
      <div className="config-row">
        <div className="config-field">
          <Skeleton width="70px" height="11px" />
          <Skeleton width="100%" height="40px" radius="var(--radius-sm)" />
        </div>
        <div className="config-field">
          <Skeleton width="60px" height="11px" />
          <Skeleton width="100%" height="40px" radius="var(--radius-sm)" />
        </div>
      </div>

      {/* Botón guardar */}
      <Skeleton width="100%" height="44px" radius="var(--radius-sm)" />
    </div>
  );
};