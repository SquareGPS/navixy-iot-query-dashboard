#!/bin/bash
# Deployment script for nginx configuration
# This script sets up nginx reverse proxy for dashboard.tools.squaregps.com
# Run this script after deploying the application

set -e

DOMAIN="dashboard.tools.squaregps.com"
NGINX_CONF_DIR="/etc/nginx/conf.d"
NGINX_CONF_FILE="${NGINX_CONF_DIR}/${DOMAIN}.conf"
SSL_CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
HTPASSWD_FILE="/etc/nginx/.htpasswd"

echo "Setting up nginx configuration for ${DOMAIN}..."

# Check if .htpasswd file exists, create if it doesn't
if [ ! -f "$HTPASSWD_FILE" ]; then
    echo "WARNING: Password file ${HTPASSWD_FILE} not found."
    echo "Creating basic auth password file..."
    echo "You can add users later with: sudo htpasswd ${HTPASSWD_FILE} username"
    # Create an empty file - user will need to add credentials
    touch "$HTPASSWD_FILE"
    chmod 644 "$HTPASSWD_FILE"
fi

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

    # Basic Authentication - applies to all paths
    # Use a consistent realm name to help browser cache credentials across routes
    # The realm name "Restricted Access" helps browsers cache credentials for the entire domain
    auth_basic "Restricted Access";
    auth_basic_user_file ${HTPASSWD_FILE};

    # Proxy to frontend container (on port 8080)
    # Note: Basic auth applies to this location and all sub-paths
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
    # Exclude API paths from basic auth - they use JWT Bearer tokens for authentication
    # This fixes Safari issue where fetch() requests don't include basic auth credentials
    location /api {
        auth_basic off;  # Disable basic auth for API endpoints (they use JWT)
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
    # Exclude health check from basic auth for monitoring purposes
    location /health {
        auth_basic off;  # Public health check endpoint
        proxy_pass http://127.0.0.1:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
    
    # Static assets (fonts, images, etc.) - exclude from basic auth
    # Safari doesn't send basic auth with asset requests, causing 401 errors
    location ~* \.(woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|css|js)$ {
        auth_basic off;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
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
echo ""
echo "Basic Authentication:"
echo "  Password file: ${HTPASSWD_FILE}"
echo "  To add a user: sudo htpasswd ${HTPASSWD_FILE} username"
echo "  To change password: sudo htpasswd ${HTPASSWD_FILE} username"
echo "  To remove a user: sudo htpasswd -D ${HTPASSWD_FILE} username"

