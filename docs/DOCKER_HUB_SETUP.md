# Docker Hub Configuration Guide

This guide explains how to configure Docker Hub automated builds to tag images as `latest`.

## Current Setup

Docker Hub is building images with commit-specific tags:
- `backend-b3f7dd0` (backend image)
- `frontend-b3f7dd0` (frontend image)

However, the `latest` tag is not being updated automatically.

## Solution: Configure Docker Hub to Tag as `latest`

### Option 1: Configure Docker Hub Automated Builds (Recommended)

1. Go to Docker Hub: https://hub.docker.com/r/dnezhdanov/navixy-dashboard/builds
2. Click on "Build Settings" or edit the automated build
3. For each build configuration (backend and frontend):
   - In the "Tags" section, add `latest` as an additional tag
   - Or configure it to tag as `latest` when building from the `main` branch

### Option 2: Manual Tagging via Docker Hub Web UI

After a successful build:
1. Go to the image repository: https://hub.docker.com/r/dnezhdanov/navixy-dashboard/tags
2. Find the commit-specific tag (e.g., `backend-b3f7dd0`)
3. Click on the tag and select "Tag" or "Create Tag"
4. Create a new tag named `latest` pointing to the same image

### Option 3: Use Docker CLI to Tag and Push

After Docker Hub builds the image, you can manually tag and push:

```bash
# Pull the commit-specific tag
docker pull dnezhdanov/navixy-dashboard:backend-b3f7dd0

# Tag it as latest
docker tag dnezhdanov/navixy-dashboard:backend-b3f7dd0 dnezhdanov/navixy-dashboard:latest

# Push the latest tag
docker push dnezhdanov/navixy-dashboard:latest
```

### Option 4: Configure Build Tags in Docker Hub

In Docker Hub build settings, configure the tag pattern to include `latest`:

**For Backend Build:**
- Source: `/backend`
- Dockerfile: `backend/Dockerfile`
- Tags: `backend-{commit}`, `latest` (when building from main branch)

**For Frontend Build:**
- Source: `/`
- Dockerfile: `Dockerfile.frontend`
- Tags: `frontend-{commit}`, `frontend-latest` (when building from main branch)

**Note:** If you want a single `latest` tag for backend, you may need separate repositories or build configurations.

## Recommended Approach

For best practices with a single `latest` tag:

1. **Separate Repositories** (Recommended):
   - `dnezhdanov/navixy-dashboard-backend` → tags as `latest`
   - `dnezhdanov/navixy-dashboard-frontend` → tags as `latest`

2. **Single Repository with Multiple Tags**:
   - Configure Docker Hub to tag backend builds as `backend-latest`
   - Configure Docker Hub to tag frontend builds as `frontend-latest`
   - Update `docker-compose.yml` to use `backend-latest` and `frontend-latest`

3. **Manual Tagging Script**:
   - Create a script that runs after Docker Hub builds complete
   - Script pulls the commit-specific tag and re-tags as `latest`
   - Pushes the `latest` tag back to Docker Hub

## Current docker-compose.yml Configuration

The `docker-compose.yml` uses:
- Backend: `dnezhdanov/navixy-dashboard:latest`
- Frontend: `dnezhdanov/navixy-dashboard:frontend-latest`

Ensure Docker Hub is configured to update these tags on each build.

