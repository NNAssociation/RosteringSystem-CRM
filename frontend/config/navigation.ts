import { FEATURES } from "@/config/features";
import type { NavItem } from "@/types";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DirectionsBusOutlinedIcon from "@mui/icons-material/DirectionsBusOutlined";
import PersonIcon from "@mui/icons-material/Person";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WorkHistoryOutlinedIcon from "@mui/icons-material/WorkHistoryOutlined";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";

import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";

export const mainNavItems: NavItem[] = [
  { name: "Dashboard", icon: DashboardOutlinedIcon, href: "/dashboard" },
  {
    name: "Employees",
    icon: PersonIcon,
    href: "/dashboard/employees",
  },
  { name: "Customers", icon: WorkOutlineIcon, href: "/dashboard/customers" },
  {
    name: "Fleet Ops",
    icon: DirectionsBusOutlinedIcon,
    href: "/dashboard/fleet-ops",
  },
  { name: "Bookings", icon: WorkOutlineIcon, href: "/dashboard/bookings" },
  // Dispatch Board — conditionally shown via feature flag
  ...(FEATURES.DISPATCH_BOARD
    ? [
        {
          name: "Dispatch",
          icon: CalendarMonthIcon,
          href: "/dashboard/dispatch",
        } as NavItem,
        {
          name: "Morning Yard",
          icon: DirectionsBusOutlinedIcon,
          href: "/dashboard/yard",
        } as NavItem,
        {
          name: "Driver Timesheets",
          icon: AccessTimeOutlinedIcon,
          href: "/dashboard/timesheets",
        } as NavItem,
      ]
    : []),
  ...(FEATURES.NOTICES
    ? [{ name: "Notice Board", icon: CampaignOutlinedIcon, href: "/dashboard/notices" }]
    : []),
  ...(FEATURES.INCIDENTS
    ? [{ name: "Incidents", icon: ReportProblemOutlinedIcon, href: "/dashboard/incidents" }]
    : []),
  ...(FEATURES.LOST_PROPERTY
    ? [{ name: "Lost Property", icon: WorkHistoryOutlinedIcon, href: "/dashboard/lost-property" }]
    : []),
];

export const secondaryNavItems: NavItem[] = [
  {
    name: "Settings",
    icon: SettingsOutlinedIcon,
    href: "/dashboard/settings",
  },
  // {
  //   name: "Test Reports",
  //   icon: FactCheckOutlinedIcon,
  //   href: "/dashboard/test-reports"
  // },
];
