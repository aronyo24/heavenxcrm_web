import { useEffect, useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUpRight, LogOut, Menu, Search, ShieldCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { CommandPalette } from "@/components/crm/CommandPalette"
import { Toaster } from "@/components/ui/sonner"
import { useAuth } from "@/lib/auth"
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS, isAdminNavActive, type AdminNavItem } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"

interface SidebarContentProps {
  user: { full_name?: string | null; email?: string | null; is_crm_staff?: boolean } | null
  roleLabel: string
  visibleItems: AdminNavItem[]
  pathname: string
  onNavigate: () => void
  onLogout: () => void
  onSearch: () => void
}

const SidebarContent = ({
  user, roleLabel, visibleItems, pathname, onNavigate, onLogout, onSearch,
}: SidebarContentProps) => (
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-900/30">
        <ShieldCheck className="h-5 w-5 text-[#13204a]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-white">HeavenxCRM</p>
        <p className="text-[11px] leading-tight text-white/45">Admin console</p>
      </div>
    </div>

    <div className="px-3">
      <button
        type="button"
        onClick={onSearch}
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">Quick jump…</span>
        <kbd className="rounded border border-white/15 px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
    </div>

    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
      {ADMIN_NAV_SECTIONS.map((section) => {
        const items = visibleItems.filter((i) => i.section === section)
        if (items.length === 0) return null
        return (
          <div key={section}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{section}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isAdminNavActive(item, pathname)
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
                    {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-amber-400" />}
                    <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-amber-400" : "text-white/45 group-hover:text-white/80")} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>

    <div className="space-y-1 border-t border-white/10 p-3">
      {user?.is_crm_staff && (
        <Link
          to="/crm"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowUpRight className="h-4 w-4" />
          Open CRM workspace
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-xs font-bold text-[#13204a]">
          {(user?.full_name || user?.email || "A")[0].toUpperCase()}
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

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const isFullAdmin = user?.role === "admin"
  const perms = user?.permissions || {}
  const roleLabel = isFullAdmin ? "Master admin" : (user?.role?.replace("_", " ") ?? "Sub-admin")

  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isFullAdmin) return false
    if (item.permissionKey && !isFullAdmin && !perms[item.permissionKey]) return false
    return true
  })
  const current = visibleItems.find((i) => isAdminNavActive(i, location.pathname))

  // Ctrl/Cmd+K opens quick jump from anywhere in the admin console.
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

  const handleLogout = async () => {
    await logout()
    navigate("/admin/login")
  }

  const sidebarProps: SidebarContentProps = {
    user, roleLabel, visibleItems, pathname: location.pathname,
    onNavigate: () => setSidebarOpen(false),
    onLogout: () => void handleLogout(),
    onSearch: () => { setSidebarOpen(false); setSearchOpen(true) },
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        pages={visibleItems}
        searchStudents={!!user?.is_crm_staff}
      />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col overflow-hidden bg-[#13204a] print:hidden lg:flex">
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
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-[#13204a] lg:hidden"
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
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur print:hidden sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-8 w-8 lg:hidden">
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">Admin</span>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <span className="truncate font-semibold">{current?.label ?? "User"}</span>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="ml-auto flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:text-foreground md:w-72"
            >
              <Search className="h-4 w-4" />
              <span className="hidden flex-1 text-left md:inline">
                {user?.is_crm_staff ? "Search students or pages…" : "Jump to a page…"}
              </span>
              <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium md:inline">Ctrl K</kbd>
            </button>
            <ThemeToggle />
          </header>

          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
