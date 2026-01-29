"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { Header } from "@/components/app/header"
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <Header />
        <main className="p-4 lg:p-6 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
