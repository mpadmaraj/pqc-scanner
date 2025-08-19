import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Github, GitBranch } from "lucide-react";

interface Scan {
  id: string;
  repositoryId: string;
  status: "pending" | "scanning" | "completed" | "failed";
  progress: number;
  repository?: {
    name: string;
    provider: string;
  };
  scanConfig?: {
    tools: string[];
    languages: string[];
  };
  errorMessage?: string;
}

interface ScanProgressProps {
  scans: Scan[];
}

export default function ScanProgress({ scans }: ScanProgressProps) {
  if (!scans || scans.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No active scans</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scans.map((scan) => (
        <ScanProgressItem key={scan.id} scan={scan} />
      ))}
    </div>
  );
}

function ScanProgressItem({ scan }: { scan: Scan }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scanning":
        return <Badge className="bg-blue-100 text-blue-800">Scanning</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Queue</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEstimatedTime = (progress: number, status: string) => {
    if (status === "pending") return "Pending";
    if (status === "completed") return "Complete";
    if (status === "failed") return "Failed";
    
    if (progress === 0) return "Starting...";
    if (progress >= 100) return "Finalizing...";
    
    // Simple estimation: assume linear progress
    const remainingProgress = 100 - progress;
    const estimatedMinutes = Math.ceil(remainingProgress / 10); // Rough estimate
    return `ETA: ${estimatedMinutes} min`;
  };

  const getProgressDescription = (scan: Scan) => {
    if (scan.status === "pending") {
      const languages = scan.scanConfig?.languages?.join(", ") || "Unknown";
      return `Languages detected: ${languages}`;
    }
    if (scan.status === "failed") {
      return scan.errorMessage || "Scan failed with unknown error";
    }
    if (scan.status === "scanning") {
      return "Analyzing cryptographic libraries...";
    }
    return "Scan complete";
  };

  return (
    <div className="border rounded-lg p-4" data-testid={`scan-progress-${scan.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-3">
          {scan.repository?.provider === "github" && (
            <Github className="h-4 w-4 text-muted-foreground" />
          )}
          {scan.repository?.provider === "gitlab" && (
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium" data-testid={`text-repository-${scan.id}`}>
            {scan.repository?.name || `Repository ${scan.repositoryId}`}
          </span>
          {getStatusBadge(scan.status)}
        </div>
        <span className="text-sm text-muted-foreground" data-testid={`text-progress-${scan.id}`}>
          {scan.status === "scanning" ? `${scan.progress}% complete` : getEstimatedTime(scan.progress, scan.status)}
        </span>
      </div>
      
      {scan.status === "scanning" && (
        <div className="w-full bg-muted rounded-full h-2 mb-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300" 
            style={{ width: `${scan.progress}%` }}
            data-testid={`progress-bar-${scan.id}`}
          />
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span data-testid={`text-status-description-${scan.id}`}>
          {getProgressDescription(scan)}
        </span>
        <span data-testid={`text-eta-${scan.id}`}>
          {getEstimatedTime(scan.progress, scan.status)}
        </span>
      </div>
    </div>
  );
}
