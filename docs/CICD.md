# CI/CD and GitHub Setup

This doc covers the GitHub repo layout, CI checks, deploy pipelines, and how to configure branch protection so merges require passing CI.

## Branch model

- **main** – production branch; deploys to the **prod** AWS environment (CDK `environment=prod`). Protect this branch and require CI before merge.
- **staging** – deploys to the **staging** AWS environment (CDK `environment=staging`).

Typical flow: merge into `staging` → pipeline deploys to staging; when ready, merge `staging` into `main` → pipeline deploys to prod.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Pull requests and pushes to `main`, `staging` | Runs lint and build. Use as the required status check for branch protection. |
| **Deploy Staging** | Push to `staging` | Deploys CDK stack to staging (uses staging AWS credentials). |
| **Deploy Prod** | Push to `main` | Deploys CDK stack to prod (uses prod AWS credentials). |

## GitHub Secrets

Add these in **Settings → Secrets and variables → Actions** (repository secrets).

### Used by both deploy workflows

| Secret | Required | Description |
|--------|----------|-------------|
| `AWS_REGION` | No (defaults to `us-east-1`) | Region for CDK deploy. |
| `AWS_ACCOUNT_ID` | Optional | AWS account ID. CDK can infer from credentials if not set. |

### Staging deploy only

| Secret | Description |
|--------|-------------|
| `STAGING_AWS_ACCESS_KEY_ID` | IAM access key for the staging AWS user/role. |
| `STAGING_AWS_SECRET_ACCESS_KEY` | Secret key for the staging AWS user/role. |

### Prod deploy only

| Secret | Description |
|--------|-------------|
| `PROD_AWS_ACCESS_KEY_ID` | IAM access key for the prod AWS user/role. |
| `PROD_AWS_SECRET_ACCESS_KEY` | Secret key for the prod AWS user/role. |

Use separate IAM users (or roles) for staging and prod so each pipeline only has access to its environment.

## Require CI before merge (branch protection)

1. Go to **Settings → Branches**.
2. Add a **Branch protection rule** for:
   - **Branch name pattern:** `main` (production – strongly recommended).
   - **Branch name pattern:** `staging`.
3. Enable:
   - **Require a pull request before merging** (optional but recommended).
   - **Require status checks to pass before merging**.
   - In “Status checks that are required,” add: **`Lint & Build`** (or the exact job name from the CI workflow; it appears after the first run).
4. Save.

After this, GitHub will block merging until the **CI** workflow (the “Lint & Build” job) succeeds on that branch.

## First-time setup

1. Create the repo and push `main` with the code.
2. Create the `staging` branch (e.g. `git checkout -b staging && git push -u origin staging`).
3. Add the secrets above.
4. Configure branch protection for `main` and `staging` with the “Lint & Build” status check.
5. Bootstrap CDK once per account/region (e.g. run `npx cdk bootstrap` locally with the staging profile, then with the prod profile).
6. Merge (or push) to `staging` to trigger the first staging deploy; merge to `main` when you want to deploy to prod.

## Optional: GitHub Environments

For prod you can use **Environments** (Settings → Environments → New environment, e.g. `prod`) and add **Required reviewers** or **Wait timer** so prod deploys only after approval or a delay. The Deploy Prod workflow would then reference the environment with `environment: prod` in the deploy job to use that environment’s protection rules.
