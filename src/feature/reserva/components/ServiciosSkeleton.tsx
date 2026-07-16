import { Skeleton } from "../../../shared/ui/Skeleton";


export const ServiciosSkeleton = () => {
  return (
    <div className="srv-cards">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="srv-card">
          <Skeleton width="80%" height="13px" className="mb-4" />
          <Skeleton width="50%" height="11px" />
        </div>
      ))}
    </div>
  );
};