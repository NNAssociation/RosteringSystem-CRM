import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DirectionsBusOutlinedIcon from "@mui/icons-material/DirectionsBusOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PersonIcon from "@mui/icons-material/Person";
import DriveEtaIcon from "@mui/icons-material/DriveEta";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import type { NavItem } from "@/types";
import { FEATURES } from "@/config/features";

export const mainNavItems: NavItem[] = [
  { name: "Dashboard", icon: DashboardOutlinedIcon, href: "/dashboard" },
  {
    name: "Drivers",
    icon: DriveEtaIcon,
    href: "/dashboard/drivers",
  },
  { name: "Customers", icon: PersonIcon, href: "/dashboard/customers" },
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
    ]
    : []),
];

export const secondaryNavItems: NavItem[] = [
  {
    name: "Settings",
    icon: SettingsOutlinedIcon,
    href: "/dashboard/settings"
  },
  // {
  //   name: "Test Reports",
  //   icon: FactCheckOutlinedIcon,
  //   href: "/dashboard/test-reports"
  // },
];
