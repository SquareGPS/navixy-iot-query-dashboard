#!/bin/bash
# Deployment script for nginx configuration
# This script sets up nginx reverse proxy for dashboard.tools.squaregps.com
# Run this script after deploying the application

set -e

DOMAIN="dashboard.tools.squaregps.com"
NGINX_CONF_DIR="/etc/nginx/conf.d"
NGINX_CONF_FILE="${NGINX_CONF_DIR}/${DOMAIN}.conf"
SSL_CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

echo "Setting up nginx configuration for ${DOMAIN}..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Check if SSL certificate exists
if [ ! -d "$SSL_CERT_DIR" ]; then
    echo "ERROR: SSL certificate not found at ${SSL_CERT_DIR}"
    echo "Please run: sudo certbot certonly --standalone -d ${DOMAIN}"
    exit 1
fi

# Create nginx configuration
cat > "$NGINX_CONF_FILE" << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN};

    # SSL Configuration
    ssl_certificate ${SSL_CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${SSL_CERT_DIR}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to frontend container (on port 8080)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx || systemctl start nginx

# Enable nginx to start on boot
systemctl enable nginx

echo "Nginx configuration deployed successfully!"
echo "Domain: https://${DOMAIN}"
echo "Frontend proxy: http://127.0.0.1:8080"
echo "Backend proxy: http://127.0.0.1:3001"

