import { Skeleton } from "../../../../shared/ui/Skeleton";


export const AgendaSkeleton = () => {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="agenda-turno">
          <div style={{ marginBottom: "10px" }}>
            <Skeleton width="70px" height="18px" />
          </div>
          <div style={{ marginBottom: "4px" }}>
            <Skeleton width="60%" height="13px" />
          </div>
          <div style={{ marginBottom: "4px" }}>
            <Skeleton width="45%" height="13px" />
          </div>
          <div style={{ marginBottom: "4px" }}>
            <Skeleton width="50%" height="13px" />
          </div>
          <div style={{ marginBottom: "4px" }}>
            <Skeleton width="40%" height="13px" />
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <Skeleton height="32px" radius="var(--radius-sm)" />
            <Skeleton height="32px" radius="var(--radius-sm)" />
            <Skeleton height="32px" radius="var(--radius-sm)" />
          </div>
        </div>
      ))}
    </div>
  );
};