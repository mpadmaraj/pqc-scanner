export class GitHubAPIService {
  private baseUrl = 'https://api.github.com';

  async fetchRepositoryBranches(repoUrl: string, token?: string): Promise<string[]> {
    try {
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub repository URL');
      }

      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, ''); // Remove .git suffix if present

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Q-Scan-PQC-Scanner'
      };

      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/repos/${owner}/${cleanRepo}/branches`, {
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Invalid or missing GitHub token');
        }
        if (response.status === 404) {
          throw new Error('Repository not found or not accessible');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const branches = await response.json();
      return branches.map((branch: any) => branch.name);
    } catch (error) {
      console.error('Error fetching GitHub branches:', error);
      throw error;
    }
  }

  async validateRepositoryAccess(repoUrl: string, token?: string): Promise<boolean> {
    try {
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return false;
      }

      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Q-Scan-PQC-Scanner'
      };

      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/repos/${owner}/${cleanRepo}`, {
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating repository access:', error);
      return false;
    }
  }
}

export const githubAPI = new GitHubAPIService();