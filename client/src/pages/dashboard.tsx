import { useQuery } from "@tanstack/react-query";
import StatsCards from "@/components/stats-cards";
import ScanProgress from "@/components/scan-progress";
import VulnerabilityTable from "@/components/vulnerability-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activeScans } = useQuery({
    queryKey: ["/api/scans"],
    refetchInterval: 5000, // Poll every 5 seconds for active scans
  });

  const { data: recentVulnerabilities } = useQuery({
    queryKey: ["/api/vulnerabilities"],
    // params: { limit: 10, status: "new" }
  });

  const { data: integrations } = useQuery({
    queryKey: ["/api/integrations"],
  });

  const activeScansList = activeScans?.filter((scan: any) => 
    scan.status === "scanning" || scan.status === "pending"
  ) || [];

  return (
    <div className="flex flex-col">
      {/* Top Action Bar */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              PQC Vulnerability Dashboard
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor post-quantum cryptography vulnerabilities across your repositories
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" data-testid="button-export-report">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
            <Button onClick={() => window.location.href = '/scan-repository'} data-testid="button-new-scan">
              <Plus className="mr-2 h-4 w-4" />
              New Scan
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Active Scans */}
        {activeScansList.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Active Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <ScanProgress scans={activeScansList} />
            </CardContent>
          </Card>
        )}

        {/* Recent Vulnerabilities */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Vulnerabilities</CardTitle>
            </div>
            <Button variant="ghost" data-testid="button-view-all-vulnerabilities">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <VulnerabilityTable vulnerabilities={recentVulnerabilities} />
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* NIST PQC Standards Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>NIST PQC Standards Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ComplianceItem
                  name="FIPS 203 (ML-KEM)"
                  description="CRYSTALS-KYBER Implementation"
                  status="compliant"
                />
                <ComplianceItem
                  name="FIPS 204 (ML-DSA)"
                  description="CRYSTALS-Dilithium Implementation"
                  status="partial"
                />
                <ComplianceItem
                  name="FIPS 205 (SLH-DSA)"
                  description="SPHINCS+ Implementation"
                  status="missing"
                />
              </div>
              <div className="mt-6 pt-4 border-t">
                <Button className="w-full" data-testid="button-generate-compliance-report">
                  Generate Compliance Report
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Integration Status */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <IntegrationItem
                  name="GitHub Actions"
                  description="3 repositories active"
                  status="active"
                />
                <IntegrationItem
                  name="Jenkins"
                  description="2 pipelines configured"
                  status="active"
                />
                <IntegrationItem
                  name="SonarQube"
                  description="Plugin installed"
                  status="setup_required"
                />
                <IntegrationItem
                  name="Semgrep"
                  description="Custom rules loaded"
                  status="active"
                />
              </div>
              <div className="mt-6 pt-4 border-t">
                <Button variant="outline" className="w-full" data-testid="button-manage-integrations">
                  Manage Integrations
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ComplianceItem({ 
  name, 
  description, 
  status 
}: { 
  name: string; 
  description: string; 
  status: "compliant" | "partial" | "missing" 
}) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "compliant":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50",
          badgeVariant: "default" as const,
          badgeColor: "text-green-800 bg-green-100"
        };
      case "partial":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600", 
          bgColor: "bg-yellow-50",
          badgeVariant: "secondary" as const,
          badgeColor: "text-yellow-800 bg-yellow-100"
        };
      case "missing":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-50", 
          badgeVariant: "destructive" as const,
          badgeColor: "text-red-800 bg-red-100"
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          badgeVariant: "outline" as const,
          badgeColor: "text-gray-800 bg-gray-100"
        };
    }
  };

  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${config.bgColor}`}>
      <div className="flex items-center space-x-3">
        <StatusIcon className={`h-5 w-5 ${config.color}`} />
        <div>
          <div className="text-sm font-medium text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Badge className={config.badgeColor}>
        {status === "compliant" ? "Compliant" : status === "partial" ? "Partial" : "Missing"}
      </Badge>
    </div>
  );
}

function IntegrationItem({ 
  name, 
  description, 
  status 
}: { 
  name: string; 
  description: string; 
  status: "active" | "setup_required" 
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="text-xl">
          {name === "GitHub Actions" && "🔗"}
          {name === "Jenkins" && "⚙️"}
          {name === "SonarQube" && "📊"}
          {name === "Semgrep" && "🔍"}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${status === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
        <span className={`text-sm ${status === "active" ? "text-green-600" : "text-yellow-600"}`}>
          {status === "active" ? "Active" : "Setup Required"}
        </span>
      </div>
    </div>
  );
}
