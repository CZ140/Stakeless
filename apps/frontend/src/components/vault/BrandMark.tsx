// The rotated bevel-cut "V" brand mark — a signature of the Vault design.
interface Props {
  size?: number;
}

export function BrandMark({ size = 30 }: Props) {
  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M4 5 L12 22 L20 5 L15 5 L12 13 L9 5 Z" fill="#021a0e" />
      </svg>
    </div>
  );
}
