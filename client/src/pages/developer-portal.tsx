import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Integration } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Terminal, Play, Copy, Code, BookOpen, Key, ArrowLeft, ExternalLink, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function DeveloperPortal() {
  const [selectedApiKey, setSelectedApiKey] = useState<string>("");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("/api/repositories");
  const [selectedMethod, setSelectedMethod] = useState<string>("GET");
  const [requestBody, setRequestBody] = useState<string>("");
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const testApiMutation = useMutation({
    mutationFn: async ({ endpoint, method, body, apiKey }: { endpoint: string; method: string; body?: string; apiKey: string }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const options: RequestInit = {
        method,
        headers,
      };

      if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
        options.body = body;
      }

      const response = await fetch(endpoint, options);
      const data = await response.json();
      
      return {
        status: response.status,
        statusText: response.statusText,
        data
      };
    },
    onSuccess: (result) => {
      setApiResponse(result);
      toast({
        title: "API request completed",
        description: `Response: ${result.status} ${result.statusText}`,
      });
    },
    onError: (error) => {
      setApiResponse({
        status: 0,
        statusText: "Error",
        data: { error: error.message }
      });
      toast({
        title: "API request failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const endpoints = [
    { path: "/api/repositories", method: "GET", description: "List all repositories" },
    { path: "/api/repositories", method: "POST", description: "Create a new repository", body: `{
  "name": "My Repository",
  "url": "https://github.com/user/repo",
  "provider": "github",
  "description": "Test repository"
}` },
    { path: "/api/scans", method: "GET", description: "List all scans" },
    { path: "/api/scans", method: "POST", description: "Start a new scan", body: `{
  "repositoryId": "your-repo-id",
  "scanConfig": {
    "tools": ["semgrep", "bandit"],
    "languages": ["python", "javascript"]
  }
}` },
    { path: "/api/vulnerabilities", method: "GET", description: "List vulnerabilities" },
    { path: "/api/integrations", method: "GET", description: "List integrations" },
  ];

  const handleTestApi = () => {
    if (!selectedApiKey) {
      toast({
        title: "API key required",
        description: "Please select an API key to test the endpoint.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    testApiMutation.mutate({
      endpoint: selectedEndpoint,
      method: selectedMethod,
      body: requestBody || undefined,
      apiKey: selectedApiKey
    });
  };

  const handleCopyResponse = () => {
    if (apiResponse) {
      navigator.clipboard.writeText(JSON.stringify(apiResponse, null, 2));
      toast({
        title: "Response copied",
        description: "API response has been copied to clipboard.",
      });
    }
  };

  const handleCopyRequest = () => {
    const curlCommand = generateCurlCommand();
    navigator.clipboard.writeText(curlCommand);
    toast({
      title: "cURL command copied",
      description: "cURL command has been copied to clipboard.",
    });
  };

  const generateCurlCommand = () => {
    let curl = `curl -X ${selectedMethod} "${window.location.origin}${selectedEndpoint}"`;
    
    if (selectedApiKey) {
      curl += ` \\\n  -H "Authorization: Bearer ${selectedApiKey}"`;
    }
    
    curl += ` \\\n  -H "Content-Type: application/json"`;
    
    if (requestBody && (selectedMethod === "POST" || selectedMethod === "PATCH" || selectedMethod === "PUT")) {
      curl += ` \\\n  -d '${requestBody}'`;
    }
    
    return curl;
  };

  const handleEndpointSelect = (endpoint: string) => {
    const selected = endpoints.find(e => e.path === endpoint);
    if (selected) {
      setSelectedEndpoint(endpoint);
      setSelectedMethod(selected.method);
      setRequestBody(selected.body || "");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/integrations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Integrations
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-2">
              <Terminal className="h-8 w-8" />
              <span>Developer Portal</span>
            </h1>
            <p className="text-muted-foreground">
              Test PQC Scanner API endpoints with your integration keys
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href="https://docs.pqcscanner.dev" target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-4 w-4 mr-2" />
            Full API Docs
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Testing Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="h-5 w-5" />
              <span>API Testing</span>
            </CardTitle>
            <CardDescription>
              Test API endpoints with your integration keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Select value={selectedApiKey} onValueChange={setSelectedApiKey} data-testid="select-api-key">
                <SelectTrigger>
                  <SelectValue placeholder="Select an integration API key" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.apiKey}>
                      <div className="flex items-center space-x-2">
                        <Key className="h-4 w-4" />
                        <span>{integration.name}</span>
                        {integration.isActive && <Badge variant="outline" className="text-xs">Active</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={selectedMethod} onValueChange={setSelectedMethod} data-testid="select-method">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Endpoint</Label>
                <Select value={selectedEndpoint} onValueChange={handleEndpointSelect} data-testid="select-endpoint">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {endpoints.map((endpoint) => (
                      <SelectItem key={`${endpoint.method}-${endpoint.path}`} value={endpoint.path}>
                        <div className="flex items-center space-x-2">
                          <Badge variant={endpoint.method === "GET" ? "secondary" : "default"} className="text-xs">
                            {endpoint.method}
                          </Badge>
                          <span className="font-mono text-sm">{endpoint.path}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(selectedMethod === "POST" || selectedMethod === "PATCH" || selectedMethod === "PUT") && (
              <div className="space-y-2">
                <Label>Request Body (JSON)</Label>
                <Textarea
                  data-testid="textarea-request-body"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder="Enter JSON request body..."
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
            )}

            <div className="flex space-x-2">
              <Button 
                onClick={handleTestApi} 
                disabled={isLoading || !selectedApiKey}
                data-testid="button-test-api"
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Test API
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCopyRequest} data-testid="button-copy-curl">
                <Copy className="h-4 w-4 mr-2" />
                Copy cURL
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Response</span>
              {apiResponse && (
                <Button variant="ghost" size="sm" onClick={handleCopyResponse} data-testid="button-copy-response">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apiResponse ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={apiResponse.status >= 200 && apiResponse.status < 300 ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {apiResponse.status} {apiResponse.statusText}
                  </Badge>
                  {apiResponse.status >= 200 && apiResponse.status < 300 && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs max-h-96">
                  <code>{JSON.stringify(apiResponse.data, null, 2)}</code>
                </pre>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Run an API test to see the response here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
          <CardDescription>
            Common API usage patterns and examples
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="examples" className="w-full">
            <TabsList>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="authentication">Authentication</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            </TabsList>
            
            <TabsContent value="examples" className="space-y-4">
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">1. Add a Repository</h4>
                  <pre className="text-xs overflow-auto">
{`POST /api/repositories
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "My Project",
  "url": "https://github.com/user/project",
  "provider": "github",
  "description": "Security scanning for my project"
}`}
                  </pre>
                </div>
                
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">2. Start a Security Scan</h4>
                  <pre className="text-xs overflow-auto">
{`POST /api/scans
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "repositoryId": "repo-id-from-step-1",
  "scanConfig": {
    "tools": ["semgrep", "bandit", "pmd"],
    "languages": ["python", "java", "javascript"]
  }
}`}
                  </pre>
                </div>
                
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">3. Get Scan Results</h4>
                  <pre className="text-xs overflow-auto">
{`GET /api/vulnerabilities?scanId=scan-id-from-step-2
Authorization: Bearer YOUR_API_KEY`}
                  </pre>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="authentication" className="space-y-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h4>API Key Authentication</h4>
                <p>All API requests require authentication using your integration API key:</p>
                <pre className="bg-muted p-3 rounded">Authorization: Bearer YOUR_API_KEY</pre>
                
                <h4>Getting Your API Key</h4>
                <ol>
                  <li>Go to the Integrations page</li>
                  <li>Enable the API Integration</li>
                  <li>Copy your API key from the integration card</li>
                  <li>Use it in the Authorization header for all requests</li>
                </ol>
                
                <h4>Security Best Practices</h4>
                <ul>
                  <li>Never commit API keys to version control</li>
                  <li>Store keys securely in environment variables</li>
                  <li>Regenerate keys regularly</li>
                  <li>Use different keys for different environments</li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="endpoints" className="space-y-4">
              <div className="space-y-4">
                {endpoints.map((endpoint, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant={endpoint.method === "GET" ? "secondary" : "default"}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm">{endpoint.path}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}