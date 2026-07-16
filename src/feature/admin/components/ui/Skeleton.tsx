// components/ui/Skeleton.tsx
interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}

export const Skeleton = ({
  width = "100%",
  height = "16px",
  radius = "var(--radius-sm)",
  className = "",
}: SkeletonProps) => (
  <div
    className={`skeleton-shimmer ${className}`}
    style={{ width, height, borderRadius: radius }}
  />
);