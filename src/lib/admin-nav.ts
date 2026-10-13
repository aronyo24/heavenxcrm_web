import { Activity, Bot, Facebook, FileText, Globe, LayoutDashboard, Shield, Users } from "lucide-react"
import type { AdminPermissions } from "@/lib/types"

export interface AdminNavItem {
  to: string
  label: string
  icon: React.ElementType
  description: string
  section: "Overview" | "Analytics" | "People" | "Integrations"
  exact?: boolean
  permissionKey?: keyof AdminPermissions
  adminOnly?: boolean
}

// Single source for the admin sidebar, the top bar title and the quick-jump palette.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, section: "Overview", description: "Business performance at a glance" },
  { to: "/admin/activity", label: "Live activity", icon: Activity, section: "Overview", description: "What visitors are doing right now" },
  { to: "/admin/visitors", label: "Visitors", icon: Globe, section: "Analytics", permissionKey: "view_analytics", description: "Website traffic, countries and devices" },
  { to: "/admin/submissions", label: "Reports", icon: FileText, section: "Analytics", permissionKey: "view_all_records", description: "Advisor form submissions and exports" },
  { to: "/admin/chatbot", label: "Chatbot", icon: Bot, section: "Analytics", permissionKey: "view_all_records", description: "AI advisor conversations and topics" },
  { to: "/admin/users", label: "Users", icon: Users, section: "People", permissionKey: "view_all_records", description: "Registered accounts on the public site" },
  { to: "/admin/managers", label: "Managers", icon: Shield, section: "People", adminOnly: true, description: "Managers with full CRM access" },
  { to: "/admin/integrations/facebook", label: "Facebook leads", icon: Facebook, section: "Integrations", adminOnly: true, description: "Lead Ads connection and sync" },
]

export const ADMIN_NAV_SECTIONS: AdminNavItem["section"][] = ["Overview", "Analytics", "People", "Integrations"]

export function isAdminNavActive(item: AdminNavItem, pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return item.exact ? path === item.to : path.startsWith(item.to)
}
