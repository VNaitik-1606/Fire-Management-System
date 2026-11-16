export default function PageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <div className="border-b border-white/[0.06] bg-[#05080e]/60">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <p className="eyebrow">{eyebrow}</p>
          </div>
          <h1 className="mt-1 truncate text-[20px] font-semibold tracking-tight text-slate-50">{title}</h1>
          {description ? <p className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-slate-500">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta}
          {actions}
        </div>
      </div>
    </div>
  );
}
