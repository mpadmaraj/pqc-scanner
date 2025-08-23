import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Integration } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Github, GitlabIcon as Gitlab, Cog, Code, Key, Plus, Settings, CheckCircle, AlertCircle, Copy, Eye, EyeOff, FileText, Loader2 } from "lucide-react";

export default function Integrations() {
  const [newIntegration, setNewIntegration] = useState({
    name: "",
    type: "github_actions" as const,
    config: { enabled: true }
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: instructionsData, isLoading: instructionsLoading } = useQuery({
    queryKey: ["/api/integrations", selectedIntegration?.id, "instructions"],
    queryFn: () => apiRequest("GET", `/api/integrations/${selectedIntegration?.id}/instructions`),
    enabled: !!selectedIntegration && showInstructions,
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/integrations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsDialogOpen(false);
      setNewIntegration({ name: "", type: "github_actions", config: { enabled: true } });
      toast({
        title: "Integration added",
        description: "Integration has been successfully configured with API key generated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create integration. Please check your configuration.",
        variant: "destructive",
      });
    }
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; config?: any; isActive?: boolean }) => {
      return await apiRequest("PATCH", `/api/integrations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration updated",
        description: "Integration settings have been saved.",
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (integration: Integration) => {
      return await apiRequest("POST", `/api/integrations/${integration.id}/test`, {});
    },
    onSuccess: () => {
      toast({
        title: "Connection successful",
        description: "Integration is working correctly.",
      });
    },
    onError: () => {
      toast({
        title: "Connection failed", 
        description: "Unable to connect to the service. Please check your configuration.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTestingConnection(null);
    }
  });

  const handleTestConnection = (integration: Integration) => {
    setTestingConnection(integration.id);
    testConnectionMutation.mutate(integration);
  };

  const handleToggleIntegration = (id: string, isActive: boolean) => {
    updateIntegrationMutation.mutate({ id, isActive });
  };

  const handleCopyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast({
      title: "API key copied",
      description: "API key has been copied to clipboard.",
    });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied",
      description: "Integration code has been copied to clipboard.",
    });
  };

  const handleShowInstructions = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowInstructions(true);
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case "github_actions":
        return <Github className="h-5 w-5" />;
      case "gitlab":
        return <Gitlab className="h-5 w-5" />;
      case "jenkins":
        return <Cog className="h-5 w-5" />;
      case "sonarqube":
        return <Code className="h-5 w-5" />;
      case "api_key":
        return <Key className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (integration: Integration) => {
    if (!integration.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    const isHealthy = integration.lastUsed ? true : false;
    return isHealthy ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="outline">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Used
      </Badge>
    );
  };

  const getIntegrationType = (type: string) => {
    switch (type) {
      case "github_actions":
        return "GitHub Actions";
      case "gitlab":
        return "GitLab CI";
      case "jenkins":
        return "Jenkins";
      case "sonarqube":
        return "SonarQube";
      case "api_key":
        return "API Key";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect PQC Scanner with your CI/CD pipelines and development tools
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-integration">
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Integration</DialogTitle>
              <DialogDescription>
                Configure a new integration to automate security scanning in your workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Integration Name</Label>
                <Input
                  data-testid="input-integration-name"
                  id="name"
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My GitHub Actions Integration"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Integration Type</Label>
                <select
                  data-testid="select-integration-type"
                  id="type"
                  value={newIntegration.type}
                  onChange={(e) => setNewIntegration(prev => ({ ...prev, type: e.target.value as any }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="github_actions">GitHub Actions</option>
                  <option value="jenkins">Jenkins</option>
                  <option value="sonarqube">SonarQube</option>
                  <option value="api_key">API Key</option>
                </select>
              </div>
              {newIntegration.type === "github_actions" && (
                <div className="grid gap-2">
                  <Label htmlFor="repo-url">Repository URL (Optional)</Label>
                  <Input
                    data-testid="input-repository-url"
                    id="repo-url"
                    placeholder="https://github.com/username/repo"
                    onChange={(e) => setNewIntegration(prev => ({
                      ...prev,
                      config: { ...prev.config, repositoryUrl: e.target.value }
                    }))}
                  />
                </div>
              )}
              {newIntegration.type === "jenkins" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="jenkins-url">Jenkins URL</Label>
                    <Input
                      data-testid="input-jenkins-url"
                      id="jenkins-url"
                      placeholder="https://jenkins.example.com"
                      onChange={(e) => setNewIntegration(prev => ({
                        ...prev,
                        config: { ...prev.config, jenkinsUrl: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      data-testid="input-username"
                      id="username"
                      placeholder="jenkins-user"
                      onChange={(e) => setNewIntegration(prev => ({
                        ...prev,
                        config: { ...prev.config, username: e.target.value }
                      }))}
                    />
                  </div>
                </>
              )}
              {newIntegration.type === "sonarqube" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="sonar-url">SonarQube URL</Label>
                    <Input
                      data-testid="input-sonar-url"
                      id="sonar-url"
                      placeholder="https://sonar.example.com"
                      onChange={(e) => setNewIntegration(prev => ({
                        ...prev,
                        config: { ...prev.config, sonarUrl: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="project-key">Project Key</Label>
                    <Input
                      data-testid="input-project-key"
                      id="project-key"
                      placeholder="my-project-key"
                      onChange={(e) => setNewIntegration(prev => ({
                        ...prev,
                        config: { ...prev.config, projectKey: e.target.value }
                      }))}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                data-testid="button-create-integration"
                onClick={() => createIntegrationMutation.mutate(newIntegration)}
                disabled={!newIntegration.name || createIntegrationMutation.isPending}
              >
                {createIntegrationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create Integration
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.id} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                {getIntegrationIcon(integration.type)}
                <div>
                  <CardTitle className="text-sm font-medium" data-testid={`text-integration-name-${integration.id}`}>
                    {integration.name}
                  </CardTitle>
                  <CardDescription>{getIntegrationType(integration.type)}</CardDescription>
                </div>
              </div>
              {getStatusBadge(integration)}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active</span>
                <Switch
                  data-testid={`switch-integration-active-${integration.id}`}
                  checked={integration.isActive}
                  onCheckedChange={(checked) => handleToggleIntegration(integration.id, checked)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">API Key</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    data-testid={`input-api-key-${integration.id}`}
                    type={showApiKey === integration.id ? "text" : "password"}
                    value={integration.apiKey}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    data-testid={`button-toggle-api-key-${integration.id}`}
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(showApiKey === integration.id ? null : integration.id)}
                  >
                    {showApiKey === integration.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    data-testid={`button-copy-api-key-${integration.id}`}
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyApiKey(integration.apiKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {integration.lastUsed && (
                <div className="text-xs text-muted-foreground">
                  Last used: {new Date(integration.lastUsed).toLocaleDateString()}
                </div>
              )}

              <div className="flex space-x-2">
                <Button
                  data-testid={`button-test-connection-${integration.id}`}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(integration)}
                  disabled={testingConnection === integration.id}
                  className="flex-1"
                >
                  {testingConnection === integration.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test
                </Button>
                <Button
                  data-testid={`button-view-instructions-${integration.id}`}
                  variant="outline"
                  size="sm"
                  onClick={() => handleShowInstructions(integration)}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Instructions
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {integrations.length === 0 && (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No integrations configured</CardTitle>
            <CardDescription>
              Add your first integration to start automating security scans in your development workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedIntegration && getIntegrationIcon(selectedIntegration.type)}
              <span>Integration Instructions - {selectedIntegration?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Follow these steps to complete the integration setup.
            </DialogDescription>
          </DialogHeader>
          
          {instructionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading instructions...
            </div>
          ) : instructionsData ? (
            <Tabs defaultValue="instructions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instructions">Setup Instructions</TabsTrigger>
                <TabsTrigger value="code">Integration Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="instructions" className="space-y-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap text-sm">{instructionsData.instructions}</pre>
                </div>
              </TabsContent>
              
              <TabsContent value="code" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Integration Code</h4>
                  <Button
                    data-testid="button-copy-integration-code"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyCode(instructionsData.code)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{instructionsData.code}</code>
                </pre>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}