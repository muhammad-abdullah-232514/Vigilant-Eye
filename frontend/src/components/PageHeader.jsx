/**
 * Consistent page header: breadcrumb, title, optional actions.
 */
export default function PageHeader({
  breadcrumb = "Home",
  title,
  actions,
  children,
}) {
  return (
    <header className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {breadcrumb ? (
          <p className="text-xs font-medium text-slate-500">{breadcrumb}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-au-navy sm:text-3xl">
          {title}
        </h1>
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
