"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Home, Settings, Shield, UploadCloud, Users } from "lucide-react"
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

const ShieldIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
  </svg>
)

export function AppSidebar() {
  const pathname = usePathname()

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/courses", label: "Courses", icon: BookOpen },
    { href: "/users", label: "Learners", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <ShieldIcon className="size-8 text-primary" />
          <h1 className="text-xl font-semibold font-headline text-primary-foreground">CyberAware</h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 flex flex-col gap-2">
          <div className="p-4 bg-secondary rounded-lg text-center">
            <h3 className="font-bold text-sm font-headline">Upload Courses</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Expand your training library by uploading new SCORM packages.
            </p>
            <Button size="sm" className="w-full">
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="p-2">
          <Link href="#">
            <SidebarMenuButton>
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://picsum.photos/seed/admin/100/100" data-ai-hint="person portrait" alt="Admin" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium">Admin User</span>
                <span className="text-xs text-muted-foreground">admin@cyberaware.com</span>
              </div>
            </SidebarMenuButton>
          </Link>
        </div>
      </SidebarFooter>
    </>
  )
}
