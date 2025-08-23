import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Github, GitBranch, Search, Play, Plus, ExternalLink, AlertCircle, CheckCircle, Clock, Filter, ArrowUpDown, Edit, Trash2 } from "lucide-react";

export default function ScanRepository() {
  // Add Repository Modal State
  const [isAddRepoModalOpen, setIsAddRepoModalOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [provider, setProvider] = useState<"github" | "gitlab" | "bitbucket" | "local">("github");
  const [description, setDescription] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isValidatingRepo, setIsValidatingRepo] = useState(false);
  const [repoValidationStatus, setRepoValidationStatus] = useState<string | null>(null);
  
  // Table State
  const [searchTerm, setSearchTerm] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [vulnerabilityFilter, setVulnerabilityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("lastScanAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: repositories } = useQuery({
    queryKey: ["/api/repositories"],
  });

  const { data: scans } = useQuery({
    queryKey: ["/api/scans"],
    refetchInterval: 5000, // Poll every 5 seconds for scan status
  });

  const { data: vulnerabilities } = useQuery({
    queryKey: ["/api/vulnerabilities"],
  });

  const availableLanguages = [
    "java", "javascript", "python", "typescript", "go", "rust", "cpp", "csharp"
  ];

  const vulnerabilityTypes = [
    "critical", "high", "medium", "low", "info"
  ];

  const createRepositoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/repositories", data);
    },
    onSuccess: async (newRepo: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      setIsAddRepoModalOpen(false);
      
      // Auto-start scan with semgrep only
      try {
        await apiRequest("POST", "/api/scans", {
          repositoryId: newRepo.id,
          scanConfig: {
            tools: ["semgrep"],
            languages: selectedLanguages,
            customRules: [],
          }
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
        
        toast({
          title: "Repository added and scan started",
          description: `${newRepo.name} has been added and vulnerability scan is now running.`,
        });
      } catch (scanError) {
        toast({
          title: "Repository added, scan failed",
          description: "Repository was added but scan failed to start. You can manually start it.",
          variant: "destructive",
        });
      }
      
      // Reset form
      setRepoName("");
      setRepoUrl("");
      setDescription("");
      setSelectedLanguages([]);
      setRepoValidationStatus(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add repository. Please check the URL and try again.",
        variant: "destructive",
      });
    }
  });

  const startScanMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/scans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
      toast({
        title: "Scan started",
        description: "Vulnerability scan has been initiated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start scan. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Computed data for table
  const enrichedRepositories = useMemo(() => {
    if (!Array.isArray(repositories)) return [];
    
    return repositories.map((repo: any) => {
      // Find latest scan for this repository
      const repoScans = Array.isArray(scans) ? scans.filter((scan: any) => scan.repositoryId === repo.id) : [];
      const latestScan = repoScans.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0];
      
      // Find vulnerabilities for this repository
      const repoVulns = Array.isArray(vulnerabilities) ? 
        vulnerabilities.filter((vuln: any) => vuln.repositoryId === repo.id) : [];
      
      // Count vulnerabilities by severity
      const vulnCounts = repoVulns.reduce((acc: any, vuln: any) => {
        acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
        acc.total = (acc.total || 0) + 1;
        return acc;
      }, {});
      
      return {
        ...repo,
        latestScan,
        vulnerabilities: vulnCounts,
        lastScanAt: latestScan?.completedAt || latestScan?.createdAt,
        scanStatus: latestScan?.status
      };
    });
  }, [repositories, scans, vulnerabilities]);

  // Filtered and sorted data
  const filteredRepositories = useMemo(() => {
    let filtered = enrichedRepositories.filter((repo: any) => {
      // Search filter
      const searchMatch = !searchTerm || 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Language filter
      const languageMatch = languageFilter === "all" ||
        (repo.languages && repo.languages.includes(languageFilter));
      
      // Vulnerability filter
      const vulnerabilityMatch = vulnerabilityFilter === "all" ||
        (repo.vulnerabilities && repo.vulnerabilities[vulnerabilityFilter] > 0);
      
      return searchMatch && languageMatch && vulnerabilityMatch;
    });
    
    // Sort data
    filtered.sort((a: any, b: any) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'lastScanAt':
          aVal = a.lastScanAt ? new Date(a.lastScanAt).getTime() : 0;
          bVal = b.lastScanAt ? new Date(b.lastScanAt).getTime() : 0;
          break;
        case 'vulnerabilities':
          aVal = a.vulnerabilities?.total || 0;
          bVal = b.vulnerabilities?.total || 0;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    return filtered;
  }, [enrichedRepositories, searchTerm, languageFilter, vulnerabilityFilter, sortBy, sortOrder]);

  // Paginated data
  const paginatedRepositories = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRepositories.slice(startIndex, startIndex + pageSize);
  }, [filteredRepositories, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRepositories.length / pageSize);

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages(prev =>
      prev.includes(language)
        ? prev.filter(l => l !== language)
        : [...prev, language]
    );
  };

  const handleAddRepository = () => {
    if (!repoUrl || !repoName) {
      toast({
        title: "Validation Error",
        description: "Repository URL and name are required.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate repository URL
    const existingRepo = Array.isArray(repositories) ? repositories.find((repo: any) => 
      repo.url.toLowerCase() === repoUrl.toLowerCase()
    ) : undefined;
    
    if (existingRepo) {
      toast({
        title: "Duplicate Repository",
        description: "This repository URL is already added.",
        variant: "destructive",
      });
      return;
    }

    createRepositoryMutation.mutate({
      name: repoName,
      url: repoUrl,
      provider,
      description,
      languages: selectedLanguages,
    });
  };

  const handleStartScan = (repositoryId: string) => {
    startScanMutation.mutate({
      repositoryId,
      scanConfig: {
        tools: ["semgrep"],
        languages: [],
        customRules: [],
      }
    });
  };

  const handleEditRepository = (repo: any) => {
    toast({
      title: "Edit Repository",
      description: "Edit functionality would open a modal to modify repository settings.",
    });
  };

  const handleDeleteRepository = async (repositoryId: string) => {
    if (!confirm("Are you sure you want to delete this repository? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/repositories/${repositoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete repository');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      toast({
        title: "Repository deleted",
        description: "Repository has been successfully removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete repository. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const validateAndFetchRepoMetadata = async (url: string) => {
    if (!url || !url.includes('github.com') && !url.includes('gitlab.com') && !url.includes('bitbucket.org')) {
      setRepoValidationStatus(null);
      return;
    }

    setIsValidatingRepo(true);
    setRepoValidationStatus("Checking repository...");

    try {
      // Extract repository information from URL
      const urlMatch = url.match(/(?:github\.com|gitlab\.com|bitbucket\.org)\/([^\/]+)\/([^\/]+)/);
      if (!urlMatch) {
        setRepoValidationStatus("Invalid repository URL format");
        setIsValidatingRepo(false);
        return;
      }

      const [, owner, repoName] = urlMatch;
      const cleanRepoName = repoName.replace(/\.git$/, '');

      // For GitHub repositories, try to fetch metadata
      if (url.includes('github.com')) {
        try {
          const response = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}`);
          if (response.ok) {
            const repoData = await response.json();
            
            // Auto-populate fields with fetched data
            if (!description || description === "") {
              setDescription(repoData.description || "");
            }
            
            // Try to fetch languages
            const languagesResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}/languages`);
            if (languagesResponse.ok) {
              const languagesData = await languagesResponse.json();
              const detectedLanguages = Object.keys(languagesData)
                .map(lang => lang.toLowerCase())
                .filter(lang => availableLanguages.includes(lang));
              
              if (detectedLanguages.length > 0) {
                setSelectedLanguages(detectedLanguages);
              }
            }

            setRepoValidationStatus("✓ Repository found and accessible");
          } else if (response.status === 404) {
            setRepoValidationStatus("❌ Repository not found or not accessible");
          } else {
            setRepoValidationStatus("❌ Unable to access repository");
          }
        } catch (error) {
          setRepoValidationStatus("❌ Error validating repository");
        }
      } else {
        // For other providers, just validate URL format
        setRepoValidationStatus("✓ Repository URL format is valid");
      }
    } catch (error) {
      setRepoValidationStatus("❌ Error validating repository");
    } finally {
      setIsValidatingRepo(false);
    }
  };

  const getScanStatusDisplay = (repo: any) => {
    if (!repo.scanStatus) {
      return {
        icon: <Clock className="h-4 w-4 text-gray-500" />,
        dateTime: "Never scanned",
        status: "",
        className: "text-gray-500"
      };
    }
    
    const formatDateTime = (dateString: string) => {
      const date = new Date(dateString);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    };
    
    switch (repo.scanStatus) {
      case 'scanning':
      case 'pending':
        const startedAt = repo.latestScan?.createdAt ? formatDateTime(repo.latestScan.createdAt) : null;
        return {
          icon: <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>,
          dateTime: startedAt ? `${startedAt.date} ${startedAt.time}` : "Starting...",
          status: "Scanning",
          className: "text-blue-600"
        };
      case 'completed':
        const completedAt = repo.lastScanAt ? formatDateTime(repo.lastScanAt) : null;
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          dateTime: completedAt ? `${completedAt.date} ${completedAt.time}` : "Completed",
          status: "Completed",
          className: "text-green-600"
        };
      case 'failed':
        const failedAt = repo.latestScan?.createdAt ? formatDateTime(repo.latestScan.createdAt) : null;
        return {
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
          dateTime: failedAt ? `${failedAt.date} ${failedAt.time}` : "Failed",
          status: "Failed",
          className: "text-red-600"
        };
      default:
        return {
          icon: <Clock className="h-4 w-4 text-gray-500" />,
          dateTime: "Unknown",
          status: "",
          className: "text-gray-500"
        };
    }
  };

  const getVulnerabilityDisplay = (repo: any) => {
    const vulns = repo.vulnerabilities;
    if (!vulns || vulns.total === 0) {
      return {
        count: 0,
        display: "No issues",
        className: "text-green-600",
        bgClass: "bg-green-50 hover:bg-green-100"
      };
    }
    
    const critical = vulns.critical || 0;
    const high = vulns.high || 0;
    const total = vulns.total || 0;
    
    if (critical > 0) {
      return {
        count: total,
        display: `${critical} Critical, ${total} Total`,
        className: "text-red-600",
        bgClass: "bg-red-50 hover:bg-red-100"
      };
    } else if (high > 0) {
      return {
        count: total,
        display: `${high} High, ${total} Total`,
        className: "text-orange-600",
        bgClass: "bg-orange-50 hover:bg-orange-100"
      };
    } else {
      return {
        count: total,
        display: `${total} Issues`,
        className: "text-yellow-600",
        bgClass: "bg-yellow-50 hover:bg-yellow-100"
      };
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Repository Scanner
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage repositories and run PQC vulnerability scans
            </p>
          </div>
          <Button onClick={() => setIsAddRepoModalOpen(true)} data-testid="button-add-repository">
            <Plus className="mr-2 h-4 w-4" />
            Add Repository
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search repositories by name, URL, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-repositories"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="w-40" data-testid="select-language-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={vulnerabilityFilter} onValueChange={setVulnerabilityFilter}>
                  <SelectTrigger className="w-40" data-testid="select-vulnerability-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    {vulnerabilityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repository Table */}
        <Card>
          <CardHeader>
            <CardTitle>Repositories ({filteredRepositories.length})</CardTitle>
            <CardDescription>
              Repositories configured for vulnerability scanning
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paginatedRepositories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm || languageFilter !== "all" || vulnerabilityFilter !== "all" ? (
                  <>
                    <p>No repositories match your filters</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setLanguageFilter("all");
                        setVulnerabilityFilter("all");
                      }}
                      className="mt-2"
                    >
                      Clear filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p>No repositories added yet</p>
                    <Button onClick={() => setIsAddRepoModalOpen(true)} className="mt-2">
                      Add your first repository
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('name')}
                        data-testid="header-repo-name"
                      >
                        <div className="flex items-center">
                          Repository Name
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('lastScanAt')}
                        data-testid="header-last-scanned"
                      >
                        <div className="flex items-center">
                          Last Scanned
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-foreground"
                        onClick={() => handleSort('vulnerabilities')}
                        data-testid="header-vulnerabilities"
                      >
                        <div className="flex items-center">
                          Vulnerabilities
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRepositories.map((repo: any) => {
                      const scanStatus = getScanStatusDisplay(repo);
                      const vulnDisplay = getVulnerabilityDisplay(repo);
                      
                      return (
                        <TableRow key={repo.id} data-testid={`row-repo-${repo.id}`}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                {repo.provider === "github" && <Github className="h-4 w-4 text-muted-foreground" />}
                                {repo.provider === "gitlab" && <GitBranch className="h-4 w-4 text-muted-foreground" />}
                                <a
                                  href={repo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-primary hover:underline flex items-center"
                                  data-testid={`link-repo-${repo.id}`}
                                >
                                  {repo.name}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </div>
                              {repo.description && (
                                <p className="text-xs text-muted-foreground">{repo.description}</p>
                              )}
                              {repo.languages && repo.languages.length > 0 && (
                                <div className="flex flex-wrap gap-1">
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
                          </TableCell>
                          <TableCell>
                            <div className={`space-y-1 ${scanStatus.className}`}>
                              <div className="flex items-center space-x-2">
                                {scanStatus.icon}
                                <span className="text-sm font-medium">{scanStatus.status}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {scanStatus.dateTime}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <div className={`inline-flex items-center px-2 py-1 rounded-md text-sm ${vulnDisplay.bgClass} ${vulnDisplay.className}`}>
                                {vulnDisplay.count > 0 && (
                                  <button
                                    onClick={() => {
                                      // Navigate to vulnerability page - would need to implement navigation
                                      toast({
                                        title: "Vulnerability details",
                                        description: "Would open vulnerability details for this repository",
                                      });
                                    }}
                                    className="hover:underline"
                                    data-testid={`button-view-vulnerabilities-${repo.id}`}
                                  >
                                    {vulnDisplay.display}
                                  </button>
                                )}
                                {vulnDisplay.count === 0 && vulnDisplay.display}
                              </div>
                              {repo.scanStatus === 'completed' && (
                                <div>
                                  <button
                                    onClick={() => {
                                      // Navigate to scan report - would need to implement navigation
                                      toast({
                                        title: "Scan Report",
                                        description: "Would open detailed scan report for this repository",
                                      });
                                    }}
                                    className="text-xs text-blue-600 hover:underline flex items-center"
                                    data-testid={`button-view-report-${repo.id}`}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View Report
                                  </button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Button
                                onClick={() => handleStartScan(repo.id)}
                                disabled={repo.scanStatus === 'scanning' || repo.scanStatus === 'pending' || startScanMutation.isPending}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title={repo.scanStatus === 'scanning' || repo.scanStatus === 'pending' ? "Scanning..." : "Scan Now"}
                                data-testid={`button-scan-now-${repo.id}`}
                              >
                                {repo.scanStatus === 'scanning' || repo.scanStatus === 'pending' ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                onClick={() => handleEditRepository(repo)}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Edit Repository"
                                data-testid={`button-edit-${repo.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteRepository(repo.id)}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete Repository"
                                data-testid={`button-delete-${repo.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRepositories.length)} of {filteredRepositories.length} repositories
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage <= 1}
                        data-testid="button-previous-page"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Repository Modal */}
      <Dialog open={isAddRepoModalOpen} onOpenChange={setIsAddRepoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Repository</DialogTitle>
            <DialogDescription>
              Add a new repository for PQC vulnerability scanning. Scan will start automatically after adding.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Repository Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="repo-name">Repository Name</Label>
                <Input
                  id="repo-name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-crypto-project"
                  data-testid="input-repo-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={(value: any) => setProvider(value)}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">
                      <div className="flex items-center space-x-2">
                        <Github className="h-4 w-4" />
                        <span>GitHub</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gitlab">
                      <div className="flex items-center space-x-2">
                        <GitBranch className="h-4 w-4" />
                        <span>GitLab</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="bitbucket">Bitbucket</SelectItem>
                    <SelectItem value="local">Local Repository</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <div className="space-y-2">
                <Input
                  id="repo-url"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    setRepoValidationStatus(null);
                    setTimeout(() => validateAndFetchRepoMetadata(e.target.value), 1000);
                  }}
                  placeholder="https://github.com/username/repository"
                  data-testid="input-repo-url"
                />
                {(isValidatingRepo || repoValidationStatus) && (
                  <div className="flex items-center space-x-2 text-xs">
                    {isValidatingRepo && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                    )}
                    <span className={
                      repoValidationStatus?.includes('✓') ? 'text-green-600' :
                      repoValidationStatus?.includes('❌') ? 'text-red-600' :
                      'text-muted-foreground'
                    }>
                      {repoValidationStatus}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the repository"
                data-testid="textarea-description"
              />
            </div>

            {/* Languages */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Programming Languages</Label>
              <div className="grid grid-cols-3 gap-2">
                {availableLanguages.map((language) => (
                  <label key={language} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(language)}
                      onChange={() => handleLanguageToggle(language)}
                      className="rounded border-gray-300"
                      data-testid={`checkbox-language-${language}`}
                    />
                    <span className="text-sm capitalize">{language}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRepoModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddRepository}
              disabled={createRepositoryMutation.isPending || !repoName || !repoUrl}
              data-testid="button-add-repository-confirm"
            >
              {createRepositoryMutation.isPending ? "Adding..." : "Add Repository & Start Scan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}