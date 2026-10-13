import { useEffect, useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, GraduationCap, LogOut, Menu, Search, Settings, ShieldCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { CommandPalette } from "@/components/crm/CommandPalette"
import { useAuth } from "@/lib/auth"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  announceLeadsChanged, fetchCrmDashboard, fetchLeadSummary, LEADS_CHANGED_EVENT, syncFacebookLeads, TASKS_CHANGED_EVENT,
} from "@/lib/crm-api"
import { isNavActive, NAV_ITEMS, NAV_SECTIONS, type NavItem } from "@/lib/crm-nav"
import { cn } from "@/lib/utils"

type Badges = Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>

interface SidebarContentProps {
  user: { full_name?: string | null; email?: string | null; role?: string | null; is_admin?: boolean; is_crm_manager?: boolean } | null
  roleLabel: string
  visibleItems: NavItem[]
  pathname: string
  onNavigate: () => void
  onLogout: () => void
  onSearch: () => void
  badges: Badges
  overdue: number
}

const SidebarContent = ({
  user, roleLabel, visibleItems, pathname, onNavigate, onLogout, onSearch, badges, overdue,
}: SidebarContentProps) => (
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-900/40">
        <GraduationCap className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-white">HeavenxCRM</p>
        <p className="text-[11px] leading-tight text-white/45">Counselor workspace</p>
      </div>
    </div>

    <div className="px-3">
      <button
        type="button"
        onClick={onSearch}
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">Find a student…</span>
        <kbd className="rounded border border-white/15 px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
    </div>

    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
      {NAV_SECTIONS.map((section) => {
        const items = visibleItems.filter((i) => i.section === section)
        if (items.length === 0) return null
        return (
          <div key={section}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{section}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isNavActive(item, pathname)
                const count = item.badgeKey ? badges[item.badgeKey] : undefined
                const urgent = item.badgeKey === "tasks" && overdue > 0
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-emerald-400" />}
                    <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-emerald-400" : "text-white/45 group-hover:text-white/80")} />
                    <span className="flex-1">{item.label}</span>
                    {count ? (
                      <span
                        className={cn(
                          "min-w-5 rounded-full px-1.5 py-px text-center text-[10px] font-bold tabular-nums",
                          urgent ? "bg-red-500 text-white" : "bg-amber-400 text-[#0f2318]",
                        )}
                        title={urgent ? `${overdue} overdue` : undefined}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>

    <div className="space-y-1 border-t border-white/10 p-3">
      {/* Only admins can actually open /admin (see RequireAdmin). */}
      {user?.is_admin && (
        <Link
          to="/admin"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ShieldCheck className="h-4 w-4" />
          Admin dashboard
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-[#0f2318]">
          {(user?.full_name || user?.email || "C")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{user?.full_name || user?.email}</p>
          <p className="truncate text-[11px] capitalize text-white/45">{roleLabel}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className="rounded-md p-1.5 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
)

export function CrmLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const isFullAdmin = user?.role === "admin"
  const isManager = !!user?.is_crm_manager
  const perms = user?.permissions || {}
  const roleLabel = isFullAdmin ? "Master admin" : user?.role === "sub_admin" ? "Manager" : (user?.role?.replace("_", " ") ?? "Counselor")

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.managerOnly && !isManager) return false
    if (item.permissionKey && !isManager && !perms[item.permissionKey]) return false
    return true
  })
  const current = visibleItems.find((i) => isNavActive(i, location.pathname))

  // Ctrl/Cmd+K opens quick search from anywhere in the CRM.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Unassigned-lead counter on the Leads nav item, kept fresh in the
  // background and bumped immediately when the Leads page changes something.
  const [leadCount, setLeadCount] = useState<number>()
  useEffect(() => {
    if (!isManager) return
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      fetchLeadSummary().then((s) => setLeadCount(s.total)).catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener(LEADS_CHANGED_EVENT, refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(LEADS_CHANGED_EVENT, refresh)
    }
  }, [isManager])

  // Open-task counter (due today + overdue) for the Tasks item and the bell.
  const [taskCounts, setTaskCounts] = useState({ today: 0, overdue: 0 })
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      fetchCrmDashboard()
        .then((d) => setTaskCounts({ today: d.tasks_due_today, overdue: d.tasks_overdue }))
        .catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener(TASKS_CHANGED_EVENT, refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(TASKS_CHANGED_EVENT, refresh)
    }
  }, [])
  const taskBadge = taskCounts.today + taskCounts.overdue

  // Backstop for the Meta webhook: pull in any Facebook form leads it missed.
  // Throttled server-side (sync_if_due), so polling every couple of minutes
  // from every open tab is cheap.
  useEffect(() => {
    if (!isManager) return
    const sync = () => {
      if (document.visibilityState !== "visible") return
      syncFacebookLeads()
        .then(({ created }) => {
          if (created > 0) {
            toast.success(`${created} new Facebook lead${created > 1 ? "s" : ""} arrived`, {
              action: { label: "View", onClick: () => navigate("/crm/leads") },
            })
            announceLeadsChanged()
          }
        })
        .catch(() => {})
    }
    sync()
    const timer = window.setInterval(sync, 120_000)
    return () => window.clearInterval(timer)
  }, [isManager, navigate])
  const badges: Badges = { leads: leadCount, tasks: taskBadge }

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const sidebarProps: SidebarContentProps = {
    user, roleLabel, visibleItems, pathname: location.pathname, badges, overdue: taskCounts.overdue,
    onNavigate: () => setSidebarOpen(false),
    onLogout: () => void handleLogout(),
    onSearch: () => { setSidebarOpen(false); setSearchOpen(true) },
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} pages={visibleItems} />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col overflow-hidden bg-[#0f2318] lg:flex">
          <SidebarContent {...sidebarProps} />
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-[#0f2318] lg:hidden"
              >
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="absolute right-3 top-5 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <SidebarContent {...sidebarProps} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-8 w-8 lg:hidden">
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">CRM</span>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <span className="truncate font-semibold">{current?.label ?? "Student"}</span>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="ml-auto flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:text-foreground md:w-72"
            >
              <Search className="h-4 w-4" />
              <span className="hidden flex-1 text-left md:inline">Search students…</span>
              <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium md:inline">Ctrl K</kbd>
            </button>

            <Link
              to="/crm/tasks"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted"
              title={taskBadge ? `${taskCounts.overdue} overdue · ${taskCounts.today} due today` : "No tasks due"}
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {taskBadge > 0 && (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white",
                    taskCounts.overdue ? "bg-red-500" : "bg-amber-500",
                  )}
                >
                  {taskBadge > 99 ? "99+" : taskBadge}
                </span>
              )}
            </Link>
            <Link
              to="/crm/settings"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted sm:flex"
              title="Settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Link>
            <ThemeToggle />
          </header>

          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
