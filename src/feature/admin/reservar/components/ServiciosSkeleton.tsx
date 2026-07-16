import { Skeleton } from "../../../../shared/ui/Skeleton";


export const ServiciosSkeleton = () => {
  return (
    <div className="srv-cards">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="srv-card">
          <Skeleton width="70%" height="14px" />
          <div style={{ marginTop: "6px" }}>
            <Skeleton width="50%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
};