import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StatsCards from "@/components/stats-cards";
import ScanProgress from "@/components/scan-progress";
import VulnerabilityTable from "@/components/vulnerability-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle, XCircle, AlertTriangle, Github, GitBranch, Search, X, TrendingUp, PieChart, Library } from "lucide-react";
import { PieChart as RechartsPieChart, Pie as RechartsPie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import WordCloud from "@/components/word-cloud";

export default function Dashboard() {
  const [isNewScanDialogOpen, setIsNewScanDialogOpen] = useState(false);
  const [selectedRepoForScan, setSelectedRepoForScan] = useState<any>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>(["semgrep", "bandit"]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [customRules, setCustomRules] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activeScans } = useQuery({
    queryKey: ["/api/scans"],
    refetchInterval: 5000, // Poll every 5 seconds for active scans
  });

  const { data: repositories } = useQuery({
    queryKey: ["/api/repositories"],
  });

  const { data: recentVulnerabilities } = useQuery({
    queryKey: ["/api/vulnerabilities"],
    // params: { limit: 10, status: "new" }
  });

  const { data: integrations } = useQuery({
    queryKey: ["/api/integrations"],
  });

  // Enhanced dashboard data
  const { data: languageStats } = useQuery({
    queryKey: ["/api/dashboard/language-stats"],
  });

  const { data: cryptoAssets } = useQuery({
    queryKey: ["/api/dashboard/crypto-assets"],
  });

  const { data: cryptoLibraries } = useQuery({
    queryKey: ["/api/dashboard/crypto-libraries"],
  });

  const { data: vulnerabilityTrends } = useQuery({
    queryKey: ["/api/dashboard/vulnerability-trends"],
  });

  const { data: detailedStats } = useQuery({
    queryKey: ["/api/dashboard/detailed-stats"],
  });

  const activeScansList = Array.isArray(activeScans) ? activeScans.filter((scan: any) => 
    scan.status === "scanning" || scan.status === "pending"
  ) : [];

  const availableTools = [
    { id: "semgrep", name: "Semgrep", description: "Static analysis for security vulnerabilities" },
    { id: "bandit", name: "Bandit", description: "Python security linter" },
    { id: "pqc-analyzer", name: "PQC Analyzer", description: "Post-quantum cryptography vulnerability detection" },
    { id: "crypto-scanner", name: "Crypto Scanner", description: "Cryptographic implementation analyzer" }
  ];

  const availableLanguages = ["java", "javascript", "python"];

  const startScanMutation = useMutation({
    mutationFn: async (scanData: any) => {
      return await apiRequest("POST", "/api/scans", scanData);
    },
    onSuccess: (data) => {
      toast({
        title: "Scan started",
        description: `Scan initiated for ${selectedRepoForScan?.name}. You'll see progress updates here.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
      setIsNewScanDialogOpen(false);
      setSelectedRepoForScan(null);
      setSelectedTools(["semgrep", "bandit"]);
      setSelectedLanguages([]);
      setCustomRules("");
    },
    onError: (error: any) => {
      toast({
        title: "Scan failed to start",
        description: error.message || "Failed to start scan. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    );
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages(prev => 
      prev.includes(language) 
        ? prev.filter(l => l !== language)
        : [...prev, language]
    );
  };

  const handleStartScan = () => {
    if (!selectedRepoForScan) {
      toast({
        title: "Error",
        description: "Please select a repository to scan.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTools.length === 0) {
      toast({
        title: "Configuration Error",
        description: "Please select at least one scanning tool.",
        variant: "destructive",
      });
      return;
    }

    startScanMutation.mutate({
      repositoryId: selectedRepoForScan.id,
      scanConfig: {
        tools: selectedTools,
        languages: selectedLanguages,
        customRules: customRules ? customRules.split('\n').filter(Boolean) : [],
      }
    });
  };

  const handleOpenNewScanDialog = () => {
    setIsNewScanDialogOpen(true);
  };

  return (
    <div className="flex flex-col">
      {/* Top Action Bar */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Q-Scan Dashboard
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor post-quantum cryptography vulnerabilities across your repositories
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* New Scan button moved to Scan History tab */}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6">
        {/* Stats Cards */}
        <StatsCards stats={stats as any} />

        {/* Active Scans with Live Updates */}
        {activeScansList.length > 0 && (
          <Card className="mb-8 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardHeader>
              <CardTitle className="text-orange-800 dark:text-orange-200">
                🔄 Active Scans ({activeScansList.length})
              </CardTitle>
              <CardDescription className="text-orange-600 dark:text-orange-400">
                Scans are running in the background. Results will appear automatically when complete.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScanProgress scans={activeScansList} />
              <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900 rounded text-sm text-orange-800 dark:text-orange-200">
                <p>💡 <strong>Live Updates:</strong> This page refreshes every 5 seconds to show scan progress.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Stats Section */}
        {detailedStats && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Repository Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-total-repositories">
                    {detailedStats.totalRepositories}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Repositories</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="stat-total-scanned">
                    {detailedStats.totalScanned}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">Repositories Scanned</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="stat-total-vulnerabilities">
                    {detailedStats.totalVulnerabilities}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">Total Vulnerabilities</div>
                </div>
                {/* <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400" data-testid="stat-last-scan-date">
                    {detailedStats.lastScanDate 
                      ? new Date(detailedStats.lastScanDate).toLocaleDateString()
                      : 'Never'
                    }
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">Last Scan</div>
                </div> */}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Repository Languages Donut Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="mr-2 h-5 w-5" />
                Repository Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {languageStats && languageStats.length > 0 ? (
                <div className="h-64" data-testid="chart-language-stats">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsPie
                        data={languageStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {languageStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][index % 5]} />
                        ))}
                      </RechartsPie>
                      <Tooltip formatter={(value, name) => [`${value} repositories`, name]} />
                      <Legend formatter={(value) => languageStats.find(item => item.count.toString() === value)?.language || value} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No language data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Crypto Assets Donut Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="mr-2 h-5 w-5" />
                Crypto Asset Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cryptoAssets && cryptoAssets.length > 0 ? (
                <div className="h-64" data-testid="chart-crypto-assets">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsPie
                        data={cryptoAssets}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {cryptoAssets.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'][index % 5]} />
                        ))}
                      </RechartsPie>
                      <Tooltip formatter={(value, name) => [`${value} assets`, name]} />
                      <Legend formatter={(value) => cryptoAssets.find(item => item.count.toString() === value)?.assetType || value} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No crypto assets data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Word Cloud and Vulnerability Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Crypto Libraries Word Cloud */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Library className="mr-2 h-5 w-5" />
                Crypto Libraries Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WordCloud data={cryptoLibraries || []} />
            </CardContent>
          </Card>

          {/* Vulnerability Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Vulnerability Trends (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vulnerabilityTrends && vulnerabilityTrends.length > 0 ? (
                <div className="h-64" data-testid="chart-vulnerability-trends">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={vulnerabilityTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis />
                      <Tooltip labelFormatter={(label) => `Date: ${label}`} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stackId="1" 
                        stroke="#EF4444" 
                        fill="#EF4444" 
                        fillOpacity={0.6}
                        name="Vulnerabilities"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No vulnerability trends data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
            <VulnerabilityTable vulnerabilities={Array.isArray(recentVulnerabilities) ? recentVulnerabilities : []} />
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

      {/* New Scan functionality moved to Scan History tab */}
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
