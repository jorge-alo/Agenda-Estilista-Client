import { Skeleton } from "../../components/ui/Skeleton";


export const EstilistasSkeleton = () => {
  return (
    <ul className="est-admin-lista">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="est-admin-item">
          <Skeleton width="32px" height="32px" radius="50%" />
          <Skeleton width="140px" height="14px" />
        </li>
      ))}
    </ul>
  );
};