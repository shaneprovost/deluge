# AWS Setup (from scratch)

You're logged in as **root**. Follow these steps to create IAM users, minimal permissions, and profiles for staging and prod. Use the same account for both environments, or use two accounts (staging + prod) and repeat for the second.

---

## 1. Create an IAM policy for CDK + Deluge

This policy allows deploying the Deluge CDK stack and nothing else (no billing, no other services).

1. In the AWS Console go to **IAM** → **Policies** → **Create policy**.
2. Open the **JSON** tab and replace the default with the policy below.
3. Click **Next**. Name it **`DelugeDeployPolicy`**, add a short description, then **Create policy**.

**Policy JSON:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResource",
        "cloudformation:DescribeStackResources",
        "cloudformation:DescribeEvents",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CDKBoostrapBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:DeleteObject",
        "s3:DeleteBucket",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:PutBucketVersioning",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutEncryptionConfiguration",
        "s3:GetBucketVersioning",
        "s3:PutLifecycleConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:PutBucketTagging",
        "s3:GetBucketTagging"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-hnb659fds-*",
        "arn:aws:s3:::cdk-hnb659fds-*/*"
      ]
    },
    {
      "Sid": "CDKBootstrapECR",
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:SetRepositoryPolicy",
        "ecr:PutLifecyclePolicy",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetAuthorizationToken",
        "ecr:DeleteRepository"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CDKBootstrapSSM",
      "Effect": "Allow",
      "Action": [
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:DeleteParameter"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:UpdateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:ListTables",
        "dynamodb:TagResource",
        "dynamodb:UntagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:CreateEventSourceMapping",
        "lambda:DeleteEventSourceMapping",
        "lambda:GetEventSourceMapping",
        "lambda:ListEventSourceMappings",
        "lambda:TagResource",
        "lambda:UntagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMForLambda",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:GetRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": "arn:aws:iam::*:role/cdk-*"
    },
    {
      "Sid": "SSM",
      "Effect": "Allow",
      "Action": [
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:DeleteParameter",
        "ssm:AddTagsToResource"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/deluge/*"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:PutRetentionPolicy",
        "logs:DescribeLogGroups",
        "logs:DeleteLogGroup"
      ],
      "Resource": "*"
    }
  ]
}
```

**If you already created this policy:** Edit it in IAM → Policies → DelugeDeployPolicy → Edit (JSON) and add the new statements (ChangeSet actions, CDKBootstrapECR, CDKBootstrapSSM) so bootstrap can run.

**If bootstrap failed (ROLLBACK_COMPLETE or ROLLBACK_FAILED):**  
1. In the AWS Console, set region to **us-east-1** (top-right).  
2. **ECR** → Repositories → delete **cdk-hnb659fds-container-assets-678948770847-us-east-1** if it exists.  
3. **CloudFormation** → Stacks → select **CDKToolkit** → **Delete** (if it asks to retain resources, you can retain none).  
4. Update the policy with the latest JSON, then run bootstrap again.

**Note:** The CDK bootstrap bucket name in your account may differ. If the first deploy fails on S3 access, check the error and either update this policy with the actual bucket name (e.g. from the bootstrap stack output) or add a broader `arn:aws:s3:::*-cdk-*` pattern temporarily.

---

## 2. Create IAM users (staging and prod)

Create two users so staging and prod use different credentials.

1. **IAM** → **Users** → **Create user**.
2. **User name:** `deluge-staging`. Do **not** check "Provide user access to the AWS Management Console" (CLI/key-only is enough). Next.
3. **Attach policies directly** → search for **DelugeDeployPolicy** → check it → Next → Create user.
4. Repeat for a second user: **User name:** `deluge-prod`, same policy **DelugeDeployPolicy** → Create user.

---

## 3. Create access keys (what you'll need from AWS)

For **each** user you need an Access Key so the CLI and GitHub can authenticate.

1. **IAM** → **Users** → click **deluge-staging**.
2. **Security credentials** tab → **Access keys** → **Create access key**.
3. Choose **Application running outside AWS** (or "Command Line Interface") → Next → Create access key.
4. **Copy the Access key ID and Secret access key** and store them somewhere safe (e.g. password manager). You won't see the secret again.
5. Repeat for **deluge-prod**.

**You'll need from AWS (you keep these, don't send them to anyone):**

| For     | You'll have                                            |
| ------- | ------------------------------------------------------ |
| Staging | Access key ID + Secret access key for `deluge-staging` |
| Prod    | Access key ID + Secret access key for `deluge-prod`    |

---

## 4. Configure local AWS profiles

On your machine you'll use two profiles so `aws` and `cdk` know which credentials to use.

**4a. Credentials file** (`~/.aws/credentials`):

Create or edit the file and add (replace the placeholder values with the keys from step 3):

```ini
[deluge-staging]
aws_access_key_id = AKIAxxxxxxxxxxxxxxxx
aws_secret_access_key = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

[deluge-prod]
aws_access_key_id = AKIAyyyyyyyyyyyyyyyy
aws_secret_access_key = yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

**4b. Config file** (`~/.aws/config`):

Create or edit the file and add:

```ini
[profile deluge-staging]
region = us-east-1
output = json

[profile deluge-prod]
region = us-east-1
output = json
```

Use a different `region` if you prefer (e.g. `us-east-2`); keep it consistent with CDK and the app.

**Test:**

```bash
aws sts get-caller-identity --profile deluge-staging
aws sts get-caller-identity --profile deluge-prod
```

You should see the correct user ARN for each.

---

## 5. Bootstrap CDK (once per account/region)

CDK needs a one-time bootstrap stack (S3 bucket, roles) per account and region.

From the repo:

```bash
cd infrastructure
npm install
```

Then, for **staging**:

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --profile deluge-staging --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1
npx cdk bootstrap --profile deluge-staging
```

Then for **prod** (same account, so bootstrap is already done; if you use a second account, run again with prod profile):

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --profile deluge-prod --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1
npx cdk bootstrap --profile deluge-prod
```

If you use **one account** for both staging and prod, one bootstrap is enough. Run it once with either profile.

---

## 5b. Allow deluge-staging and deluge-prod to assume CDK bootstrap roles (required for `cdk deploy`)

After bootstrap, `cdk deploy` will fail with "could not be used to assume" or "we dont have access to it" unless your IAM users are allowed to assume the bootstrap roles. **Do this once as root** for every role below.

**Trust statement to add** (add a new statement to each role’s trust policy; keep existing statements):

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": [
      "arn:aws:iam::678948770847:user/deluge-staging",
      "arn:aws:iam::678948770847:user/deluge-prod"
    ]
  },
  "Action": "sts:AssumeRole"
}
```

**Roles to update** (IAM → Roles → open role → Trust relationships → Edit trust policy → add the statement above → Save):

| Role | Purpose | Console link (us-east-1) |
|------|---------|--------------------------|
| **cdk-hnb659fds-deploy-role-678948770847-us-east-1** | CloudFormation / deploy | [Open role](https://us-east-1.console.aws.amazon.com/iam/home#/roles/details/cdk-hnb659fds-deploy-role-678948770847-us-east-1) |
| **cdk-hnb659fds-file-publishing-role-678948770847-us-east-1** | Upload file assets (e.g. Lambda zip) to S3 | [Open role](https://us-east-1.console.aws.amazon.com/iam/home#/roles/details/cdk-hnb659fds-file-publishing-role-678948770847-us-east-1) |
| **cdk-hnb659fds-image-publishing-role-678948770847-us-east-1** | Push container images to ECR | [Open role](https://us-east-1.console.aws.amazon.com/iam/home#/roles/details/cdk-hnb659fds-image-publishing-role-678948770847-us-east-1) |
| **cdk-hnb659fds-lookup-role-678948770847-us-east-1** | Context lookups during synth/deploy | [Open role](https://us-east-1.console.aws.amazon.com/iam/home#/roles/details/cdk-hnb659fds-lookup-role-678948770847-us-east-1) |

If any of these roles don’t exist in your account, skip them (e.g. some bootstrap versions omit the lookup role). After all four (or the ones that exist) have the new trust statement, run:

```bash
cd infrastructure
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --profile deluge-staging --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1
npx cdk deploy --all --require-approval never --context environment=staging --profile deluge-staging
```

---

## 6. Add GitHub Actions secrets

In GitHub: **Repo → Settings → Secrets and variables → Actions** → **New repository secret**.

Add:

| Secret name                     | Value                                           | Used by        |
| ------------------------------- | ----------------------------------------------- | -------------- |
| `STAGING_AWS_ACCESS_KEY_ID`     | Access key ID for `deluge-staging`              | Deploy Staging |
| `STAGING_AWS_SECRET_ACCESS_KEY` | Secret key for `deluge-staging`                 | Deploy Staging |
| `PROD_AWS_ACCESS_KEY_ID`        | Access key ID for `deluge-prod`                 | Deploy Prod    |
| `PROD_AWS_SECRET_ACCESS_KEY`    | Secret key for `deluge-prod`                    | Deploy Prod    |
| `AWS_REGION`                    | `us-east-1` (optional; workflow defaults to it) | Both deploys   |

Optional: `AWS_ACCOUNT_ID` = your 12-digit account ID (from **Support → Account** or `aws sts get-caller-identity`).

---

## 7. Optional: second AWS account for prod

If you later use a **separate account** for prod:

1. Create the same IAM policy and user (`deluge-prod`) in the **prod account**.
2. Create access keys for that user.
3. Put the **prod** keys in GitHub secrets (`PROD_AWS_ACCESS_KEY_ID`, `PROD_AWS_SECRET_ACCESS_KEY`).
4. Run **CDK bootstrap** in the prod account (with the prod profile pointing at that account).

Staging stays in the first account; prod runs in the second.

---

## Checklist

- [ ] Policy **DelugeDeployPolicy** created in IAM.
- [ ] Users **deluge-staging** and **deluge-prod** created with that policy.
- [ ] Access keys created for both users; keys stored safely.
- [ ] `~/.aws/credentials` and `~/.aws/config` set up with `deluge-staging` and `deluge-prod` profiles.
- [ ] `aws sts get-caller-identity --profile deluge-staging` (and prod) succeed.
- [ ] CDK bootstrap run (once per account/region).
- [ ] All four CDK bootstrap roles (deploy, file-publishing, image-publishing, lookup) trust deluge-staging and deluge-prod (see **5b**).
- [ ] GitHub secrets added for staging and prod keys (and optional `AWS_REGION` / `AWS_ACCOUNT_ID`).

After this you can deploy from your machine with:

```bash
cd infrastructure
npx cdk deploy --context environment=staging --profile deluge-staging --require-approval never
npx cdk deploy --context environment=prod --profile deluge-prod --require-approval never
```

And pushes to **staging** / **main** will trigger the deploy workflows in GitHub Actions.
