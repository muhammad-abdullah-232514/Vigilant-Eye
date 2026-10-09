export default function UfmFormSection({
  letter,
  title,
  children,
  className = "",
}) {
  return (
    <section
      className={`ufm-form-section border-b border-slate-300 px-4 py-5 sm:px-6 ${className}`}
      aria-labelledby={`ufm-section-${letter}`}
    >
      <h2
        id={`ufm-section-${letter}`}
        className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-au-navy"
      >
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-au-navy text-[11px] font-bold normal-case text-white">
          {letter}
        </span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}
