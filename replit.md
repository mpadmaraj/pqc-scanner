# Overview

This is a Post-Quantum Cryptography (PQC) vulnerability scanner web application designed to analyze repositories for cryptographic vulnerabilities and generate compliance reports. The system provides vulnerability scanning, Cryptographic Bill of Materials (CBOM) generation, Vulnerability Disclosure Reports (VDR), and integrations with CI/CD platforms. It's built as a full-stack TypeScript application with React frontend and Express backend, focusing on identifying quantum-vulnerable cryptographic implementations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Routing**: Wouter for client-side routing with pages for dashboard, scanning, history, reports, integrations, and CBOM management
- **State Management**: TanStack Query (React Query) for server state management and API caching
- **Component Structure**: Modular component design with reusable UI components, business logic components (vulnerability tables, scan progress), and page-level components

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with organized route handlers for repositories, scans, vulnerabilities, CBOM reports, VDR reports, and integrations
- **Database Layer**: Abstracted storage interface with implementations for user management, repository operations, scan management, and vulnerability tracking
- **Service Layer**: Dedicated services for scanner operations, CBOM generation, VDR creation, and third-party integrations

## Data Storage
- **Database**: PostgreSQL using Neon serverless database
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **Schema Design**: Comprehensive schema with tables for users, repositories, scans, vulnerabilities, CBOM reports, VDR reports, and integrations
- **Data Types**: Extensive use of PostgreSQL enums for type safety (severity levels, scan statuses, vulnerability statuses, repository providers)

## Authentication & Security
- **Session Management**: Express sessions with PostgreSQL session store using connect-pg-simple
- **Database Security**: Environment-based database connection strings with SSL support
- **Input Validation**: Zod schema validation for API endpoints and form submissions

# Recent Changes

## Vercel Deployment Fix (August 2024)
- **Issue**: Vercel build failing with "Could not resolve entry module client/index.html" error
- **Solution**: Created simplified build script (`vercel-build-simple.js`) that uses existing npm build script with Vercel environment variables
- **Result**: Successful build with files properly placed in `/public` directory for Vercel static serving  
- **Build Process**: Uses standard npm build command with VERCEL=1 environment variable for proper configuration
- **Status**: Ready for production deployment via `vercel --prod`
- **Critical Fix**: Removed client, server, shared from .vercelignore to ensure source files are available during build
- **Routing Fix**: Corrected vercel.json rewrites to serve /index.html for SPA routing instead of /public/index.html

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL database hosting with connection pooling
- **WebSocket Support**: Custom WebSocket implementation for real-time database connections

## Development Tools
- **Vite**: Frontend build tool with React plugin and development server
- **Replit Integration**: Specialized Replit plugins for development environment and error handling
- **TypeScript**: Full TypeScript support across frontend and backend with shared type definitions

## UI Libraries
- **Radix UI**: Complete set of accessible UI primitives for complex components (dialogs, dropdowns, navigation menus, etc.)
- **Tailwind CSS**: Utility-first CSS framework with custom design system configuration
- **Lucide React**: Icon library for consistent iconography throughout the application

## External Integrations
- **GitHub API**: Integration for repository access and GitHub Actions workflow generation
- **Jenkins**: CI/CD pipeline integration with API authentication
- **SonarQube**: Code quality platform integration for vulnerability reporting
- **Git Providers**: Support for GitHub, GitLab, Bitbucket, and local repositories

## Scanning Tools
- **Security Scanners**: Integration framework for multiple security scanning tools (Semgrep, Bandit, and custom PQC-specific analyzers)
- **CBOM Generation**: CycloneDX format support for cryptographic bill of materials
- **VDR Reporting**: Vulnerability Disclosure Report generation in industry-standard formats