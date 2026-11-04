export const NATURAL_WIDTH = 176;
export const NATURAL_HEIGHT = 70;

export const EMDASH_PATHS = [
  'M0 0H14V28H36V0H50V70H36V40H14V70H0Z',
  'M62 0H76V48Q76 57 87 57Q98 57 98 48V0H112V48Q112 70 87 70Q62 70 62 48Z',
  'M124 0H154Q172 0 172 17Q172 28 162 33Q176 38 176 52Q176 70 156 70H124ZM138 12V29H152Q158 29 158 20.5Q158 12 152 12ZM138 41V58H154Q162 58 162 49.5Q162 41 154 41Z',
];

export function EmdashLogo({
  className,
  height = NATURAL_HEIGHT,
  color = 'currentColor',
}: {
  className?: string;
  height?: number;
  color?: string;
}) {
  const width = (height / NATURAL_HEIGHT) * NATURAL_WIDTH;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 176 70"
      fill={color}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {EMDASH_PATHS.map((d) => (
        <path key={d.slice(0, 8)} d={d} />
      ))}
    </svg>
  );
}
