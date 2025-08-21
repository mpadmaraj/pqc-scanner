import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Shield, 
  Menu, 
  Bell, 
  Settings, 
  BarChart3, 
  Search, 
  History, 
  FileText, 
  Plug, 
  Database
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Scan Repository", href: "/scan-repository", icon: Search },
    { name: "Scan History", href: "/scan-history", icon: History },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Integrations", href: "/integrations", icon: Plug },
    { name: "CBOM Manager", href: "/cbom-manager", icon: Database },
  ];



  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-surface shadow-sm">
        <div className="flex h-16 items-center px-6">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <nav className="flex flex-col space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button
                      variant={location === item.href ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      data-testid={`link-${item.name.toLowerCase().replace(" ", "-")}`}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="PQC Scanner" className="h-8 w-8" />
              <h1 className="text-2xl font-medium text-foreground">PQC Scanner</h1>
              <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                BETA
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-medium">D</span>
              </div>
              <span className="text-sm font-medium hidden sm:inline" data-testid="text-username">Developer</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-surface border-r shadow-sm">
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  data-testid={`link-${item.name.toLowerCase().replace(" ", "-")}`}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            ))}


          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
