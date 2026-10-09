/**
 * Shared content panel with optional header actions.
 */
export default function SectionPanel({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section className={`portal-card overflow-hidden ${className}`.trim()}>
      {(title || actions) && (
        <div className="portal-panel-header">
          <div className="min-w-0">
            {title ? <h2 className="portal-section-title">{title}</h2> : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      )}
      <div className={bodyClassName || "portal-panel-body"}>{children}</div>
    </section>
  );
}
