import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simplified API handler that handles specific endpoints needed on Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url: repoUrl } = req.query;
    const requestUrl = req.url || '';

    // Handle temp branches endpoint
    if (requestUrl.includes('/repositories/temp/branches')) {
      if (!repoUrl || typeof repoUrl !== 'string') {
        return res.status(400).json({ error: "Repository URL is required" });
      }

      if (!repoUrl.includes('github.com')) {
        return res.status(400).json({ error: "Branch fetching only supported for GitHub repositories" });
      }

      try {
        // Extract owner and repo from GitHub URL
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/.*)?$/);
        if (!match) {
          return res.status(400).json({ error: "Invalid GitHub repository URL format" });
        }

        const [, owner, repoName] = match;
        const cleanRepoName = repoName.replace(/\.git$/, '');

        // Fetch branches from GitHub API
        const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}/branches`);
        
        if (!githubResponse.ok) {
          if (githubResponse.status === 404) {
            return res.status(404).json({ error: "Repository not found" });
          } else if (githubResponse.status === 403) {
            return res.status(403).json({ error: "Access forbidden - repository may be private" });
          }
          throw new Error(`GitHub API error: ${githubResponse.status}`);
        }

        const branches = await githubResponse.json();
        const branchNames = branches.map((branch: any) => branch.name);

        res.json({ branches: branchNames });
      } catch (error) {
        console.error("Branch fetch error:", error);
        res.status(500).json({ 
          error: "Failed to fetch branches", 
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    // Handle CBOM report downloads
    else if (requestUrl.includes('/cbom-reports/') && (requestUrl.includes('/pdf') || requestUrl.includes('/json'))) {
      // For now, return a message that this feature is only available in development
      res.status(503).json({ 
        error: 'Report downloads are only available in development environment',
        message: 'Please use the local development server to download reports'
      });
    }
    // Handle VDR report downloads
    else if (requestUrl.includes('/vdr-reports/') && (requestUrl.includes('/pdf') || requestUrl.includes('/json'))) {
      // For now, return a message that this feature is only available in development
      res.status(503).json({ 
        error: 'Report downloads are only available in development environment',
        message: 'Please use the local development server to download reports'
      });
    }
    else {
      // For all other API routes, return a basic response
      res.status(404).json({ error: 'API endpoint not implemented in serverless function' });
    }
  } catch (error) {
    console.error('API Handler Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}