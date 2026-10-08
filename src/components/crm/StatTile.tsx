import { cn } from "@/lib/utils"

export type StatTone = "emerald" | "sky" | "amber" | "red" | "violet" | "slate"

const TONES: Record<StatTone, { bar: string; icon: string; ring: string }> = {
  emerald: { bar: "bg-emerald-500", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/60" },
  sky: { bar: "bg-sky-500", icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400", ring: "ring-sky-500/60" },
  amber: { bar: "bg-amber-500", icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "ring-amber-500/60" },
  red: { bar: "bg-red-500", icon: "bg-red-500/10 text-red-600 dark:text-red-400", ring: "ring-red-500/60" },
  violet: { bar: "bg-violet-500", icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", ring: "ring-violet-500/60" },
  slate: { bar: "bg-slate-400", icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300", ring: "ring-slate-400/60" },
}

// KPI tile with a coloured edge. Pass onClick to make it act as a filter.
export function StatTile({
  label, value, hint, icon: Icon, tone = "emerald", active, onClick,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: React.ElementType
  tone?: StatTone
  active?: boolean
  onClick?: () => void
}) {
  const t = TONES[tone]
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm transition-all",
        onClick && "hover:-translate-y-0.5 hover:shadow-md",
        active && cn("ring-2", t.ring),
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", t.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none tabular-nums">{value}</p>
          {hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", t.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Comp>
  )
}
