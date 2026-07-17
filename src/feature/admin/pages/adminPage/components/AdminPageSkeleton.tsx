import { Skeleton } from "../../../../../shared/ui/Skeleton";


export const AdminPageSkeleton = () => {
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
        <Skeleton width="140px" height="24px" />
        <Skeleton width="80px" height="32px" radius="var(--radius-sm)" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", padding: "0 24px 16px" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="80px" height="32px" radius="var(--radius-sm)" />
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: "0 24px" }}>
        <Skeleton width="100%" height="200px" radius="var(--radius-lg)" />
      </div>
    </div>
  );
};