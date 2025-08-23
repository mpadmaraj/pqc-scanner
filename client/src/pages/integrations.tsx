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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Github, GitlabIcon as Gitlab, Cog, Code, Key, Settings, CheckCircle, AlertCircle, Copy, Eye, EyeOff, FileText, Loader2, RefreshCw, ExternalLink, BookOpen, Terminal } from "lucide-react";
import { Link } from "wouter";

export default function Integrations() {
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | undefined>(undefined);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: instructionsData, isLoading: instructionsLoading } = useQuery<{instructions: string; code: string}>({
    queryKey: ["/api/integrations", selectedIntegration?.id, "instructions"],
    queryFn: () => apiRequest("GET", `/api/integrations/${selectedIntegration?.id}/instructions`),
    enabled: !!selectedIntegration && showInstructions,
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

  const regenerateKeyMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      return await apiRequest("POST", `/api/integrations/${integrationId}/regenerate-key`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "API key regenerated",
        description: "A new API key has been generated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate API key. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRegeneratingKey(null);
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

  const handleRegenerateKey = (integrationId: string) => {
    setRegeneratingKey(integrationId);
    regenerateKeyMutation.mutate(integrationId);
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
        return <Github className="h-6 w-6" />;
      case "gitlab":
        return <Gitlab className="h-6 w-6" />;
      case "jenkins":
        return <Cog className="h-6 w-6" />;
      case "sonarqube":
        return <Code className="h-6 w-6" />;
      case "api_key":
        return <Key className="h-6 w-6" />;
      default:
        return <Settings className="h-6 w-6" />;
    }
  };

  const getStatusBadge = (integration: Integration) => {
    if (!integration.isActive) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    const isHealthy = integration.lastUsed ? true : false;
    return isHealthy ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
        <AlertCircle className="w-3 h-3 mr-1" />
        Enabled
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

  const getIntegrationDescription = (type: string) => {
    switch (type) {
      case "github_actions":
        return "Automate security scans in your GitHub repository workflows";
      case "jenkins":
        return "Integrate PQC scanning into your Jenkins CI/CD pipelines";
      case "sonarqube":
        return "Add quantum cryptography insights to your SonarQube quality gates";
      case "api_key":
        return "Direct API access for custom integrations and automations";
      default:
        return "Configure this integration for your development workflow";
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
        <div className="flex space-x-2">
          <Link href="/developer-portal">
            <Button variant="outline" data-testid="button-developer-portal">
              <Terminal className="h-4 w-4 mr-2" />
              Developer Portal
            </Button>
          </Link>
          <Button variant="outline" asChild>
            <a href="https://docs.pqcscanner.dev" target="_blank" rel="noopener noreferrer" data-testid="button-api-docs">
              <BookOpen className="h-4 w-4 mr-2" />
              API Documentation
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id} className="relative">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {getIntegrationIcon(integration.type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-integration-name-${integration.id}`}>
                      {integration.name}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {getIntegrationDescription(integration.type)}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(integration)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Enable Integration</Label>
                  <p className="text-xs text-muted-foreground">
                    {integration.isActive ? "This integration is currently active" : "Enable to start using this integration"}
                  </p>
                </div>
                <Switch
                  data-testid={`switch-integration-active-${integration.id}`}
                  checked={integration.isActive}
                  onCheckedChange={(checked) => handleToggleIntegration(integration.id, checked)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">API Key</Label>
                  <Button
                    data-testid={`button-regenerate-key-${integration.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateKey(integration.id)}
                    disabled={regeneratingKey === integration.id}
                  >
                    {regeneratingKey === integration.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Regenerate
                  </Button>
                </div>
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
                    onClick={() => setShowApiKey(showApiKey === integration.id ? undefined : integration.id)}
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
                <div className="text-xs text-muted-foreground bg-muted rounded-md p-2">
                  Last used: {new Date(integration.lastUsed).toLocaleDateString()} at {new Date(integration.lastUsed).toLocaleTimeString()}
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
                  Setup Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedIntegration && getIntegrationIcon(selectedIntegration.type)}
              <span>Setup Guide - {selectedIntegration?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Follow these steps to complete the integration setup.
            </DialogDescription>
          </DialogHeader>
          
          {instructionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading setup instructions...
            </div>
          ) : instructionsData ? (
            <Tabs defaultValue="instructions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instructions">Setup Instructions</TabsTrigger>
                <TabsTrigger value="code">Integration Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="instructions" className="space-y-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">{instructionsData?.instructions || 'No instructions available'}</pre>
                </div>
              </TabsContent>
              
              <TabsContent value="code" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Integration Code</h4>
                  <Button
                    data-testid="button-copy-integration-code"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyCode(instructionsData?.code || '')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{instructionsData?.code || 'No code available'}</code>
                </pre>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}