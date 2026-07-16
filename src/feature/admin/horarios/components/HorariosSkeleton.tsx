import { Skeleton } from "../../../../shared/ui/Skeleton";


export const HorariosSkeleton = () => {
  return (
    <ul className="hor-admin-lista">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="hor-admin-item">
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Skeleton width="70px" height="14px" />
            <Skeleton width="100px" height="12px" />
          </div>
          <Skeleton width="70px" height="26px" radius="var(--radius-sm)" />
        </li>
      ))}
    </ul>
  );
};