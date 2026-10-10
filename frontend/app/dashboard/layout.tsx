import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EmployeeAccessGate } from "@/components/workplace/access";
import { HeaderProvider } from "@/providers/header-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmployeeAccessGate>
      <SidebarProvider>
        <HeaderProvider>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto bg-slate-50/50">{children}</main>
            </div>
          </div>
        </HeaderProvider>
      </SidebarProvider>
    </EmployeeAccessGate>
  );
}
