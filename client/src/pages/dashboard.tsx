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
import { Download, Plus, CheckCircle, XCircle, AlertTriangle, Github, GitBranch, Search, X } from "lucide-react";

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
            <Button onClick={handleOpenNewScanDialog} data-testid="button-new-scan">
              <Plus className="mr-2 h-4 w-4" />
              New Scan
            </Button>
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

      {/* New Scan Dialog */}
      <Dialog open={isNewScanDialogOpen} onOpenChange={setIsNewScanDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Scan</DialogTitle>
            <DialogDescription>
              {selectedRepoForScan ? 
                `Configure scan settings for "${selectedRepoForScan.name}"` : 
                "Select a repository and configure scan settings"}
            </DialogDescription>
          </DialogHeader>

          {!selectedRepoForScan ? (
            <div className="space-y-4">
              <Label>Select Repository</Label>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {!Array.isArray(repositories) || repositories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No repositories available</p>
                    <p className="text-sm">Add repositories from the Scan Repository page first</p>
                  </div>
                ) : (
                  Array.isArray(repositories) && repositories.map((repo: any) => (
                    <div key={repo.id} 
                         className="flex items-center justify-between p-3 border rounded hover:bg-muted cursor-pointer"
                         onClick={() => {
                           setSelectedRepoForScan(repo);
                           setSelectedLanguages(repo.languages || []);
                         }}>
                      <div className="flex items-center space-x-2">
                        {repo.provider === "github" && <Github className="h-4 w-4" />}
                        {repo.provider === "gitlab" && <GitBranch className="h-4 w-4" />}
                        <span className="font-medium">{repo.name}</span>
                        {repo.languages && repo.languages.length > 0 && (
                          <div className="flex gap-1">
                            {repo.languages.slice(0, 3).map((lang: string) => (
                              <Badge key={lang} variant="secondary" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                            {repo.languages.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{repo.languages.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline">{repo.provider}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 p-3 bg-muted rounded">
                {selectedRepoForScan.provider === "github" && <Github className="h-4 w-4" />}
                {selectedRepoForScan.provider === "gitlab" && <GitBranch className="h-4 w-4" />}
                <span className="font-medium">{selectedRepoForScan.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedRepoForScan(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Scanning Tools */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Scanning Tools</Label>
                <div className="space-y-3">
                  {availableTools.map((tool) => (
                    <div key={tool.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`dashboard-${tool.id}`}
                        checked={selectedTools.includes(tool.id)}
                        onCheckedChange={() => handleToolToggle(tool.id)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor={`dashboard-${tool.id}`} className="text-sm font-medium">
                          {tool.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Target Languages</Label>
                <div className="grid grid-cols-3 gap-2">
                  {availableLanguages.map((language) => (
                    <div key={language} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dashboard-${language}`}
                        checked={selectedLanguages.includes(language)}
                        onCheckedChange={() => handleLanguageToggle(language)}
                      />
                      <Label htmlFor={`dashboard-${language}`} className="text-xs capitalize">
                        {language}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Rules */}
              <div>
                <Label htmlFor="dashboard-custom-rules" className="text-sm font-medium">
                  Custom Rules (Optional)
                </Label>
                <Textarea
                  id="dashboard-custom-rules"
                  value={customRules}
                  onChange={(e) => setCustomRules(e.target.value)}
                  placeholder="One rule per line..."
                  className="mt-2 text-xs font-mono"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsNewScanDialogOpen(false);
              setSelectedRepoForScan(null);
            }}>
              Cancel
            </Button>
            {selectedRepoForScan && (
              <Button 
                onClick={handleStartScan}
                disabled={startScanMutation.isPending || selectedTools.length === 0}>
                <Search className="h-4 w-4 mr-2" />
                {startScanMutation.isPending ? "Starting Scan..." : "Start Scan"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
