export default function Butterfly({
  size = 22,
  color = "#D42A63",
  strokeWidth = 3.5
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className="shrink-0">
      <path
        d="M50 38 C46 30, 36 20, 24 22 C12 24, 10 38, 20 44 C30 50, 44 46, 50 38 Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M50 38 C54 30, 64 20, 76 22 C88 24, 90 38, 80 44 C70 50, 56 46, 50 38 Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M50 40 C47 46, 40 56, 30 60 C22 63, 18 56, 24 50 C30 45, 42 41, 50 40 Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M50 40 C53 46, 60 56, 70 60 C78 63, 82 56, 76 50 C70 45, 58 41, 50 40 Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M50 34 C48 34, 47 60, 50 68 C53 60, 52 34, 50 34 Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
