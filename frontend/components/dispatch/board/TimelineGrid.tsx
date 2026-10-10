"use client";
export function TimelineGrid({
  scale,
  showDotted = false,
}: {
  scale: number;
  showDotted?: boolean;
}) {
  const hourWidth = 60 * scale;
  const show15m = showDotted || hourWidth >= 65;
  const show30m = showDotted || hourWidth >= 34;
  const patternId = `grid-pattern-${Math.round(scale * 100)}-${showDotted ? "dotted" : "adaptive"}`;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={patternId} width={hourWidth} height="100%" patternUnits="userSpaceOnUse">
            {/* 15m and 45m lines: delicate dotted lines, unmistakably different from solid hour lines */}
            {show15m && (
              <>
                <line
                  x1={15 * scale}
                  y1="0"
                  x2={15 * scale}
                  y2="100%"
                  stroke="#94a3b8"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                <line
                  x1={45 * scale}
                  y1="0"
                  x2={45 * scale}
                  y2="100%"
                  stroke="#94a3b8"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
              </>
            )}

            {/* 30m half-hour line: medium dashed line */}
            {show30m && (
              <line
                x1={30 * scale}
                y1="0"
                x2={30 * scale}
                y2="100%"
                stroke="#64748b"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            )}

            {/* 60m top-of-hour separator: crisp, solid rule */}
            <line
              x1={hourWidth}
              y1="0"
              x2={hourWidth}
              y2="100%"
              stroke="#64748b"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
