import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Download, ExternalLink, Shield, ShieldAlert, AlertTriangle, CheckCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface CBOMReportViewProps {
  scanId: string;
  repositoryName: string;
  reportData: any;
}

export default function CBOMReportView({ scanId, repositoryName, reportData }: CBOMReportViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!reportData) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
        <p className="text-muted-foreground">No CBOM report available for this scan</p>
      </div>
    );
  }

  const { repository, summary, compliance, assets, primitives, recommendations } = reportData.content;

  // Prepare data for charts
  const quantumSafetyData = [
    { name: "Quantum Safe", value: summary.quantumSafe, color: "#10b981" },
    { name: "Quantum Vulnerable", value: summary.quantumVulnerable, color: "#ef4444" },
    { name: "Unknown", value: summary.unknown, color: "#6b7280" },
  ].filter(item => item.value > 0);

  const primitivesData = primitives?.map((p: any) => ({
    name: p.name.replace(" ", "\n"),
    count: p.count,
    percentage: p.percentage,
  })) || [];

  // Pagination
  const totalPages = Math.ceil(assets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAssets = assets.slice(startIndex, startIndex + itemsPerPage);

  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'partial':
        return <ShieldAlert className="h-5 w-5 text-amber-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-50';
      case 'partial': return 'text-amber-600 bg-amber-50';
      default: return 'text-red-600 bg-red-50';
    }
  };

  const getQuantumSafetyBadge = (quantumSafe: boolean | null) => {
    if (quantumSafe === true) {
      return <Badge className="bg-green-100 text-green-800">Quantum Safe</Badge>;
    } else if (quantumSafe === false) {
      return <Badge className="bg-red-100 text-red-800">Quantum Vulnerable</Badge>;
    } else {
      return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Cryptographic Bill of Materials (CBOM)
              </CardTitle>
              <CardDescription>
                Repository: {repository.name} • {summary.totalAssets} cryptographic assets found
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download CBOM
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Repository Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Git URL</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm">{repository.url}</p>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Revision</p>
              <p className="text-sm mt-1">main</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Provider</p>
              <p className="text-sm mt-1 capitalize">{repository.provider}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Status */}
      <Card>
        <CardContent className="pt-6">
          <div className={`p-4 rounded-lg border-2 ${getComplianceColor(compliance.status)}`}>
            <div className="flex items-center gap-3">
              {getComplianceIcon(compliance.status)}
              <div>
                <p className="font-semibold">
                  {compliance.status === 'compliant' ? 'Compliant' : 
                   compliance.status === 'partial' ? 'Partially Compliant' : 'Not Compliant'}
                  {' '}- This CBOM {compliance.status === 'compliant' ? 'complies' : 'does not comply'} with the policy "{compliance.policy}".
                </p>
                <p className="text-sm mt-1">{compliance.details}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quantum Safety Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quantum Safety Distribution</CardTitle>
            <CardDescription>{summary.totalAssets} Crypto Assets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={quantumSafetyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {quantumSafetyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm mt-4">
              {quantumSafetyData.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                    <span>{item.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{item.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Crypto Primitives */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crypto Primitives</CardTitle>
            <CardDescription>{primitives?.length || 0} types of crypto assets</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={primitivesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  fontSize={10}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Security Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((rec: string, index: number) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">List of all assets</CardTitle>
              <CardDescription>
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, assets.length)} of {assets.length} items
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cryptographic Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Primitive</TableHead>
                  <TableHead>Quantum Safety</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssets.map((asset: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="font-medium">{asset.name}</div>
                      {asset.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {asset.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.type}</Badge>
                    </TableCell>
                    <TableCell>{asset.primitive}</TableCell>
                    <TableCell>{getQuantumSafetyBadge(asset.quantumSafe)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {asset.location}
                      </code>
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
                Items per page: {itemsPerPage}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  {currentPage} of {totalPages} pages
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}