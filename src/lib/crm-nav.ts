import {
  GraduationCap, Inbox, KanbanSquare, LayoutDashboard, ListChecks, MessagesSquare, UserCircle, UserCog, Users, FileText,
} from "lucide-react"
import type { AdminPermissions } from "@/lib/types"

export interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  description: string
  section: "Workspace" | "Students" | "Resources" | "Account"
  exact?: boolean
  permissionKey?: keyof AdminPermissions
  adminOnly?: boolean
  badgeKey?: "leads" | "tasks"
}

// Single source for the sidebar, the top bar title and the quick-search palette.
export const NAV_ITEMS: NavItem[] = [
  { to: "/crm", label: "Dashboard", icon: LayoutDashboard, exact: true, section: "Workspace", description: "Your day at a glance" },
  { to: "/crm/tasks", label: "Tasks", icon: ListChecks, section: "Workspace", badgeKey: "tasks", description: "Follow-ups, calls and reminders" },
  { to: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare, section: "Workspace", permissionKey: "crm_view_own_students", description: "Change student status across the admission journey" },
  { to: "/crm/leads", label: "Leads", icon: Inbox, section: "Students", adminOnly: true, badgeKey: "leads", description: "New enquiries waiting for a counselor" },
  { to: "/crm/students", label: "Students", icon: Users, section: "Students", permissionKey: "crm_view_own_students", description: "Every student with a counselor" },
  { to: "/crm/applications", label: "Applications", icon: FileText, section: "Students", permissionKey: "crm_view_own_students", description: "Course applications and offers" },
  { to: "/crm/communications", label: "Communications", icon: MessagesSquare, section: "Students", permissionKey: "crm_view_own_students", description: "Emails, calls and replies" },
  { to: "/crm/universities", label: "Universities", icon: GraduationCap, section: "Resources", description: "Search the programme catalogue" },
  { to: "/crm/counselors", label: "Counselors", icon: UserCog, section: "Resources", adminOnly: true, description: "Team accounts and caseloads" },
  { to: "/crm/settings", label: "Settings", icon: UserCircle, section: "Account", description: "Your profile and password" },
]

export const NAV_SECTIONS: NavItem["section"][] = ["Workspace", "Students", "Resources", "Account"]

export function isNavActive(item: NavItem, pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return item.exact ? path === item.to : path.startsWith(item.to)
}
