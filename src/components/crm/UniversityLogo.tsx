import { useState } from "react"
import { Building2 } from "lucide-react"

import { cn, safeHref } from "@/lib/utils"

// University logo with a neutral building-icon fallback (many universities
// have no logo_url, and remote logos sometimes fail to load).
export function UniversityLogo({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const href = src ? safeHref(src) : null
  return (
    <span
      className={cn(
        "flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white text-slate-400 dark:bg-white/5",
        className,
      )}
    >
      {href && !failed ? (
        <img src={href} alt={`${name} logo`} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        <Building2 className="h-4 w-4" />
      )}
    </span>
  )
}
