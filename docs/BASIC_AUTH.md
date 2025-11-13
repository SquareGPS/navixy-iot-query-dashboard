# Basic Authentication Configuration

This document describes how to manage basic authentication for the dashboard.

## Overview

Basic authentication is configured at the nginx level (on the EC2 host), not in Docker containers. This ensures:
- Authentication persists across Docker container restarts
- Configuration survives EC2 reboots
- Easy to manage without rebuilding containers

## Configuration Location

- **Nginx Config**: `/etc/nginx/conf.d/dashboard.tools.squaregps.com.conf`
- **Password File**: `/etc/nginx/.htpasswd`

## Managing Users

### Add a New User

```bash
sudo htpasswd /etc/nginx/.htpasswd username
```

You will be prompted to enter and confirm the password.

### Change a User's Password

```bash
sudo htpasswd /etc/nginx/.htpasswd username
```

### Remove a User

```bash
sudo htpasswd -D /etc/nginx/.htpasswd username
```

### List Users

```bash
cat /etc/nginx/.htpasswd
```

Each line contains: `username:encrypted_password`

## Deployment

Basic auth is automatically configured when you run the nginx deployment script:

```bash
sudo ./scripts/deploy-nginx-config.sh
```

The script will:
1. Check if `/etc/nginx/.htpasswd` exists (create empty file if missing)
2. Configure nginx with basic auth directives
3. Reload nginx to apply changes

## Security Notes

1. **Password File Permissions**: The `.htpasswd` file should be readable by nginx (typically `644` permissions, owned by `root`)

2. **HTTPS Required**: Basic auth is configured only for HTTPS (port 443), not HTTP. HTTP requests are redirected to HTTPS.

3. **Password Strength**: Use strong passwords. The `htpasswd` command uses bcrypt encryption by default.

4. **Backup**: Consider backing up the `.htpasswd` file:
   ```bash
   sudo cp /etc/nginx/.htpasswd /etc/nginx/.htpasswd.backup
   ```

## Troubleshooting

### Authentication Not Working

1. Check nginx configuration:
   ```bash
   sudo nginx -t
   ```

2. Verify password file exists and is readable:
   ```bash
   sudo ls -la /etc/nginx/.htpasswd
   ```

3. Check nginx error logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

4. Reload nginx after making changes:
   ```bash
   sudo systemctl reload nginx
   ```

### Password File Missing

If the password file is missing, create it and add a user:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd username
```

The `-c` flag creates a new file. Omit it when adding additional users.

## Disabling Basic Auth

To temporarily disable basic auth, comment out the auth directives in the nginx config:

```nginx
# auth_basic "Restricted Access";
# auth_basic_user_file /etc/nginx/.htpasswd;
```

Then reload nginx:
```bash
sudo systemctl reload nginx
```

To re-enable, uncomment the lines and reload again.

