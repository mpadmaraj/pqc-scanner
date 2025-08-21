import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Repository, CbomReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Database, Download, Eye, RefreshCw, Shield, AlertTriangle, FileText, Search } from "lucide-react";

export default function CbomManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRepository, setSelectedRepository] = useState<string>("all");
  const [selectedCbom, setSelectedCbom] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: repositories = [] } = useQuery<Repository[]>({
    queryKey: ["/api/repositories"],
  });

  const { data: cbomReports = [], isLoading } = useQuery<CbomReport[]>({
    queryKey: ["/api/cbom"],
  });

  const { data: selectedCbomData } = useQuery<CbomReport>({
    queryKey: ["/api/cbom", selectedCbom],
    enabled: !!selectedCbom,
  });

  const generateCbomMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      return await apiRequest("POST", `/api/cbom/${repositoryId}/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cbom"] });
      toast({
        title: "CBOM Generated",
        description: "Cryptography Bill of Materials has been successfully generated.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate CBOM. Please try again.",
        variant: "destructive",
      });
    }
  });

  const filteredReports = cbomReports.filter((report) => {
    const repo = repositories.find((r) => r.id === report.repositoryId);
    const matchesSearch = !searchTerm || repo?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRepo = selectedRepository === "all" || report.repositoryId === selectedRepository;
    return matchesSearch && matchesRepo;
  });

  const getRepositoryName = (repositoryId: string) => {
    const repo = repositories.find((r) => r.id === repositoryId);
    return repo?.name || "Unknown Repository";
  };

  const getComplianceScore = (cryptoAssets: any[]) => {
    if (!cryptoAssets || cryptoAssets.length === 0) return 0;
    const compliantAssets = cryptoAssets.filter(asset => asset.nistCompliance);
    return Math.round((compliantAssets.length / cryptoAssets.length) * 100);
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: "Low", color: "text-green-600", bg: "bg-green-100" };
    if (score >= 60) return { level: "Medium", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { level: "High", color: "text-red-600", bg: "bg-red-100" };
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Q-Scan CBOM
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage Cryptography Bills of Materials and analyze crypto asset compliance
            </p>
          </div>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/cbom"] })}
            variant="outline"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">CBOM Reports</TabsTrigger>
            <TabsTrigger value="assets" data-testid="tab-assets">Crypto Assets</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Repository Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Repository CBOM Status</CardTitle>
                  <CardDescription>
                    Generate and manage CBOMs for your repositories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!repositories || repositories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No repositories found</p>
                      <p className="text-sm">Add repositories to generate CBOMs</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {repositories.map((repo) => {
                        const hasCbom = cbomReports?.some((report: any) => report.repositoryId === repo.id);
                        const cbomReport = cbomReports?.find((report: any) => report.repositoryId === repo.id);
                        const complianceScore = cbomReport ? getComplianceScore(cbomReport.cryptoAssets || []) : 0;
                        const risk = getRiskLevel(complianceScore);

                        return (
                          <div key={repo.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center space-x-4">
                              <div>
                                <h4 className="font-medium" data-testid={`text-repo-name-${repo.id}`}>
                                  {repo.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {hasCbom && cbomReport ? `${cbomReport.cryptoAssets?.length || 0} crypto assets` : "No CBOM generated"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              {hasCbom ? (
                                <>
                                  <div className="text-center">
                                    <div className="text-sm font-medium">Compliance</div>
                                    <div className={`text-sm ${risk.color}`}>{complianceScore}%</div>
                                  </div>
                                  <Badge className={risk.bg + " " + risk.color}>
                                    {risk.level} Risk
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedCbom(repo.id)}
                                    data-testid={`button-view-cbom-${repo.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  onClick={() => generateCbomMutation.mutate(repo.id)}
                                  disabled={generateCbomMutation.isPending}
                                  size="sm"
                                  data-testid={`button-generate-cbom-${repo.id}`}
                                >
                                  <Database className="h-4 w-4 mr-2" />
                                  Generate CBOM
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CBOM Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total CBOMs</span>
                    <span className="font-medium" data-testid="text-total-cboms">
                      {cbomReports?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Compliant Assets</span>
                    <span className="font-medium text-green-600" data-testid="text-compliant-assets">
                      {cbomReports?.reduce((acc: number, report: any) => 
                        acc + (report.cryptoAssets?.filter((asset: any) => asset.nistCompliance).length || 0), 0
                      ) || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Vulnerable Assets</span>
                    <span className="font-medium text-red-600" data-testid="text-vulnerable-assets">
                      {cbomReports?.reduce((acc: number, report: any) => 
                        acc + (report.cryptoAssets?.filter((asset: any) => !asset.nistCompliance).length || 0), 0
                      ) || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search repositories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={selectedRepository} onValueChange={setSelectedRepository}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-repository">
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
                </div>
              </CardContent>
            </Card>

            {/* CBOM Reports Table */}
            <Card>
              <CardHeader>
                <CardTitle>CBOM Reports</CardTitle>
                <CardDescription>
                  {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    Loading CBOM reports...
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No CBOM reports found</p>
                    <p className="text-sm">Generate CBOMs from the Overview tab</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Repository</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead>Crypto Assets</TableHead>
                          <TableHead>Compliance</TableHead>
                          <TableHead>Generated</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report: any) => {
                          const complianceScore = getComplianceScore(report.cryptoAssets);
                          const risk = getRiskLevel(complianceScore);

                          return (
                            <TableRow key={report.id} data-testid={`cbom-row-${report.id}`}>
                              <TableCell>
                                <div className="font-medium" data-testid={`text-repository-${report.id}`}>
                                  {getRepositoryName(report.repositoryId)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" data-testid={`badge-format-${report.id}`}>
                                  {report.bomFormat} {report.specVersion}
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`text-assets-count-${report.id}`}>
                                {report.cryptoAssets?.length || 0}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Progress value={complianceScore} className="w-16" />
                                  <span className={`text-sm ${risk.color}`}>
                                    {complianceScore}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm" data-testid={`text-created-${report.id}`}>
                                  {new Date(report.createdAt).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedCbom(report.repositoryId)}
                                    data-testid={`button-view-${report.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`button-download-${report.id}`}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assets" className="space-y-6">
            {selectedCbomData ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Crypto Assets - {getRepositoryName(selectedCbom!)}
                  </CardTitle>
                  <CardDescription>
                    Detailed view of cryptographic assets in this repository
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Algorithm</TableHead>
                          <TableHead>Key Size</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>NIST Compliance</TableHead>
                          <TableHead>Risk Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCbomData.cryptoAssets?.map((asset: any, index: number) => {
                          const isCompliant = asset.nistCompliance;
                          return (
                            <TableRow key={index} data-testid={`asset-row-${index}`}>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Shield className={`h-4 w-4 ${isCompliant ? 'text-green-600' : 'text-red-600'}`} />
                                  <span className="font-medium" data-testid={`text-algorithm-${index}`}>
                                    {asset.algorithm}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell data-testid={`text-key-size-${index}`}>
                                {asset.keySize ? `${asset.keySize} bits` : "N/A"}
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-2 py-1 rounded" data-testid={`text-location-${index}`}>
                                  {asset.location}
                                </code>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={isCompliant ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                                  data-testid={`badge-compliance-${index}`}
                                >
                                  {isCompliant ? "Compliant" : "Non-Compliant"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  {isCompliant ? (
                                    <Badge className="bg-green-100 text-green-800">Low</Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800">High</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a CBOM report to view crypto assets</p>
                    <p className="text-sm">Use the Reports tab to choose a repository</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
