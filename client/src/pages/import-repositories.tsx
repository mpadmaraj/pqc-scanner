import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Github, GitBranch, Search, Play, ArrowLeft, Building2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { SiBitbucket } from "react-icons/si";
import { GitlabIcon as Gitlab } from "lucide-react";
import type { ProviderToken } from "@shared/schema";
import { Link, useLocation } from "wouter";

export default function ImportRepositories() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for provider/org selection
  const [selectedProviderToken, setSelectedProviderToken] = useState<string>("");
  const [organizationName, setOrganizationName] = useState("");
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // State for repository list
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Query provider tokens
  const { data: providerTokens = [] } = useQuery<ProviderToken[]>({
    queryKey: ["/api/settings/provider-tokens"],
  });

  // Filter repositories based on search
  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredRepositories.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRepositories = filteredRepositories.slice(startIndex, startIndex + pageSize);

  // Load repositories mutation
  const loadRepositoriesMutation = useMutation({
    mutationFn: async ({ providerTokenId, organization }: { providerTokenId: string; organization: string }) => {
      const selectedToken = providerTokens.find(t => t.id === providerTokenId);
      if (!selectedToken) {
        throw new Error("Selected provider token not found");
      }

      const response = await apiRequest("POST", "/api/repositories/fetch-organization", {
        providerTokenId,
        organization
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setRepositories(data.repositories || []);
      setIsLoadingRepos(false);
      toast({
        title: "Repositories loaded",
        description: `Found ${data.repositories?.length || 0} repositories in the organization.`,
      });
    },
    onError: (error: any) => {
      setIsLoadingRepos(false);
      toast({
        title: "Failed to load repositories",
        description: error.message || "An error occurred while fetching repositories.",
        variant: "destructive",
      });
    },
  });

  // Import repositories mutation
  const importRepositoriesMutation = useMutation({
    mutationFn: async (repoIds: string[]) => {
      const selectedToken = providerTokens.find(t => t.id === selectedProviderToken);
      if (!selectedToken) {
        throw new Error("Selected provider token not found");
      }

      const reposToImport = repositories.filter(repo => repoIds.includes(repo.id));
      
      const response = await apiRequest("POST", "/api/repositories/import-bulk", {
        repositories: reposToImport.map(repo => ({
          name: repo.name,
          url: repo.clone_url || repo.ssh_url || repo.html_url,
          provider: selectedToken.provider,
          description: repo.description,
          languages: repo.language ? [repo.language] : [],
          branches: ["main", "master", repo.default_branch].filter(Boolean),
        }))
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      toast({
        title: "Repositories imported",
        description: `Successfully imported ${data.count || selectedRepos.length} repositories.`,
      });
      navigate("/scan-repository");
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "An error occurred while importing repositories.",
        variant: "destructive",
      });
    },
  });

  const handleLoadRepositories = () => {
    if (!selectedProviderToken || !organizationName.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a provider token and enter an organization name.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingRepos(true);
    setRepositories([]);
    setSelectedRepos([]);
    setCurrentPage(1);

    loadRepositoriesMutation.mutate({
      providerTokenId: selectedProviderToken,
      organization: organizationName.trim()
    });
  };

  const handleSelectAll = () => {
    if (selectedRepos.length === paginatedRepositories.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(paginatedRepositories.map(repo => repo.id));
    }
  };

  const handleSelectRepo = (repoId: string) => {
    setSelectedRepos(prev => 
      prev.includes(repoId) 
        ? prev.filter(id => id !== repoId)
        : [...prev, repoId]
    );
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "github": return <Github className="h-4 w-4" />;
      case "gitlab": return <Gitlab className="h-4 w-4" />;
      case "bitbucket": return <SiBitbucket className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/scan-repository">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Repositories
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Import Organization Repositories
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Import repositories from your Git provider organization
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Provider and Organization Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Provider & Organization</CardTitle>
              <CardDescription>
                Choose a configured provider token and enter the organization name
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providerTokens.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    No Provider Tokens Found
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You need to configure provider tokens in Settings before importing repositories.
                  </p>
                  <Link to="/settings">
                    <Button>Go to Settings</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="providerToken">Provider Token</Label>
                      <Select value={selectedProviderToken} onValueChange={setSelectedProviderToken}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider token" />
                        </SelectTrigger>
                        <SelectContent>
                          {providerTokens.map((token) => (
                            <SelectItem key={token.id} value={token.id}>
                              <div className="flex items-center gap-2">
                                {getProviderIcon(token.provider)}
                                <span className="capitalize">{token.provider}</span>
                                <span className="text-muted-foreground">- {token.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organizationName">Organization Name</Label>
                      <Input
                        id="organizationName"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Enter organization or username"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleLoadRepositories();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleLoadRepositories}
                    disabled={!selectedProviderToken || !organizationName.trim() || isLoadingRepos}
                    className="w-full md:w-auto"
                  >
                    {isLoadingRepos ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading Repositories...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Load Repositories
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Repository List */}
          {repositories.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Found Repositories ({filteredRepositories.length})</CardTitle>
                    <CardDescription>
                      Select repositories to import into Q-Scan
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search repositories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRepositories.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                      No repositories found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search terms or check the organization name.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={selectedRepos.length === paginatedRepositories.length}
                                onCheckedChange={handleSelectAll}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                            <TableHead>Repository</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Language</TableHead>
                            <TableHead>Stars</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRepositories.map((repo) => (
                            <TableRow key={repo.id} data-testid={`row-repository-${repo.id}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedRepos.includes(repo.id)}
                                  onCheckedChange={() => handleSelectRepo(repo.id)}
                                  data-testid={`checkbox-repo-${repo.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium" data-testid={`text-repo-name-${repo.id}`}>
                                    {repo.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {repo.full_name}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-md truncate text-sm text-muted-foreground">
                                  {repo.description || "No description"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {repo.language && (
                                  <Badge variant="secondary">{repo.language}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {repo.stargazers_count || 0}
                              </TableCell>
                              <TableCell className="text-sm">
                                {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "Unknown"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredRepositories.length)} of {filteredRepositories.length} repositories
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            data-testid="button-previous-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Import Actions */}
                    {selectedRepos.length > 0 && (
                      <div className="flex items-center justify-between mt-6 p-4 bg-muted rounded-lg">
                        <div className="text-sm">
                          <span className="font-medium">{selectedRepos.length}</span> repositories selected
                        </div>
                        <Button
                          onClick={() => importRepositoriesMutation.mutate(selectedRepos)}
                          disabled={importRepositoriesMutation.isPending}
                          data-testid="button-import-selected"
                        >
                          {importRepositoriesMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Import Selected Repositories
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}