# Deployment Guide

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Production Considerations](#production-considerations)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Rollback Procedures](#rollback-procedures)

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test` and `cd backend && npm test`)
- [ ] Code linted (`npm run lint:all`)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates configured (if using HTTPS)
- [ ] Backup strategy in place
- [ ] Monitoring and logging configured
- [ ] Security review completed
- [ ] Performance testing completed
- [ ] Documentation updated

## Environment Configuration

### Production Environment Variables

#### Backend (.env)

```env
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@host:5432/reports_app_db

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS
CORS_ORIGIN=https://yourdomain.com

# External Database (for queries)
EXTERNAL_DB_URL=postgresql://readonly_user:password@data-host:5432/data_db
```

#### Frontend (Build-time)

Create `.env.production`:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Security Checklist

- [ ] Strong JWT secret (use `openssl rand -base64 32`)
- [ ] Database credentials secured
- [ ] Redis password configured (if using password)
- [ ] CORS origins restricted to production domain
- [ ] Rate limiting configured appropriately
- [ ] HTTPS enabled
- [ ] Security headers configured (Helmet)
- [ ] SQL injection prevention verified
- [ ] Input validation enabled

## Docker Deployment

### Docker Compose Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      VITE_API_BASE_URL: ${API_URL}
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

### Backend Dockerfile (Production)

Create `backend/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile (Production)

Create `Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Deployment Steps

1. **Build images**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Start services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Check logs**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

4. **Verify health**
   ```bash
   curl https://api.yourdomain.com/health
   ```

## Manual Deployment

### Backend Deployment

1. **Build backend**
   ```bash
   cd backend
   npm ci --only=production
   npm run build
   ```

2. **Set up process manager** (PM2)
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name sql-report-backend
   pm2 save
   pm2 startup
   ```

3. **Configure reverse proxy** (Nginx)
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Frontend Deployment

1. **Build frontend**
   ```bash
   npm ci
   npm run build
   ```

2. **Deploy to static hosting**
   - **Option 1: Nginx**
     ```bash
     cp -r dist/* /var/www/html/
     ```

   - **Option 2: CDN** (Cloudflare, AWS CloudFront)
     ```bash
     aws s3 sync dist/ s3://your-bucket --delete
     ```

   - **Option 3: Vercel/Netlify**
     ```bash
     vercel --prod
     ```

### Database Setup

1. **Create production database**
   ```bash
   createdb -U postgres reports_app_db
   ```

2. **Run migrations**
   ```bash
   psql -U postgres -d reports_app_db -f init-db.sql
   ```

3. **Set up backups**
   ```bash
   # Daily backup cron job
   0 2 * * * pg_dump -U postgres reports_app_db > /backups/reports_$(date +\%Y\%m\%d).sql
   ```

## Production Considerations

### Performance Optimization

1. **Enable compression**
   - Backend: Already enabled via `compression` middleware
   - Frontend: Configure Nginx gzip

2. **Configure caching**
   - Static assets: Long cache headers
   - API responses: Appropriate cache headers
   - Redis: TTL configuration

3. **Database optimization**
   - Connection pooling configured
   - Indexes on frequently queried columns
   - Query optimization

4. **CDN for static assets**
   - Use CDN for fonts, images
   - Reduce server load

### Security Hardening

1. **HTTPS/SSL**
   ```nginx
   server {
       listen 443 ssl http2;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
   }
   ```

2. **Firewall rules**
   ```bash
   # Allow only necessary ports
   ufw allow 22/tcp   # SSH
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```

3. **Database security**
   - Use read-only user for query database
   - Limit database user permissions
   - Enable SSL for database connections

4. **Application security**
   - Regular security updates
   - Dependency vulnerability scanning
   - Security headers (Helmet)

### Scalability

1. **Horizontal scaling**
   - Load balancer (Nginx, HAProxy)
   - Multiple backend instances
   - Session stickiness (if needed)

2. **Database scaling**
   - Read replicas for query database
   - Connection pooling
   - Query optimization

3. **Caching strategy**
   - Redis cluster for distributed caching
   - CDN for static assets
   - Browser caching

## Monitoring and Maintenance

### Logging

1. **Backend logs**
   - Winston logs to `logs/app.log`
   - Error logs to `logs/app-error.log`
   - Log rotation configured

2. **Application monitoring**
   - PM2 monitoring: `pm2 monit`
   - Health check endpoint: `/health`
   - Uptime monitoring (UptimeRobot, Pingdom)

3. **Error tracking**
   - Sentry integration (recommended)
   - Error logging to centralized system

### Health Checks

1. **Automated health checks**
   ```bash
   # Cron job for health check
   */5 * * * * curl -f https://api.yourdomain.com/health || alert-admin
   ```

2. **Database health**
   ```sql
   SELECT COUNT(*) FROM reports;
   SELECT COUNT(*) FROM sections;
   ```

3. **Redis health**
   ```bash
   redis-cli ping
   ```

### Backup Strategy

1. **Database backups**
   - Daily full backups
   - Weekly retention
   - Monthly archival

2. **Application backups**
   - Configuration files
   - Environment variables (securely stored)
   - SSL certificates

3. **Disaster recovery**
   - Document recovery procedures
   - Test restore procedures regularly
   - Maintain off-site backups

### Updates and Maintenance

1. **Dependency updates**
   ```bash
   npm audit
   npm update
   ```

2. **Security patches**
   - Monitor security advisories
   - Apply patches promptly
   - Test in staging first

3. **Database maintenance**
   ```sql
   -- Vacuum and analyze
   VACUUM ANALYZE;

   -- Check table sizes
   SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

## Rollback Procedures

### Application Rollback

1. **Docker rollback**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d <previous-image>
   ```

2. **PM2 rollback**
   ```bash
   pm2 stop sql-report-backend
   pm2 start <previous-version>
   ```

3. **Git rollback**
   ```bash
   git checkout <previous-tag>
   npm run build
   # Deploy previous build
   ```

### Database Rollback

1. **Migration rollback**
   ```sql
   -- Create rollback migration
   -- Apply rollback
   psql -U postgres -d reports_app_db -f migrations/rollback.sql
   ```

2. **Data restoration**
   ```bash
   # Restore from backup
   psql -U postgres -d reports_app_db < backup.sql
   ```

### Emergency Procedures

1. **Service outage**
   - Check health endpoints
   - Review logs
   - Restart services if needed

2. **Database issues**
   - Check connection pool
   - Review slow queries
   - Restart database if necessary

3. **Security incident**
   - Rotate JWT secret
   - Review access logs
   - Revoke compromised tokens

## Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and approved
- [ ] Tests passing
- [ ] Build successful
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup completed

### Deployment

- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify health checks
- [ ] Test critical paths
- [ ] Monitor logs

### Post-Deployment

- [ ] Verify all features working
- [ ] Check error rates
- [ ] Monitor performance
- [ ] Update documentation
- [ ] Notify team

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)

