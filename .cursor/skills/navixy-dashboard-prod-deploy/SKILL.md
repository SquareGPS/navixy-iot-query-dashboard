---
name: navixy-dashboard-prod-deploy
description: >-
  Deploys navixy-datahub-dashboard to production on AWS ECS/Fargate via ECR:
  Docker build (linux/amd64), push images, force ECS service rollout, optional
  logs and db-init task. Use when the user asks to deploy to prod, release,
  push to ECS, update Fargate, or redeploy backend/frontend for this repo.
---

# Production deploy (ECS / ECR)

Authoritative command blocks and URLs live in [DEPLOY.md](../../../DEPLOY.md) at the repo root. Use this skill for the workflow; open `DEPLOY.md` when you need exact one-liners, log group names, or the full `run-task` network configuration.

## Preconditions

- Repo root: `navixy-datahub-dashboard`.
- AWS CLI v2, Docker, and ECR + ECS access for account `761522172628`, region `eu-central-1`.

**Pick the AWS profile for this deploy (target account `761522172628` only):**

1. List saved profiles: `aws configure list-profiles`.
2. Resolve which profile maps to account `761522172628`:
   - Read `~/.aws/config`: under each `[profile <name>]` block, if `sso_account_id = 761522172628`, that `<name>` is valid for this project.
   - If the config does not show `sso_account_id` (e.g. static credentials), run `aws sts get-caller-identity --profile <name>` until `"Account": "761522172628"`.
3. Do not use profiles tied to other accounts (wrong `sso_account_id` or different `Account` from STS).
4. Set `AWS_PROFILE` to the chosen name. If several profiles match the same account, prefer the SSO role you normally use; if still ambiguous, ask the user once.

Export at the start of any deploy session (after choosing the profile):

```bash
export AWS_PROFILE=<profile-for-account-761522172628>
export AWS_REGION=eu-central-1
export AWS_ACCOUNT_ID=761522172628
export ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

## Workflow (always `linux/amd64`)

1. **Auth**
   - If the profile uses SSO and the session expired: `aws sso login --profile $AWS_PROFILE`.
   - `aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY`

2. **Backend** (`./backend`)
   - Build: `docker build --platform linux/amd64 -t navixy-dashboard/backend:latest ./backend`
   - Tag: `docker tag navixy-dashboard/backend:latest $ECR_REGISTRY/navixy-dashboard/backend:latest`
   - Push: `docker push $ECR_REGISTRY/navixy-dashboard/backend:latest`
   - Rollout: `aws ecs update-service --cluster navixy-cluster --service backend --force-new-deployment --region $AWS_REGION`

3. **Frontend** (repo root, ECS Dockerfile)
   - Build: `docker build --platform linux/amd64 -f Dockerfile.frontend.ecs -t navixy-dashboard/frontend:latest .`
   - Tag: `docker tag navixy-dashboard/frontend:latest $ECR_REGISTRY/navixy-dashboard/frontend:latest`
   - Push: `docker push $ECR_REGISTRY/navixy-dashboard/frontend:latest`
   - Rollout: `aws ecs update-service --cluster navixy-cluster --service frontend --force-new-deployment --region $AWS_REGION`

4. **Verify**
   - Service status: `aws ecs describe-services --cluster navixy-cluster --services backend frontend --query 'services[*].[serviceName,runningCount,desiredCount,deployments[0].rolloutState]' --output table --region $AWS_REGION`
   - Logs: see `DEPLOY.md` for `aws logs tail` on `/ecs/navixy-backend` and `/ecs/navixy-frontend`.

5. **PostgreSQL / DB init (only if docs say DB was restarted)**
   - Run the one-off ECS task exactly as in `DEPLOY.md` §6 (task definition, subnets, security group). Do not invent network IDs.

## Agent behavior

- Run commands from the project root unless a step explicitly uses `./backend`.
- Before any `aws` or ECR `docker login`, discover the profile as in **Pick the AWS profile** above, export `AWS_PROFILE` and the other variables; do not assume a fixed profile name.
- Confirm the active identity when helpful: `aws sts get-caller-identity` (with `AWS_PROFILE` set) must show account `761522172628`.
- If no profile matches `761522172628`, or SSO/STS errors persist after `aws sso login`, ask the user which profile to use or to fix credentials.
- If deploy fails, check Docker login, image platform (`amd64`), and ECS `rolloutState`; tail logs per `DEPLOY.md`.
- Do not commit secrets; `DEPLOY.md` may contain example tokens—treat as documentation, not values to reuse blindly.

## App URL

Production load balancer URL is listed in `DEPLOY.md` under **Application URL**.
