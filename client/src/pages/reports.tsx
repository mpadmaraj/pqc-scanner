import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Eye, Calendar, TrendingUp, Shield, AlertTriangle, BarChart3 } from "lucide-react";
import VulnerabilityTable from "@/components/vulnerability-table";

export default function Reports() {
  const [selectedRepository, setSelectedRepository] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("30d");

  const { data: repositories } = useQuery({
    queryKey: ["/api/repositories"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: vulnerabilities } = useQuery({
    queryKey: ["/api/vulnerabilities", selectedRepository !== "all" ? selectedRepository : undefined],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (config: any) => {
      return await apiRequest("POST", "/api/reports/generate", config);
    }
  });

  // Calculate actual data based on vulnerabilities
  const vulnerabilitysByType = vulnerabilities?.reduce((acc: any, vuln: any) => {
    const severity = vuln.severity || 'medium';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {}) || {};

  const totalVulnerabilities = vulnerabilities?.length || 0;
  const criticalCount = vulnerabilitysByType.critical || 0;
  const highCount = vulnerabilitysByType.high || 0;
  const mediumCount = vulnerabilitysByType.medium || 0;
  const lowCount = vulnerabilitysByType.low || 0;

  // Use real stats or fallback to 0
  const realStats = {
    totalRepositories: stats?.totalRepositories || repositories?.length || 0,
    totalScans: stats?.totalScans || 0,
    totalVulnerabilities: stats?.totalVulnerabilities || totalVulnerabilities,
    criticalVulnerabilities: stats?.criticalVulnerabilities || criticalCount,
    highVulnerabilities: stats?.highVulnerabilities || highCount,
    mediumVulnerabilities: stats?.mediumVulnerabilities || mediumCount,
    lowVulnerabilities: stats?.lowVulnerabilities || lowCount,
  };

  const vulnerabilityTrends = [
    { 
      month: "Current", 
      critical: realStats.criticalVulnerabilities, 
      high: realStats.highVulnerabilities, 
      medium: realStats.mediumVulnerabilities, 
      low: realStats.lowVulnerabilities 
    },
  ];

  const complianceData = [
    { 
      standard: "FIPS 203 (ML-KEM)", 
      compliance: criticalCount === 0 ? 100 : Math.max(0, 100 - (criticalCount * 10)), 
      status: criticalCount === 0 ? "compliant" : criticalCount < 3 ? "partial" : "missing" 
    },
    { 
      standard: "FIPS 204 (ML-DSA)", 
      compliance: highCount === 0 ? 100 : Math.max(0, 100 - (highCount * 5)), 
      status: highCount === 0 ? "compliant" : highCount < 5 ? "partial" : "missing" 
    },
    { 
      standard: "FIPS 205 (SLH-DSA)", 
      compliance: mediumCount === 0 ? 100 : Math.max(0, 100 - (mediumCount * 2)), 
      status: mediumCount === 0 ? "compliant" : mediumCount < 10 ? "partial" : "missing" 
    },
  ];

  const riskScores = {
    overall: Math.max(0, 100 - (criticalCount * 15 + highCount * 10 + mediumCount * 5 + lowCount * 2)),
    cryptographic: Math.max(0, 100 - (criticalCount * 20 + highCount * 10)),
    quantumReadiness: Math.max(0, 100 - (criticalCount * 25 + highCount * 15)),
    compliance: complianceData.reduce((avg, item) => avg + item.compliance, 0) / complianceData.length
  };

  const handleGenerateReport = (format: string) => {
    generateReportMutation.mutate({
      repositoryId: selectedRepository !== "all" ? selectedRepository : undefined,
      timeframe: selectedTimeframe,
      format,
      includeVulnerabilities: true,
      includeCompliance: true,
      includeCBOM: true,
    });
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Reports & Analytics
            </h2>
            <p className="text-sm text-muted-foreground">
              Generate comprehensive vulnerability and compliance reports
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={selectedRepository} onValueChange={setSelectedRepository}>
              <SelectTrigger className="w-48" data-testid="select-repository">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Repositories</SelectItem>
                {repositories?.map((repo: any) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-32" data-testid="select-timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="vulnerabilities" data-testid="tab-vulnerabilities">Vulnerabilities</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Risk Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Overall Risk</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-semibold text-foreground" data-testid="text-overall-risk">
                          {riskScores.overall}
                        </p>
                        <Badge variant={riskScores.overall > 80 ? "destructive" : riskScores.overall > 60 ? "default" : "secondary"}>
                          {riskScores.overall > 80 ? "High" : riskScores.overall > 60 ? "Medium" : "Low"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-orange-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Crypto Security</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-semibold text-foreground" data-testid="text-crypto-security">
                          {riskScores.cryptographic}
                        </p>
                        <Progress value={riskScores.cryptographic} className="w-16" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Quantum Readiness</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-semibold text-foreground" data-testid="text-quantum-readiness">
                          {riskScores.quantumReadiness}
                        </p>
                        <Progress value={riskScores.quantumReadiness} className="w-16" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Compliance</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-semibold text-foreground" data-testid="text-compliance-score">
                          {riskScores.compliance}%
                        </p>
                        <Progress value={riskScores.compliance} className="w-16" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Reports</CardTitle>
                <CardDescription>
                  Export comprehensive security and compliance reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => handleGenerateReport("pdf")}
                    disabled={generateReportMutation.isPending}
                    data-testid="button-generate-pdf"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF Report
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateReport("html")}
                    disabled={generateReportMutation.isPending}
                    data-testid="button-generate-html"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    HTML Report
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateReport("json")}
                    disabled={generateReportMutation.isPending}
                    data-testid="button-generate-json"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    JSON Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vulnerabilities Tab */}
          <TabsContent value="vulnerabilities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Vulnerability Details</CardTitle>
                <CardDescription>
                  Comprehensive list of discovered vulnerabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VulnerabilityTable vulnerabilities={vulnerabilities} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>NIST PQC Standards Compliance</CardTitle>
                <CardDescription>
                  Assessment against NIST post-quantum cryptography standards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {complianceData.map((item) => (
                    <div key={item.standard} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium" data-testid={`text-standard-${item.standard}`}>
                            {item.standard}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Compliance: {item.compliance}%
                          </p>
                        </div>
                        <Badge 
                          className={
                            item.status === "compliant" 
                              ? "bg-green-100 text-green-800"
                              : item.status === "partial"
                              ? "bg-yellow-100 text-yellow-800"  
                              : "bg-red-100 text-red-800"
                          }
                          data-testid={`badge-status-${item.standard}`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <Progress 
                        value={item.compliance} 
                        className="w-full"
                        data-testid={`progress-${item.standard}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Vulnerability Trends</span>
                </CardTitle>
                <CardDescription>
                  Historical view of vulnerability discoveries over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vulnerabilityTrends.map((trend) => (
                    <div key={trend.month} className="grid grid-cols-5 gap-4 items-center">
                      <div className="text-sm font-medium" data-testid={`text-month-${trend.month}`}>
                        {trend.month}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-sm">{trend.critical}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-orange-500 rounded"></div>
                        <span className="text-sm">{trend.high}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span className="text-sm">{trend.medium}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <span className="text-sm">{trend.low}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Critical</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded"></div>
                      <span>High</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span>Medium</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span>Low</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
