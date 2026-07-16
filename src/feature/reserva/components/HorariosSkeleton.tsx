import { Skeleton } from "../../../shared/ui/Skeleton";


export const HorariosSkeleton = () => {
  return (
    <div className="hor-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} height="38px" radius="var(--radius-sm)" />
      ))}
    </div>
  );
};