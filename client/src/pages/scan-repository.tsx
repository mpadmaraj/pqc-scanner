import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Github, GitBranch, Upload, Search, Play, Settings } from "lucide-react";

export default function ScanRepository() {
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [provider, setProvider] = useState<"github" | "gitlab" | "bitbucket" | "local">("github");
  const [description, setDescription] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>(["semgrep", "bandit"]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [customRules, setCustomRules] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: repositories } = useQuery({
    queryKey: ["/api/repositories"],
  });

  const createRepositoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/repositories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      toast({
        title: "Repository added",
        description: "Repository has been successfully added to the scanner.",
      });
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

  const availableTools = [
    { id: "semgrep", name: "Semgrep", description: "Multi-language static analysis" },
    { id: "bandit", name: "Bandit", description: "Python security analysis" },
    { id: "pmd", name: "PMD", description: "Java/multi-language analysis" },
    { id: "pqc-analyzer", name: "PQC Analyzer", description: "Custom PQC vulnerability patterns" }
  ];

  const availableLanguages = [
    "python", "java", "javascript", "typescript", "c", "cpp", "csharp", "go", "ruby", "php"
  ];

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

  const handleAddRepository = () => {
    if (!repoUrl || !repoName) {
      toast({
        title: "Validation Error",
        description: "Repository URL and name are required.",
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
    if (selectedTools.length === 0) {
      toast({
        title: "Validation Error", 
        description: "Please select at least one scanning tool.",
        variant: "destructive",
      });
      return;
    }

    const scanConfig = {
      tools: selectedTools,
      languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
      customRules: customRules ? customRules.split('\n').filter(r => r.trim()) : undefined,
    };

    startScanMutation.mutate({
      repositoryId,
      scanConfig,
    });
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Scan Repository
            </h2>
            <p className="text-sm text-muted-foreground">
              Add repositories and configure PQC vulnerability scanning
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add New Repository */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Add Repository</span>
              </CardTitle>
              <CardDescription>
                Connect a repository from GitHub, GitLab, or upload local code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <Input
                  id="repo-url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  data-testid="input-repo-url"
                />
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

              <Button
                onClick={handleAddRepository}
                disabled={createRepositoryMutation.isPending}
                className="w-full"
                data-testid="button-add-repository"
              >
                {createRepositoryMutation.isPending ? "Adding..." : "Add Repository"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Scan Configuration */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Scan Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scanning Tools */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Scanning Tools</Label>
                <div className="space-y-3">
                  {availableTools.map((tool) => (
                    <div key={tool.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={tool.id}
                        checked={selectedTools.includes(tool.id)}
                        onCheckedChange={() => handleToolToggle(tool.id)}
                        data-testid={`checkbox-tool-${tool.id}`}
                      />
                      <div className="space-y-1">
                        <Label htmlFor={tool.id} className="text-sm font-medium">
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
                <div className="grid grid-cols-2 gap-2">
                  {availableLanguages.map((language) => (
                    <div key={language} className="flex items-center space-x-2">
                      <Checkbox
                        id={language}
                        checked={selectedLanguages.includes(language)}
                        onCheckedChange={() => handleLanguageToggle(language)}
                        data-testid={`checkbox-language-${language}`}
                      />
                      <Label htmlFor={language} className="text-xs capitalize">
                        {language}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Rules */}
              <div>
                <Label htmlFor="custom-rules" className="text-sm font-medium">
                  Custom Rules (Optional)
                </Label>
                <Textarea
                  id="custom-rules"
                  value={customRules}
                  onChange={(e) => setCustomRules(e.target.value)}
                  placeholder="One rule per line&#10;pqc-crypto-patterns&#10;custom-rsa-detection"
                  className="mt-2 text-xs font-mono"
                  rows={4}
                  data-testid="textarea-custom-rules"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Existing Repositories */}
      <div className="px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Existing Repositories</CardTitle>
            <CardDescription>
              Manage and scan your connected repositories
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!repositories || repositories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No repositories added yet</p>
                <p className="text-sm">Add a repository above to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {repositories.map((repo: any) => (
                  <Card key={repo.id} className="border-2 hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {repo.provider === "github" && <Github className="h-4 w-4 text-muted-foreground" />}
                          {repo.provider === "gitlab" && <GitBranch className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium text-sm" data-testid={`text-repo-name-${repo.id}`}>
                            {repo.name}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {repo.provider}
                        </Badge>
                      </div>

                      {repo.description && (
                        <p className="text-xs text-muted-foreground mb-3" data-testid={`text-repo-description-${repo.id}`}>
                          {repo.description}
                        </p>
                      )}

                      {repo.languages && repo.languages.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {repo.languages.map((lang: string) => (
                            <Badge key={lang} variant="secondary" className="text-xs">
                              {lang}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>Last scan:</span>
                        <span data-testid={`text-last-scan-${repo.id}`}>
                          {repo.lastScanAt ? new Date(repo.lastScanAt).toLocaleDateString() : "Never"}
                        </span>
                      </div>

                      <Button
                        onClick={() => handleStartScan(repo.id)}
                        disabled={startScanMutation.isPending}
                        size="sm"
                        className="w-full"
                        data-testid={`button-scan-${repo.id}`}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Start Scan
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
