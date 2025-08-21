import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { Github, GitlabIcon as Gitlab, Cog, Code, Key, Plus, Settings, CheckCircle, AlertCircle, Copy } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  type: "github_actions" | "jenkins" | "sonarqube" | "api_key";
  isActive: boolean;
  config: {
    enabled: boolean;
    apiKey?: string;
    webhookUrl?: string;
    [key: string]: any;
  };
  lastUsed?: string;
}

export default function Integrations() {
  const [newIntegration, setNewIntegration] = useState({
    name: "",
    type: "github_actions" as const,
    config: { enabled: true }
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["/api/integrations"],
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
        description: "Integration has been successfully configured.",
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
      // This would test the connection based on integration type
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
    
    // This would be determined by actual connection testing
    const isHealthy = true; // Placeholder
    return isHealthy ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge variant="destructive">Error</Badge>
    );
  };

  const integrationTemplates = {
    github_actions: {
      name: "GitHub Actions",
      description: "Integrate PQC scanning into your GitHub CI/CD pipeline",
      fields: [
        { name: "apiKey", label: "API Key", type: "password", required: true },
        { name: "repositoryUrl", label: "Repository URL", type: "text", required: true }
      ]
    },
    jenkins: {
      name: "Jenkins",
      description: "Add PQC scanning to your Jenkins build pipeline",
      fields: [
        { name: "jenkinsUrl", label: "Jenkins URL", type: "text", required: true },
        { name: "username", label: "Username", type: "text", required: true },
        { name: "apiToken", label: "API Token", type: "password", required: true }
      ]
    },
    sonarqube: {
      name: "SonarQube",
      description: "Integrate with SonarQube quality gates",
      fields: [
        { name: "sonarUrl", label: "SonarQube URL", type: "text", required: true },
        { name: "token", label: "Access Token", type: "password", required: true },
        { name: "projectKey", label: "Project Key", type: "text", required: true }
      ]
    },
    api_key: {
      name: "API Access",
      description: "Generate API keys for external integrations",
      fields: [
        { name: "keyName", label: "Key Name", type: "text", required: true },
        { name: "permissions", label: "Permissions", type: "select", options: ["read", "write", "admin"] }
      ]
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground" data-testid="text-page-title">
              Q-Scan Integrations
            </h2>
            <p className="text-sm text-muted-foreground">
              Connect Q-Scan with your development tools and CI/CD pipelines
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-integration">
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Integration</DialogTitle>
                <DialogDescription>
                  Configure a new integration for your development workflow
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="integration-name">Name</Label>
                  <Input
                    id="integration-name"
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                    placeholder="My GitHub Integration"
                    data-testid="input-integration-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="integration-type">Type</Label>
                  <select
                    id="integration-type"
                    value={newIntegration.type}
                    onChange={(e) => setNewIntegration({ ...newIntegration, type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                    data-testid="select-integration-type"
                  >
                    <option value="github_actions">GitHub Actions</option>
                    <option value="jenkins">Jenkins</option>
                    <option value="sonarqube">SonarQube</option>
                    <option value="api_key">API Key</option>
                  </select>
                </div>
                <Button
                  onClick={() => createIntegrationMutation.mutate(newIntegration)}
                  disabled={createIntegrationMutation.isPending || !newIntegration.name}
                  className="w-full"
                  data-testid="button-create-integration"
                >
                  {createIntegrationMutation.isPending ? "Creating..." : "Create Integration"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">Active Integrations</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            <TabsTrigger value="api" data-testid="tab-api">API Documentation</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8">Loading integrations...</div>
            ) : !integrations || integrations.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No Integrations</h3>
                    <p className="text-muted-foreground mb-4">
                      Connect your development tools to automate PQC vulnerability scanning
                    </p>
                    <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-integration">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Integration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map((integration: Integration) => (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-muted rounded-lg">
                            {getIntegrationIcon(integration.type)}
                          </div>
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-integration-name-${integration.id}`}>
                              {integration.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {integration.type.replace("_", " ")}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(integration)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {integration.lastUsed && (
                        <div className="text-sm text-muted-foreground">
                          Last used: {new Date(integration.lastUsed).toLocaleDateString()}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Label htmlFor={`toggle-${integration.id}`} className="text-sm">
                          Enable Integration
                        </Label>
                        <Switch
                          id={`toggle-${integration.id}`}
                          checked={integration.isActive}
                          onCheckedChange={(checked) => handleToggleIntegration(integration.id, checked)}
                          data-testid={`switch-active-${integration.id}`}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(integration)}
                          disabled={testingConnection === integration.id}
                          className="flex-1"
                          data-testid={`button-test-${integration.id}`}
                        >
                          {testingConnection === integration.id ? (
                            <>Testing...</>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-configure-${integration.id}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(integrationTemplates).map(([key, template]) => (
                <Card key={key}>
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-muted rounded-lg">
                        {getIntegrationIcon(key)}
                      </div>
                      <div>
                        <CardTitle data-testid={`text-template-${key}`}>{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-sm font-medium">Configuration:</div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {template.fields.map((field) => (
                          <li key={field.name} data-testid={`text-field-${key}-${field.name}`}>
                            • {field.label} {field.required && "(Required)"}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setNewIntegration({
                            name: template.name,
                            type: key as any,
                            config: { enabled: true }
                          });
                          setIsDialogOpen(true);
                        }}
                        data-testid={`button-use-template-${key}`}
                      >
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Documentation</CardTitle>
                <CardDescription>
                  Use these endpoints to integrate PQC Scanner into your custom workflows
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Start a Scan</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div className="flex items-center justify-between">
                        <span>POST /api/scans</span>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Initiates a new vulnerability scan for a repository
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Get Scan Status</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div className="flex items-center justify-between">
                        <span>GET /api/scans/:id/progress</span>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Get Vulnerabilities</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div className="flex items-center justify-between">
                        <span>GET /api/vulnerabilities</span>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Generate VDR Report</h4>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      <div className="flex items-center justify-between">
                        <span>POST /api/vdr/:vulnerabilityId/generate</span>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Authentication</h4>
                  <p className="text-sm text-muted-foreground">
                    Include your API key in the Authorization header:
                  </p>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm mt-2">
                    Authorization: Bearer YOUR_API_KEY
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
