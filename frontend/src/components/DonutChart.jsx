/** Simple CSS donut + legend — no chart library. */

export default function DonutChart({
  title,
  segments,
  emptyLabel = "No data",
  percentagePrecision = 0,
  footer,
  compact = false,
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  let cumulative = 0;
  const stops = segments
    .map((s) => {
      const start = total ? (cumulative / total) * 100 : 0;
      cumulative += s.count;
      const end = total ? (cumulative / total) * 100 : 0;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <section
      className={`portal-card p-4${compact ? " portal-donut-compact" : ""}`}
    >
      <h2 className="portal-section-title">{title}</h2>
      {total === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div
          className={`mt-4 flex flex-wrap items-center ${
            compact ? "gap-4" : "gap-6"
          }`}
        >
          <div
            className={`relative shrink-0 rounded-full ${
              compact ? "h-24 w-24" : "h-36 w-36"
            }`}
            style={{
              background: `conic-gradient(${stops})`,
            }}
            aria-hidden
          >
            <div
              className={`absolute flex flex-col items-center justify-center rounded-full bg-white ${
                compact ? "inset-3" : "inset-4"
              }`}
            >
              <span
                className={`font-semibold text-au-navy ${
                  compact ? "text-base" : "text-2xl"
                }`}
              >
                {total}
              </span>
              <span
                className={`uppercase tracking-wide text-slate-400 ${
                  compact ? "text-[8px]" : "text-[10px]"
                }`}
              >
                {compact ? "Total" : "total"}
              </span>
            </div>
          </div>
          <ul
            className={`min-w-[10rem] flex-1 ${
              compact ? "space-y-2 text-[0.625rem]" : "space-y-2 text-sm"
            }`}
          >
            {segments.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-slate-700">
                  <span
                    className={`rounded-full ${
                      compact ? "h-2 w-2" : "h-2.5 w-2.5"
                    }`}
                    style={{ background: s.color }}
                  />
                  {s.label.replaceAll("_", " ")}
                </span>
                <span className="font-medium text-au-navy">
                  {s.count}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    ({((s.count / total) * 100).toFixed(percentagePrecision)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {footer ? (
        <div className="mt-4 border-t border-slate-100 pt-3 text-center text-sm">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
