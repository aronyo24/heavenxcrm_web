import { cn } from "@/lib/utils"

// Shared page heading for every CRM screen so they all read as one product:
// a small coloured eyebrow, the title, one line of help text, and actions.
export function PageHeader({
  eyebrow, title, description, actions, className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
