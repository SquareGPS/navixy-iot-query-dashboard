# Deployment Guide

This guide covers deploying the Navixy IoT Query Dashboard to production on EC2.

## Prerequisites

- EC2 instance with Docker and Docker Compose installed
- Domain name configured (e.g., `dashboard.tools.squaregps.com`)
- SSL certificate from Let's Encrypt
- Nginx installed on the host system

## Architecture

The production deployment uses:
- **Host Nginx**: Handles SSL termination and reverse proxy (ports 80/443)
- **Docker Containers**: 
  - Frontend container on port 8080 (mapped from container port 80)
  - Backend container on port 3001
  - PostgreSQL on port 5432
  - Redis on port 6379

## Deployment Steps

### 1. Clone and Setup Repository

```bash
cd /home/ec2-user
git clone https://github.com/SquareGPS/navixy-iot-query-dashboard.git
cd navixy-iot-query-dashboard
```

### 2. Configure Environment Variables

Copy and configure environment files:

```bash
cp backend/env.example backend/.env
# Edit backend/.env with your configuration
```

### 3. Setup SSL Certificate (if not already done)

```bash
sudo certbot certonly --standalone -d dashboard.tools.squaregps.com
```

### 4. Deploy Nginx Configuration

Run the nginx deployment script:

```bash
sudo ./scripts/deploy-nginx-config.sh
```

This script:
- Creates nginx configuration for the domain
- Sets up SSL/TLS
- Configures reverse proxy to Docker containers
- Enables nginx to start on boot

### 5. Deploy Docker Containers

Pull latest images and start containers:

```bash
docker pull squaregps/navixy-iot-query-dashboard:backend-latest
docker pull squaregps/navixy-iot-query-dashboard:frontend-latest

docker-compose --profile production up -d
```

### 6. Verify Deployment

- Check containers are running: `docker ps`
- Check nginx status: `sudo systemctl status nginx`
- Test domain: `curl -I https://dashboard.tools.squaregps.com`
- Test backend: `curl http://localhost:3001/health`

## Port Configuration

**Important**: The frontend container maps to port **8080** (not 80) to allow host nginx to bind to ports 80/443.

```yaml
frontend:
  ports:
    - "8080:80"  # Host:Container
```

This is configured in `docker-compose.yml` and should not be changed unless you understand the implications.

## Nginx Configuration Persistence

The nginx configuration is stored at:
- `/etc/nginx/conf.d/dashboard.tools.squaregps.com.conf`

This file persists across reboots and redeployments. To update it:

```bash
sudo ./scripts/deploy-nginx-config.sh
```

## Troubleshooting

### Nginx won't start - Port 80 already in use

Check what's using port 80:
```bash
sudo lsof -i :80
```

If Docker is using it, ensure the frontend container is mapped to port 8080:
```bash
docker-compose ps | grep frontend
```

### Domain not accessible

1. Check DNS: `dig dashboard.tools.squaregps.com`
2. Check nginx: `sudo nginx -t`
3. Check containers: `docker ps`
4. Check logs: `sudo journalctl -u nginx -n 50`

### SSL Certificate Issues

Renew certificate:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Automated Deployment

For CI/CD, you can create a deployment script that:

1. Pulls latest code
2. Pulls latest Docker images
3. Restarts containers
4. Verifies deployment

Example:
```bash
#!/bin/bash
set -e
cd /home/ec2-user/navixy-iot-query-dashboard
git pull origin main
docker-compose pull
docker-compose --profile production up -d
# Verify deployment
```

## Post-Deployment Checklist

- [ ] All containers running (`docker ps`)
- [ ] Nginx running (`sudo systemctl status nginx`)
- [ ] Domain accessible via HTTPS
- [ ] Backend health check passes
- [ ] Frontend loads correctly
- [ ] SSL certificate valid and auto-renewal configured

## Maintenance

### Updating the Application

1. Pull latest code: `git pull origin main`
2. Pull latest images: `docker-compose pull`
3. Restart containers: `docker-compose --profile production up -d`
4. Verify: Check domain and health endpoints

### Updating Nginx Configuration

Run the deployment script:
```bash
sudo ./scripts/deploy-nginx-config.sh
```

### Viewing Logs

- Frontend: `docker-compose logs frontend`
- Backend: `docker-compose logs backend`
- Nginx: `sudo journalctl -u nginx -f`
