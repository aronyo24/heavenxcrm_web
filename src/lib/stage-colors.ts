// Badge colours per pipeline stage key (StageBadge, Students status picker).
export const STAGE_COLORS: Record<string, string> = {
  new: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  applied: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  awaiting_sfe: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  sfe_approved: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
  enrolled: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  deferred: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  withdrawn: "bg-red-500/15 text-red-500 border-red-500/30",
}

// Solid dot colour per stage key (status picker, legends).
export const STAGE_DOTS: Record<string, string> = {
  new: "bg-slate-400",
  applied: "bg-purple-500",
  awaiting_sfe: "bg-amber-500",
  sfe_approved: "bg-cyan-500",
  enrolled: "bg-emerald-500",
  deferred: "bg-blue-500",
  withdrawn: "bg-red-500",
}
