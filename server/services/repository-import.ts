import { storage } from "../storage";
import type { ProviderToken } from "@shared/schema";

export interface GitRepository {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  updatedAt: string;
}

export interface OrganizationScanResult {
  provider: string;
  organization: string;
  repositories: GitRepository[];
  totalFound: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export class RepositoryImportService {
  async scanOrganization(userId: string, provider: string, organization: string): Promise<OrganizationScanResult> {
    const token = await storage.getProviderTokenByProvider(userId, provider);
    if (!token) {
      throw new Error(`No ${provider} token found for user`);
    }

    const repositories = await this.fetchRepositoriesFromProvider(token, organization);
    const result = await this.importRepositories(repositories, token);

    return {
      provider,
      organization,
      repositories,
      totalFound: repositories.length,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors
    };
  }

  async rescanAllProviders(userId: string): Promise<OrganizationScanResult[]> {
    const tokens = await storage.getProviderTokens(userId);
    const results: OrganizationScanResult[] = [];

    for (const token of tokens) {
      if (!token.isActive || !token.organizationAccess) continue;

      for (const org of token.organizationAccess) {
        try {
          const result = await this.scanOrganization(userId, token.provider, org);
          results.push(result);
        } catch (error) {
          results.push({
            provider: token.provider,
            organization: org,
            repositories: [],
            totalFound: 0,
            imported: 0,
            skipped: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          });
        }
      }
    }

    return results;
  }

  private async fetchRepositoriesFromProvider(token: ProviderToken, organization: string): Promise<GitRepository[]> {
    switch (token.provider) {
      case "github":
        return await this.fetchGitHubRepositories(token, organization);
      case "gitlab":
        return await this.fetchGitLabRepositories(token, organization);
      case "bitbucket":
        return await this.fetchBitbucketRepositories(token, organization);
      default:
        throw new Error(`Unsupported provider: ${token.provider}`);
    }
  }

  private async fetchGitHubRepositories(token: ProviderToken, organization: string): Promise<GitRepository[]> {
    const repositories: GitRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/orgs/${organization}/repos?page=${page}&per_page=${perPage}&sort=updated`,
        {
          headers: {
            "Authorization": `Bearer ${token.accessToken}`,
            "Accept": "application/vnd.github.v3+json"
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Organization '${organization}' not found or not accessible`);
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const repos = await response.json();
      if (repos.length === 0) break;

      repositories.push(...repos.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        url: repo.clone_url,
        description: repo.description,
        language: repo.language,
        isPrivate: repo.private,
        updatedAt: repo.updated_at
      })));

      if (repos.length < perPage) break;
      page++;
    }

    return repositories;
  }

  private async fetchGitLabRepositories(token: ProviderToken, organization: string): Promise<GitRepository[]> {
    const repositories: GitRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://gitlab.com/api/v4/groups/${organization}/projects?page=${page}&per_page=${perPage}&order_by=updated_at`,
        {
          headers: {
            "Authorization": `Bearer ${token.accessToken}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Group '${organization}' not found or not accessible`);
        }
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
      }

      const repos = await response.json();
      if (repos.length === 0) break;

      repositories.push(...repos.map((repo: any) => ({
        name: repo.name,
        fullName: repo.path_with_namespace,
        url: repo.http_url_to_repo,
        description: repo.description,
        language: null, // GitLab doesn't provide primary language in this endpoint
        isPrivate: repo.visibility === "private",
        updatedAt: repo.last_activity_at
      })));

      if (repos.length < perPage) break;
      page++;
    }

    return repositories;
  }

  private async fetchBitbucketRepositories(token: ProviderToken, organization: string): Promise<GitRepository[]> {
    const repositories: GitRepository[] = [];
    let nextUrl = `https://api.bitbucket.org/2.0/repositories/${organization}?pagelen=100&sort=-updated_on`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Workspace '${organization}' not found or not accessible`);
        }
        throw new Error(`Bitbucket API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      repositories.push(...data.values.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        url: repo.links.clone.find((link: any) => link.name === "https")?.href || repo.links.clone[0]?.href,
        description: repo.description,
        language: repo.language,
        isPrivate: repo.is_private,
        updatedAt: repo.updated_on
      })));

      nextUrl = data.next;
    }

    return repositories;
  }

  private async importRepositories(repositories: GitRepository[], token: ProviderToken) {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const repo of repositories) {
      try {
        // Check if repository already exists
        const existingRepos = await storage.getRepositories();
        const exists = existingRepos.some(existing => 
          existing.url === repo.url || existing.name === repo.name
        );

        if (exists) {
          skipped++;
          continue;
        }

        // Import the repository
        await storage.createRepository({
          name: repo.name,
          url: repo.url,
          provider: token.provider as any,
          description: repo.description || `${repo.isPrivate ? 'Private' : 'Public'} repository from ${token.provider}`,
          languages: repo.language ? [repo.language] : []
        });

        imported++;
      } catch (error) {
        errors.push(`Failed to import ${repo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, skipped, errors };
  }
}

export const repositoryImportService = new RepositoryImportService();