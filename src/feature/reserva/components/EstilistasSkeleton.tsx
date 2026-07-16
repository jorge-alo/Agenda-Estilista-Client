import { Skeleton } from "../../../shared/ui/Skeleton";


export const EstilistasSkeleton = () => {
  return (
    <div className="est-cards">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="est-card">
          <Skeleton width="36px" height="36px" radius="50%" className="mx-auto" />
          <div style={{ marginTop: "8px" }}>
            <Skeleton width="70%" height="13px" />
          </div>
        </div>
      ))}
    </div>
  );
};