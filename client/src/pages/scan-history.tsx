import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { History, Search, Eye, Download, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import VulnerabilityTable from "@/components/vulnerability-table";

export default function ScanHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedScan, setSelectedScan] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: scans, isLoading } = useQuery({
    queryKey: ["/api/scans"],
    refetchInterval: 5000, // Poll for active scans
  });

  const { data: repositories } = useQuery({
    queryKey: ["/api/repositories"],
  });

  const { data: scanVulnerabilities } = useQuery({
    queryKey: ["/api/vulnerabilities", selectedScan],
    enabled: !!selectedScan,
  });

  const retrySccanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const scan = scans?.find((s: any) => s.id === scanId);
      if (!scan) throw new Error("Scan not found");
      
      return await apiRequest("POST", "/api/scans", {
        repositoryId: scan.repositoryId,
        scanConfig: scan.scanConfig,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
    }
  });

  const filteredScans = scans?.filter((scan: any) => {
    const repo = repositories?.find((r: any) => r.id === scan.repositoryId);
    const matchesSearch = !searchTerm || repo?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || scan.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "scanning":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "bg-green-100 text-green-800",
      scanning: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800"
    };

    return (
      <Badge className={variants[status as keyof typeof variants] || "bg-gray-100 text-gray-800"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return "N/A";
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m`;
    return `${Math.round(diffMs / 3600000)}h`;
  };

  const getRepositoryName = (repositoryId: string) => {
    const repo = repositories?.find((r: any) => r.id === repositoryId);
    return repo?.name || "Unknown Repository";
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Q-Scan History
            </h2>
            <p className="text-sm text-muted-foreground">
              View and manage all vulnerability scan results
            </p>
          </div>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/scans"] })}
            variant="outline"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <Card className="mb-6">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="scanning">Scanning</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Scan History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>Scan Results</span>
            </CardTitle>
            <CardDescription>
              {filteredScans.length} scan{filteredScans.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading scan history...
              </div>
            ) : filteredScans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scans found</p>
                <p className="text-sm">Start a new scan to see results here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Tools</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScans.map((scan: any) => (
                      <TableRow key={scan.id} data-testid={`scan-row-${scan.id}`}>
                        <TableCell>
                          <div className="font-medium" data-testid={`text-repository-${scan.id}`}>
                            {getRepositoryName(scan.repositoryId)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {scan.totalFiles > 0 && `${scan.totalFiles} files`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(scan.status)}
                            {getStatusBadge(scan.status)}
                          </div>
                          {scan.errorMessage && (
                            <div className="text-xs text-red-600 mt-1" data-testid={`text-error-${scan.id}`}>
                              {scan.errorMessage}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {scan.status === "scanning" ? (
                            <div className="space-y-1">
                              <Progress value={scan.progress} className="w-16" />
                              <div className="text-xs text-muted-foreground">
                                {scan.progress}%
                              </div>
                            </div>
                          ) : scan.status === "completed" ? (
                            <div className="text-sm text-green-600">Complete</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">-</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm" data-testid={`text-started-${scan.id}`}>
                            {scan.startedAt 
                              ? new Date(scan.startedAt).toLocaleDateString()
                              : "Not started"
                            }
                          </div>
                          {scan.startedAt && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(scan.startedAt).toLocaleTimeString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm" data-testid={`text-duration-${scan.id}`}>
                            {formatDuration(scan.startedAt, scan.completedAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {scan.scanConfig?.tools && (
                            <div className="flex flex-wrap gap-1">
                              {scan.scanConfig.tools.slice(0, 2).map((tool: string) => (
                                <Badge key={tool} variant="secondary" className="text-xs">
                                  {tool}
                                </Badge>
                              ))}
                              {scan.scanConfig.tools.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{scan.scanConfig.tools.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedScan(
                                selectedScan === scan.id ? null : scan.id
                              )}
                              data-testid={`button-view-details-${scan.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {scan.status === "failed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => retrySccanMutation.mutate(scan.id)}
                                disabled={retrySccanMutation.isPending}
                                data-testid={`button-retry-${scan.id}`}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            {scan.status === "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-download-${scan.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Details */}
        {selectedScan && scanVulnerabilities && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                Vulnerabilities - {getRepositoryName(
                  filteredScans.find((s: any) => s.id === selectedScan)?.repositoryId
                )}
              </CardTitle>
              <CardDescription>
                {scanVulnerabilities.length} vulnerabilities found in this scan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VulnerabilityTable 
                vulnerabilities={scanVulnerabilities} 
                showRepository={false}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
