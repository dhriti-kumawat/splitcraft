/** Small area chart of daily values (e.g. visitors), as on the project cards. Decorative. */
export function Sparkline({
  values,
  color,
  fill,
}: {
  values: number[];
  color: string;
  fill: string;
}) {
  if (values.length < 2) return null;
  const width = 300;
  const height = 40;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  // Keep a 4 px margin so the line never touches the edges.
  const y = (v: number) => (height - 4 - (v / max) * (height - 8)).toFixed(1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon fill={fill} points={`0,${height} ${points} ${width},${height}`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  );
}
