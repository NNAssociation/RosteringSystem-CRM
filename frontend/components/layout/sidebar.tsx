"use client";

import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { mainNavItems, secondaryNavItems } from "@/config/navigation";
import Link from "next/link";
import DirectionsBusOutlinedIcon from "@mui/icons-material/DirectionsBusOutlined";
import { useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PeopleIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/" || href === "/dashboard") return false;
    return pathname.startsWith(`${href}/`);
  };

  const userInitials = user
    ? (`${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() ||
      user.username?.[0] ||
      user.primaryEmailAddress?.emailAddress?.[0] ||
      "U").toUpperCase()
    : "...";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-white">
      <SidebarHeader>
        <Link href="/" className=" flex items-center p-6 gap-3">
          <div className="p-2.5 rounded-lg bg-red-600 w-10 h-10 flex items-center justify-center text-white shadow-lg shadow-red-600/20">
            <DirectionsBusOutlinedIcon sx={{ fontSize: 24 }} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <h1 className="truncate text-base font-semibold tracking-tight text-sidebar-foreground">
              City Transit Co.
            </h1>
            <span className="truncate text-xs text-sidebar-foreground/70">
              Dispatcher Admin
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2 px-4">
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    className={
                      "h-[44px] px-3 gap-3 rounded-lg transition-colors " +
                      (isActive(item.href)
                        ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        : "text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800")
                    }
                  >
                    <Link href={item.href}>
                      <item.icon />
                      {item.name}
                    </Link>
                  </SidebarMenuButton>
                  {item.subItems && (
                    <SidebarMenuSub>
                      {item.subItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.name}>
                          <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                            <Link href={subItem.href}>{subItem.name}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="my-2 px-4">
          <div className="h-px border-t border-border-light w-full" />
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2 px-4  ">
              {secondaryNavItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    className={
                      "h-[44px] px-3 gap-3 rounded-lg transition-colors " +
                      (isActive(item.href)
                        ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        : "text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800")
                    }
                  >
                    <Link href={item.href}>
                      <item.icon />
                      {item.name}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="p-4 border-t border-slate-100 mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-slate-50 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full border border-slate-100 bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                      {user?.imageUrl ? (
                        <Image src={user.imageUrl} alt="Profile" width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden ml-2">
                      <span className="truncate font-bold text-slate-900">
                        {isLoaded ? (user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || "User") : "Loading..."}
                      </span>
                      <span className="truncate text-xs text-slate-400">
                        {isLoaded
                          ? (user?.primaryEmailAddress?.emailAddress ?? "")
                          : ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                  side="right"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem className="rounded-lg">
                    <PeopleIcon className="mr-2 size-4" sx={{ fontSize: 18 }} />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg" disabled>
                    <SettingsIcon
                      className="mr-2 size-4"
                      sx={{ fontSize: 18 }}
                    />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 rounded-lg cursor-pointer"
                    onClick={() => signOut({ redirectUrl: '/' })}
                  >
                    <LogoutIcon
                      className="mr-2 size-4"
                      sx={{ fontSize: 18 }}
                    />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
