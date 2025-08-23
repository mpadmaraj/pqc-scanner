import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import ScanRepository from "@/pages/scan-repository";
import ScanHistory from "@/pages/scan-history";
import Reports from "@/pages/reports";
import Integrations from "@/pages/integrations";
import DeveloperPortal from "@/pages/developer-portal";
import CbomManager from "@/pages/cbom-manager";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/scan-repository" component={ScanRepository} />
        <Route path="/scan-history" component={ScanHistory} />
        <Route path="/reports" component={Reports} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/developer-portal" component={DeveloperPortal} />
        <Route path="/cbom-manager" component={CbomManager} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
