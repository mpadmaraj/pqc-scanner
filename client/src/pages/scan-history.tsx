import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Scan, Repository, Vulnerability, Integration } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Search, Eye, Download, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight, User, Zap, FileText } from "lucide-react";
import VulnerabilityTable from "@/components/vulnerability-table";
import CBOMReportView from "@/components/cbom-report-view";

export default function ScanHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const queryClient = useQueryClient();

  const { data: scans = [], isLoading } = useQuery<Scan[]>({
    queryKey: ["/api/scans"],
    refetchInterval: 5000, // Poll for active scans
  });

  const { data: repositories = [] } = useQuery<Repository[]>({
    queryKey: ["/api/repositories"],
  });

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: scanVulnerabilities = [] } = useQuery<Vulnerability[]>({
    queryKey: ["/api/vulnerabilities", selectedScan],
    enabled: !!selectedScan,
  });

  const { data: cbomReport } = useQuery({
    queryKey: ["/api/cbom-reports", selectedScan],
    enabled: !!selectedScan,
  });

  const retrySccanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const scan = scans.find((s) => s.id === scanId);
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

  const filteredScans = scans.filter((scan) => {
    const repo = repositories.find((r) => r.id === scan.repositoryId);
    const matchesSearch = !searchTerm || repo?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || scan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredScans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedScans = filteredScans.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const handleFiltersChange = () => {
    setCurrentPage(1);
  };

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
    const repo = repositories.find((r) => r.id === repositoryId);
    return repo?.name || "Unknown Repository";
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
    queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
  };

  // Download CBOM report function
  const handleDownloadCBOM = async (scanId: string) => {
    try {
      const response = await fetch(`/api/cbom-reports/${scanId}`);
      if (!response.ok) throw new Error('Failed to fetch CBOM report');
      
      const cbomData = await response.json();
      const blob = new Blob([JSON.stringify(cbomData.content, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cbom-report-${scanId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CBOM report:', error);
    }
  };

  const handleDownloadPDF = async (scanId: string) => {
    try {
      const response = await fetch(`/api/cbom-reports/${scanId}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF report');
      
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      
      const scan = scans.find(s => s.id === scanId);
      const repository = repositories.find(r => r.id === scan?.repositoryId);
      const fileName = `cbom-report-${repository?.name || 'unknown'}-${scanId}.pdf`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF report:', error);
    }
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
            onClick={handleRefresh}
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
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    handleFiltersChange();
                  }}
                  className="w-full"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                handleFiltersChange();
              }}>
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
              {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading scan history...
              </div>
            ) : paginatedScans.length === 0 ? (
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
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scan Date & Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedScans.map((scan: any) => (
                      <>
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
                            <TooltipProvider>
                              {scan.integrationId ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs">
                                      <Zap className="w-3 h-3 mr-1" />
                                      {integrations.find(i => i.id === scan.integrationId)?.name || "Integration"}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Triggered via {integrations.find(i => i.id === scan.integrationId)?.type || "integration"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="text-xs">
                                      <User className="w-3 h-3 mr-1" />
                                      Manual
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Manually initiated scan</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(scan.status)}
                              {getStatusBadge(scan.status)}
                            </div>
                            {scan.status === "scanning" && (
                              <div className="mt-1">
                                <Progress value={scan.progress} className="w-20" />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {scan.progress}%
                                </div>
                              </div>
                            )}
                            {/* Debug info for pending scans */}
                            {scan.status === "pending" && (
                              <div className="text-xs text-amber-600 mt-1">
                                Queued - ID: {scan.id.slice(0, 8)}...
                              </div>
                            )}
                            {/* Show detailed error info */}
                            {scan.errorMessage && (
                              <div className="text-xs text-red-600 mt-1" data-testid={`text-error-${scan.id}`}>
                                Error: {scan.errorMessage}
                              </div>
                            )}
                            {scan.error && (
                              <div className="text-xs text-red-600 mt-1">
                                {scan.error}
                              </div>
                            )}
                            {/* Show start time for debugging */}
                            {scan.startedAt && scan.status === "scanning" && (
                              <div className="text-xs text-blue-600 mt-1">
                                Running for {formatDuration(scan.startedAt)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" data-testid={`text-scan-datetime-${scan.id}`}>
                              {scan.startedAt 
                                ? new Date(scan.startedAt).toLocaleDateString()
                                : scan.createdAt 
                                ? new Date(scan.createdAt).toLocaleDateString()
                                : "Not started"
                              }
                            </div>
                            {(scan.startedAt || scan.createdAt) && (
                              <div className="text-xs text-muted-foreground">
                                {scan.startedAt 
                                  ? new Date(scan.startedAt).toLocaleTimeString()
                                  : new Date(scan.createdAt).toLocaleTimeString()
                                }
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" data-testid={`text-duration-${scan.id}`}>
                              {formatDuration(scan.startedAt, scan.completedAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <div className="flex items-center space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
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
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{selectedScan === scan.id ? "Hide details" : "View details"}</p>
                                  </TooltipContent>
                                </Tooltip>
                                {scan.status === "failed" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => retrySccanMutation.mutate(scan.id)}
                                        disabled={retrySccanMutation.isPending}
                                        data-testid={`button-retry-${scan.id}`}
                                      >
                                        <RefreshCw className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Retry failed scan</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {scan.status === "completed" && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDownloadCBOM(scan.id)}
                                          data-testid={`button-download-${scan.id}`}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Download JSON report</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDownloadPDF(scan.id)}
                                          data-testid={`button-download-pdf-${scan.id}`}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Download PDF report</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                        {/* Scan Details Row */}
                        {selectedScan === scan.id && (
                          <TableRow key={`${scan.id}-details`}>
                            <TableCell colSpan={6} className="p-0">
                              <div className="bg-gray-50 p-4 border-t border-gray-200">
                                <div className="mb-4">
                                  <h4 className="font-medium text-sm mb-2">
                                    Scan Results - {getRepositoryName(scan.repositoryId)}
                                  </h4>
                                </div>
                                <div className="mb-3">
                                  <p className="text-xs text-muted-foreground">
                                    {scanVulnerabilities.length} vulnerabilities found in this scan
                                  </p>
                                </div>
                                <VulnerabilityTable 
                                  vulnerabilities={scanVulnerabilities} 
                                  showRepository={false}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredScans.length)} of {filteredScans.length} scans
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        const diff = Math.abs(page - currentPage);
                        return diff <= 2 || page === 1 || page === totalPages;
                      })
                      .map((page, index, array) => {
                        const prevPage = array[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        
                        return (
                          <div key={page} className="flex items-center">
                            {showEllipsis && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="w-10"
                              data-testid={`button-page-${page}`}
                            >
                              {page}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
