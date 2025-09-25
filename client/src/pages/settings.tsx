import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProviderToken, Integration } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Github, GitlabIcon as Gitlab, Settings as SettingsIcon, Plus, Eye, EyeOff, CheckCircle, AlertCircle, Trash2, RefreshCw, ExternalLink, BookOpen, Loader2, Globe, TestTube } from "lucide-react";
import { SiBitbucket } from "react-icons/si";

// External Scanner Integrations Component
function ExternalScannerIntegrations() {
  const [showIntegrationDialog, setShowIntegrationDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingScanner, setEditingScanner] = useState<Integration | null>(null);
  const [integrationName, setIntegrationName] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: externalScanners = [], isLoading: loadingScanners } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    select: (integrations) => integrations?.filter((integration: Integration) => integration.type === "external_scanner") || []
  });

  const addScannerMutation = useMutation({
    mutationFn: async (data: { name: string; config: { scanUrl: string; statusUrl: string; enabled: boolean } }) => {
      return await apiRequest("POST", "/api/integrations", {
        name: data.name,
        type: "external_scanner",
        config: data.config
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setShowIntegrationDialog(false);
      resetForm();
      toast({
        title: "External scanner added",
        description: "Your external scanner integration has been configured successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add external scanner integration.",
        variant: "destructive",
      });
    }
  });

  const updateScannerMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; config: { scanUrl: string; statusUrl: string; enabled: boolean } }) => {
      return await apiRequest("PATCH", `/api/integrations/${data.id}`, {
        name: data.name,
        config: data.config
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setShowEditDialog(false);
      resetForm();
      toast({
        title: "External scanner updated",
        description: "Your external scanner integration has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update external scanner integration.",
        variant: "destructive",
      });
    }
  });

  const deleteScannerMutation = useMutation({
    mutationFn: async (scannerId: string) => {
      return await apiRequest("DELETE", `/api/integrations/${scannerId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "External scanner removed",
        description: "Scanner integration has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove external scanner integration.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setIntegrationName("");
    setScanUrl("");
    setStatusUrl("");
    setEditingScanner(null);
  };

  const handleAddScanner = () => {
    if (!integrationName.trim() || !scanUrl.trim() || !statusUrl.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide integration name, scan URL, and status URL.",
        variant: "destructive",
      });
      return;
    }

    addScannerMutation.mutate({
      name: integrationName.trim(),
      config: {
        scanUrl: scanUrl.trim(),
        statusUrl: statusUrl.trim(),
        enabled: true
      }
    });
  };

  const handleEditScanner = (scanner: Integration) => {
    setEditingScanner(scanner);
    setIntegrationName(scanner.name);
    setScanUrl(scanner.config.scanUrl || "");
    setStatusUrl(scanner.config.statusUrl || "");
    setShowEditDialog(true);
  };

  const handleUpdateScanner = () => {
    if (!editingScanner || !integrationName.trim() || !scanUrl.trim() || !statusUrl.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide integration name, scan URL, and status URL.",
        variant: "destructive",
      });
      return;
    }

    updateScannerMutation.mutate({
      id: editingScanner.id,
      name: integrationName.trim(),
      config: {
        scanUrl: scanUrl.trim(),
        statusUrl: statusUrl.trim(),
        enabled: true
      }
    });
  };

  if (loadingScanners) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Connected External Scanners</h3>
          <p className="text-sm text-muted-foreground">
            External scanning services for additional vulnerability detection
          </p>
        </div>
        <Dialog open={showIntegrationDialog} onOpenChange={setShowIntegrationDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-external-scanner">
              <Plus className="h-4 w-4 mr-2" />
              Add Scanner
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add External Scanner Integration</DialogTitle>
              <DialogDescription>
                Connect an external scanning service to extend vulnerability detection capabilities.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Integration Name</Label>
                <Input
                  data-testid="input-integration-name"
                  type="text"
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                  placeholder="Enter a name for this scanner (e.g., Production Scanner, Dev Scanner)"
                />
              </div>

              <div className="space-y-2">
                <Label>Scan URL</Label>
                <Input
                  data-testid="input-scan-url"
                  type="url"
                  value={scanUrl}
                  onChange={(e) => setScanUrl(e.target.value)}
                  placeholder="https://scanner.example.com/api/v1/scans"
                />
                <p className="text-xs text-muted-foreground">
                  Endpoint that accepts POST requests to trigger scans
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status URL</Label>
                <Input
                  data-testid="input-status-url"
                  type="url"
                  value={statusUrl}
                  onChange={(e) => setStatusUrl(e.target.value)}
                  placeholder="https://scanner.example.com/api/v1/scans/"
                />
                <p className="text-xs text-muted-foreground">
                  Base URL for checking scan status (scan ID will be appended)
                </p>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Expected API Format</h4>
                <div className="text-xs space-y-1">
                  <p><strong>POST Request:</strong> {"{ \"repoUrl\": \"...\", \"tool\": \"both\", \"branch\": \"main\" }"}</p>
                  <p><strong>Response:</strong> {"{ \"status\": \"QUEUED\", \"id\": \"scan-id\" }"}</p>
                  <p><strong>Status Check:</strong> Poll until status becomes "COMPLETED" or "FAILED"</p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowIntegrationDialog(false)}
                  data-testid="button-cancel-scanner"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddScanner}
                  disabled={!integrationName.trim() || !scanUrl.trim() || !statusUrl.trim() || addScannerMutation.isPending}
                  data-testid="button-save-scanner"
                >
                  {addScannerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Add Integration"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Scanner Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit External Scanner Integration</DialogTitle>
              <DialogDescription>
                Update your external scanning service configuration.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Integration Name</Label>
                <Input
                  data-testid="input-edit-integration-name"
                  type="text"
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                  placeholder="Enter a name for this scanner (e.g., Production Scanner, Dev Scanner)"
                />
              </div>

              <div className="space-y-2">
                <Label>Scan URL</Label>
                <Input
                  data-testid="input-edit-scan-url"
                  type="url"
                  value={scanUrl}
                  onChange={(e) => setScanUrl(e.target.value)}
                  placeholder="https://scanner.example.com/api/v1/scans"
                />
                <p className="text-xs text-muted-foreground">
                  Endpoint that accepts POST requests to trigger scans
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status URL</Label>
                <Input
                  data-testid="input-edit-status-url"
                  type="url"
                  value={statusUrl}
                  onChange={(e) => setStatusUrl(e.target.value)}
                  placeholder="https://scanner.example.com/api/v1/scans/"
                />
                <p className="text-xs text-muted-foreground">
                  Base URL for checking scan status (scan ID will be appended)
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowEditDialog(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-edit-scanner"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateScanner}
                  disabled={!integrationName.trim() || !scanUrl.trim() || !statusUrl.trim() || updateScannerMutation.isPending}
                  data-testid="button-save-edit-scanner"
                >
                  {updateScannerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Update Integration"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {externalScanners.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center">
          <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">No External Scanners</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect external scanning services to extend your vulnerability detection capabilities.
          </p>
          <Button onClick={() => setShowIntegrationDialog(true)} variant="outline" data-testid="button-add-first-scanner">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Scanner
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {externalScanners.map((scanner) => (
            <Card key={scanner.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <TestTube className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium" data-testid={`text-scanner-name-${scanner.id}`}>
                        {scanner.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        External Scanner • Added {scanner.createdAt ? new Date(scanner.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={scanner.isActive ? "default" : "secondary"}>
                      {scanner.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditScanner(scanner)}
                      data-testid={`button-edit-scanner-${scanner.id}`}
                    >
                      <SettingsIcon className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid={`button-delete-scanner-${scanner.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove External Scanner</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove this external scanner integration?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete-scanner">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            data-testid="button-confirm-delete-scanner"
                            onClick={() => deleteScannerMutation.mutate(scanner.id)}
                          >
                            Remove Integration
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Scan URL</Label>
                    <p className="text-sm font-mono break-all">{scanner.config.scanUrl || 'Not configured'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status URL</Label>
                    <p className="text-sm font-mono break-all">{scanner.config.statusUrl || 'Not configured'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [tokenValue, setTokenValue] = useState("");
  const [orgAccess, setOrgAccess] = useState("");
  const [showToken, setShowToken] = useState<string | null>(null);
  const [testingToken, setTestingToken] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: providerTokens = [], isLoading } = useQuery<ProviderToken[]>({
    queryKey: ["/api/settings/provider-tokens"],
  });

  const addTokenMutation = useMutation({
    mutationFn: async (data: { name: string; provider: string; accessToken: string; organizationAccess?: string[] }) => {
      return await apiRequest("POST", "/api/settings/provider-tokens", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/provider-tokens"] });
      setShowTokenDialog(false);
      setTokenName("");
      setTokenValue("");
      setOrgAccess("");
      setSelectedProvider("");
      toast({
        title: "Provider token added",
        description: "Your authentication token has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add provider token. Please check your details and try again.",
        variant: "destructive",
      });
    }
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      return await apiRequest("DELETE", `/api/settings/provider-tokens/${tokenId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/provider-tokens"] });
      toast({
        title: "Provider token removed",
        description: "Authentication token has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove provider token.",
        variant: "destructive",
      });
    }
  });

  const testTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      return await apiRequest("POST", `/api/settings/provider-tokens/${tokenId}/test`, {});
    },
    onSuccess: (result) => {
      toast({
        title: "Token test successful",
        description: `Token test completed successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Token test failed",
        description: "Token is invalid or has expired. Please update your token.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTestingToken(null);
    }
  });

  const handleAddToken = () => {
    if (!tokenName.trim() || !selectedProvider || !tokenValue.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a name, select a provider and enter a valid token.",
        variant: "destructive",
      });
      return;
    }

    const organizationAccess = orgAccess.trim() 
      ? orgAccess.split(',').map(org => org.trim()).filter(Boolean)
      : undefined;

    addTokenMutation.mutate({
      name: tokenName.trim(),
      provider: selectedProvider,
      accessToken: tokenValue.trim(),
      organizationAccess
    });
  };

  const handleTestToken = (tokenId: string) => {
    setTestingToken(tokenId);
    testTokenMutation.mutate(tokenId);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "github":
        return <Github className="h-5 w-5" />;
      case "gitlab":
        return <Gitlab className="h-5 w-5" />;
      case "bitbucket":
        return <SiBitbucket size={20} />;
      default:
        return <SettingsIcon className="h-5 w-5" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case "github":
        return "GitHub";
      case "gitlab":
        return "GitLab";
      case "bitbucket":
        return "Bitbucket";
      default:
        return provider;
    }
  };

  const getTokenInstructions = (provider: string) => {
    switch (provider) {
      case "github":
        return {
          title: "GitHub Personal Access Token",
          steps: [
            "Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)",
            "Click 'Generate new token (classic)'",
            "Select scopes: 'repo' (for private repos), 'read:org' (for organization access)",
            "Copy the generated token and paste it below"
          ],
          url: "https://github.com/settings/tokens"
        };
      case "gitlab":
        return {
          title: "GitLab Personal Access Token",
          steps: [
            "Go to GitLab User Settings → Access Tokens",
            "Create a new token with 'read_repository' and 'read_api' scopes",
            "Copy the generated token and paste it below"
          ],
          url: "https://gitlab.com/-/profile/personal_access_tokens"
        };
      case "bitbucket":
        return {
          title: "Bitbucket App Password",
          steps: [
            "Go to Bitbucket Account Settings → App passwords",
            "Create a new app password with 'Repositories: Read' permission",
            "Copy the generated password and paste it below"
          ],
          url: "https://bitbucket.org/account/settings/app-passwords"
        };
      default:
        return {
          title: "Provider Token",
          steps: ["Please refer to your provider's documentation for token generation"],
          url: ""
        };
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your Git provider authentication and application preferences
        </p>
      </div>

      <Tabs defaultValue="providers" className="w-full">
        <TabsList>
          <TabsTrigger value="providers">Git Providers</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="scanner">Scanner</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Git Provider Authentication</h2>
              <p className="text-muted-foreground">
                Add authentication tokens to access private repositories and organizations
              </p>
            </div>
            <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-provider">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Provider
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Git Provider Authentication</DialogTitle>
                  <DialogDescription>
                    Connect your Git provider to access private repositories and organizations.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Provider Name</Label>
                    <Input
                      data-testid="input-provider-name"
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="Enter a name for this provider (e.g., Personal GitHub, Work GitHub)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose a descriptive name to distinguish multiple providers of the same type
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider} data-testid="select-provider">
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Git provider" />
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
                            <Gitlab className="h-4 w-4" />
                            <span>GitLab</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="bitbucket">
                          <div className="flex items-center space-x-2">
                            <SiBitbucket size={16} />
                            <span>Bitbucket</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProvider && (
                    <>
                      <div className="bg-muted p-4 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{getTokenInstructions(selectedProvider).title}</h4>
                          {getTokenInstructions(selectedProvider).url && (
                            <Button variant="outline" size="sm" asChild>
                              <a 
                                href={getTokenInstructions(selectedProvider).url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                data-testid="link-provider-docs"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open
                              </a>
                            </Button>
                          )}
                        </div>
                        <ol className="text-sm space-y-1 list-decimal list-inside">
                          {getTokenInstructions(selectedProvider).steps.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="space-y-2">
                        <Label>Access Token</Label>
                        <Input
                          data-testid="input-access-token"
                          type="password"
                          value={tokenValue}
                          onChange={(e) => setTokenValue(e.target.value)}
                          placeholder="Paste your access token here"
                          className="font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Organization Access (Optional)</Label>
                        <Textarea
                          data-testid="textarea-org-access"
                          value={orgAccess}
                          onChange={(e) => setOrgAccess(e.target.value)}
                          placeholder="Enter organization names separated by commas (e.g., myorg, company)"
                          rows={2}
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to allow access to all organizations your token has permission for
                        </p>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowTokenDialog(false)}
                      data-testid="button-cancel-token"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddToken}
                      disabled={!tokenName.trim() || !selectedProvider || !tokenValue.trim() || addTokenMutation.isPending}
                      data-testid="button-save-token"
                    >
                      {addTokenMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        "Save Token"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {providerTokens.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <SettingsIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Provider Tokens</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Add authentication tokens to access private repositories and enable organization-wide scanning.
                  </p>
                  <Button onClick={() => setShowTokenDialog(true)} data-testid="button-add-first-provider">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Provider
                  </Button>
                </CardContent>
              </Card>
            ) : (
              providerTokens.map((token) => (
                <Card key={token.id}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {getProviderIcon(token.provider)}
                        </div>
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-provider-name-${token.id}`}>
                            {token.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {getProviderName(token.provider)} • Added {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'N/A'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={token.isActive ? "default" : "secondary"}>
                        {token.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Access Token</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          data-testid={`input-token-display-${token.id}`}
                          type={showToken === token.id ? "text" : "password"}
                          value={token.accessToken}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button
                          data-testid={`button-toggle-token-${token.id}`}
                          variant="outline"
                          size="icon"
                          onClick={() => setShowToken(showToken === token.id ? null : token.id)}
                        >
                          {showToken === token.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {token.organizationAccess && token.organizationAccess.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Organization Access</Label>
                        <div className="flex flex-wrap gap-2">
                          {token.organizationAccess.map((org, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {org}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button
                        data-testid={`button-test-token-${token.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestToken(token.id)}
                        disabled={testingToken === token.id}
                        className="flex-1"
                      >
                        {testingToken === token.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Test
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-delete-token-${token.id}`}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Provider Token</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this {getProviderName(token.provider)} token? 
                              This will affect access to private repositories from this provider.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              data-testid="button-confirm-delete"
                              onClick={() => deleteTokenMutation.mutate(token.id)}
                            >
                              Remove Token
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Application Preferences</h2>
            <p className="text-muted-foreground">
              Customize your scanning and notification preferences
            </p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Scanning Preferences</CardTitle>
              <CardDescription>
                Configure default scanning behavior and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Additional preference settings will be available in future updates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scanner" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Scanner Configuration</h2>
            <p className="text-muted-foreground">
              Configure the built-in semgrep scanner and external scanner integrations
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>External Scanner Integrations</CardTitle>
              <CardDescription>
                Connect to external scanning services for additional vulnerability detection capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExternalScannerIntegrations />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Scanner Settings</CardTitle>
              <CardDescription>
                Configure the built-in semgrep scanner for post-quantum cryptography detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxConcurrentScans">Maximum Concurrent Scans</Label>
                  <Input
                    id="maxConcurrentScans"
                    type="number"
                    defaultValue="3"
                    min="1"
                    max="10"
                    data-testid="input-max-concurrent-scans"
                  />
                  <p className="text-sm text-muted-foreground">
                    How many scans can run simultaneously
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scanTimeout">Scan Timeout (minutes)</Label>
                  <Input
                    id="scanTimeout"
                    type="number"
                    defaultValue="5"
                    min="1"
                    max="60"
                    data-testid="input-scan-timeout"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum time before a scan times out
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxFileSize">Maximum File Size (MB)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    defaultValue="10"
                    min="1"
                    max="100"
                    data-testid="input-max-file-size"
                  />
                  <p className="text-sm text-muted-foreground">
                    Files larger than this will be skipped
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Enabled Rule Sets</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="pqc-rules" defaultChecked data-testid="checkbox-pqc-rules" />
                      <Label htmlFor="pqc-rules">Post-Quantum Cryptography Rules</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="weak-crypto" defaultChecked data-testid="checkbox-weak-crypto" />
                      <Label htmlFor="weak-crypto">Weak Cryptographic Algorithms</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="deprecated-hash" defaultChecked data-testid="checkbox-deprecated-hash" />
                      <Label htmlFor="deprecated-hash">Deprecated Hash Functions</Label>
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full" data-testid="button-save-scanner-settings">
                <SettingsIcon className="mr-2 h-4 w-4" />
                Save Scanner Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>External Scanner Integrations</CardTitle>
              <CardDescription>
                Configure third-party security scanners and monitoring tools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Custom Scanner API</h3>
                    <p className="text-sm text-muted-foreground">
                      Integrate with external scanning services via REST API
                    </p>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Planned integrations:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Custom scanner APIs with progress monitoring</li>
                    <li>Third-party vulnerability databases</li>
                    <li>Enterprise security platforms</li>
                    <li>Real-time scanning triggers</li>
                  </ul>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Scanner Performance</h3>
                    <p className="text-sm text-muted-foreground">
                      Monitor scanner performance and resource usage
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-green-600">Status: Running</div>
                    <div className="text-muted-foreground">Queue: 0 pending</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}