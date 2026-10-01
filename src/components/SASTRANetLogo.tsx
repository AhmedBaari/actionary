import type { CSSProperties } from "react";

interface SASTRANetLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export function SASTRANetLogo({
  className = "",
  size = 48,
  color,
}: SASTRANetLogoProps) {
  const fontSize = typeof size === "number" ? `${size}px` : size;
  const style: CSSProperties = {
    fontSize,
    color,
  };

  return (
    <span
      aria-label="SASTRANet"
      className={`sastranet-wordmark ${className}`.trim()}
      style={style}
      role="img"
    >
      sastranet
    </span>
  );
}

export default SASTRANetLogo;
