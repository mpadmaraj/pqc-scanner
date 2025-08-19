# PQC Scanner Deployment Guide

This guide provides multiple deployment options for the Post-Quantum Cryptography Vulnerability Scanner.

## Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Clone the repository
git clone <your-repo-url>
cd pqc-scanner

# Deploy with Docker Compose
chmod +x deploy.sh
./deploy.sh docker
```

### Option 2: Vercel (Serverless)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
./deploy.sh vercel

# Set up database (use Neon, Supabase, or AWS RDS)
# Configure environment variables in Vercel dashboard
```

### Option 3: AWS (Production)
```bash
# Install Terraform and AWS CLI
# Configure AWS credentials: aws configure

# Deploy to AWS
./deploy.sh aws
```

## Deployment Options

### 1. Docker Compose Deployment

**Best for:** Development, testing, single-server production

**Requirements:**
- Docker
- Docker Compose

**Features:**
- PostgreSQL database included
- Nginx reverse proxy
- Auto-scaling ready
- Health checks
- Log aggregation

**Usage:**
```bash
# Quick deployment
./deploy.sh docker

# Custom configuration
POSTGRES_PASSWORD=mypassword SESSION_SECRET=mysecret ./deploy.sh docker

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 2. Vercel Deployment

**Best for:** Serverless deployment, quick prototypes

**Requirements:**
- Vercel account
- External PostgreSQL database (Neon, Supabase, AWS RDS)

**Setup:**
1. Deploy the application:
   ```bash
   ./deploy.sh vercel
   ```

2. Set up database (choose one):
   - **Neon** (recommended): https://neon.tech
   - **Supabase**: https://supabase.com
   - **AWS RDS**: Use Terraform script in `/terraform`

3. Configure environment variables in Vercel dashboard:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   SESSION_SECRET=your-secret-key
   NODE_ENV=production
   ```

4. Run database migrations:
   ```bash
   # Locally with DATABASE_URL set
   npm run db:push
   ```

### 3. AWS Deployment (Full Infrastructure)

**Best for:** Production deployments, enterprise use

**Infrastructure included:**
- VPC with public/private subnets
- Application Load Balancer
- ECS Fargate containers
- RDS PostgreSQL database
- Auto-scaling groups
- CloudWatch monitoring

**Setup:**
```bash
# Configure AWS credentials
aws configure

# Deploy infrastructure
./deploy.sh aws

# Get connection details
cd terraform
terraform output
```

### 4. Local Development

**Setup:**
```bash
# Set up local environment
./deploy.sh local

# Start development server
npm run dev
```

## Environment Variables

### Required Variables
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=your-super-secure-session-secret
NODE_ENV=production
```

### Optional Variables
```bash
# GitHub integration
GITHUB_TOKEN=ghp_your_github_token

# SonarQube integration
SONARQUBE_TOKEN=your_sonarqube_token

# Jenkins integration
JENKINS_URL=https://your-jenkins.com
JENKINS_TOKEN=your_jenkins_token
```

## Database Setup

### Using Docker Compose
Database is automatically set up with the application.

### Using External Database

1. **Neon (Recommended for Vercel)**:
   ```bash
   # Create account at https://neon.tech
   # Create database
   # Copy connection string to DATABASE_URL
   ```

2. **AWS RDS**:
   ```bash
   # Included in Terraform deployment
   # Or create manually in AWS console
   ```

3. **Local PostgreSQL**:
   ```bash
   # Install PostgreSQL
   createdb pqc_scanner
   
   # Set DATABASE_URL
   export DATABASE_URL=postgresql://postgres:password@localhost:5432/pqc_scanner
   ```

## Monitoring and Logs

### Docker Compose
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f pqc-scanner
docker-compose logs -f postgres

# Monitor resource usage
docker stats
```

### AWS Deployment
- CloudWatch logs and metrics
- Application Load Balancer access logs
- ECS service logs

### Vercel Deployment
- Vercel function logs
- Edge network monitoring
- Real-time logs in dashboard

## Scaling

### Docker Compose
```yaml
# In docker-compose.yml
pqc-scanner:
  deploy:
    replicas: 3
```

### AWS
- Auto-scaling groups configured
- Load balancer distributes traffic
- Database read replicas for high load

### Vercel
- Automatic serverless scaling
- Global edge network
- No configuration required

## Security Considerations

### Production Checklist
- [ ] Use strong, unique passwords
- [ ] Enable SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable monitoring and alerting
- [ ] Update dependencies regularly
- [ ] Use secrets management
- [ ] Enable audit logging

### SSL Certificate Setup
```bash
# For Docker Compose with Let's Encrypt
# Add to docker-compose.yml:
certbot:
  image: certbot/certbot
  volumes:
    - ./ssl:/etc/letsencrypt
  command: certonly --webroot --webroot-path=/var/www/certbot --email your@email.com --agree-tos --no-eff-email -d your-domain.com
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database status
   docker-compose exec postgres pg_isready -U pqc_user
   
   # Check connection string
   echo $DATABASE_URL
   ```

2. **Application Won't Start**
   ```bash
   # Check logs
   docker-compose logs pqc-scanner
   
   # Check environment variables
   docker-compose exec pqc-scanner env
   ```

3. **Vercel Build Failed**
   ```bash
   # Check build logs in Vercel dashboard
   # Ensure all dependencies are in package.json
   # Check Node.js version compatibility
   ```

### Health Checks

```bash
# Application health
curl http://localhost:5000/api/health

# Database health
curl http://localhost:5000/api/dashboard/stats
```

## Support

For issues and questions:
1. Check the logs first
2. Review environment variables
3. Verify database connectivity
4. Check firewall and security group settings
5. Create an issue in the repository

## Cost Estimation

### Docker Compose (Self-hosted)
- Server: $5-50/month (depending on size)
- Storage: $1-10/month
- **Total: $6-60/month**

### Vercel + Neon
- Vercel Pro: $20/month
- Neon Pro: $19/month
- **Total: ~$39/month**

### AWS (Small deployment)
- ECS Fargate: $15-30/month
- RDS t3.micro: $15/month
- Load Balancer: $18/month
- **Total: ~$50-65/month**