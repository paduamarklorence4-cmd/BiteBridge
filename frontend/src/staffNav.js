import {
  LayoutDashboard, Users, FileText, ClipboardList, Stethoscope, Syringe, Eye,
  Calendar, Package, Receipt, BarChart3, MessageSquare, UserCog, Settings,
} from 'lucide-react'

// `perm` is the permission code the backend assigns to the role (see database/bitebridge_recovery_seed.sql).
// The sidebar only hides links; the backend must still check permissions on every API call.
export const STAFF_NAV = [
  { to: '/dashboard',    label: 'Dashboard',          icon: LayoutDashboard, perm: 'dashboard.view' },
  { to: '/patients',     label: 'Patients',           icon: Users,           perm: 'patients.view' },
  { to: '/incidents',    label: 'Bite Incidents',     icon: FileText,        perm: 'incidents.view' },
  { to: '/assessments',  label: 'Assessments',        icon: ClipboardList,   perm: 'assessments.view' },
  { to: '/treatments',   label: 'Treatment',          icon: Stethoscope,     perm: 'treatments.view' },
  { to: '/vaccinations', label: 'Vaccination',        icon: Syringe,         perm: 'vaccinations.view' },
  { to: '/monitoring',   label: 'Animal Monitoring',  icon: Eye,             perm: 'monitoring.view' },
  { to: '/appointments', label: 'Appointments',       icon: Calendar,        perm: 'appointments.view' },
  { to: '/inventory',    label: 'Inventory',          icon: Package,         perm: 'inventory.view' },
  { to: '/billing',      label: 'Billing',            icon: Receipt,         perm: 'billing.view' },
  { to: '/reports',      label: 'Reports',            icon: BarChart3,       perm: 'reports.view' },
  { to: '/chatbot-reviews', label: 'Chatbot Reviews', icon: MessageSquare,   perm: 'chatbot.review' },
  { to: '/users',        label: 'User Accounts',      icon: UserCog,         perm: 'users.manage' },
  { to: '/settings',     label: 'Settings',           icon: Settings,        perm: 'settings.manage' },
]