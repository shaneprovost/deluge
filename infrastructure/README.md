# Deluge – AWS CDK Infrastructure

This directory contains the AWS CDK app that provisions the Deluge backend: DynamoDB tables, the stream-triggered Lambda for aggregates, and SSM parameters for app config.

## Prerequisites

- **Node.js** 18+ and npm
- **AWS CLI** configured with credentials (`aws configure` or env vars)
- **AWS CDK CLI** (installed via `npm install` in this directory)

## Setup

```bash
cd infrastructure
npm install
npm run build
```

## Bootstrap (first time per account/region)

Deploy the CDK bootstrap stack once per AWS account and region:

```bash
npx cdk bootstrap
# Or for a specific account/region:
npx cdk bootstrap aws://ACCOUNT_ID/REGION
```

## Deploy

- **Dev** (default): `npm run deploy:dev` or `npx cdk deploy --context environment=dev`
- **Staging**: `npm run deploy:staging`
- **Prod**: `npm run deploy:prod`

To deploy without approving changes: `npx cdk deploy --require-approval never` (use with care).

## Useful commands

| Command | Description |
|--------|-------------|
| `npm run synth` | Synthesize CloudFormation templates to `cdk.out/` |
| `npm run diff` | Compare deployed stack with current app |
| `npm run destroy` | Tear down the stack (use with context, e.g. `--context environment=dev`) |

## What gets created

- **DynamoDB**: `deluge-{env}-deceased`, `deluge-{env}-cemeteries`, `deluge-{env}-prayers`, `deluge-{env}-assignment-priority`, `deluge-{env}-rate-limits`
- **Lambda**: `deluge-{env}-update-aggregates` (triggered by prayers table stream)
- **SSM Parameters**: Table names under `/deluge/{env}/tables/*` for app config

## App config (table names)

The app (e.g. Next.js on Vercel) can resolve table names by environment:

1. **CloudFormation outputs** – After deploy, use `aws cloudformation describe-stacks --stack-name DelugeStack-dev` (or the stack name from the deploy output) and read the output values.
2. **SSM Parameter Store** – Table names are stored at:
   - `/deluge/{env}/tables/deceased`
   - `/deluge/{env}/tables/cemeteries`
   - `/deluge/{env}/tables/prayers`
   - `/deluge/{env}/tables/assignment-priority`
   - `/deluge/{env}/tables/rate-limits`

Example (AWS CLI):

```bash
aws ssm get-parameter --name "/deluge/dev/tables/deceased" --query Parameter.Value --output text
```

For Next.js, set env vars at build or runtime from these values, and ensure the deployment has IAM permissions to read DynamoDB (and optionally SSM).

## IAM – DynamoDB data-plane (app & seed)

CDK deploy only needs table-management actions (CreateTable, UpdateTable, etc.). The app and the seed script need **data-plane** actions (PutItem, GetItem, Query, Scan, etc.) on the Deluge tables.

If you use an IAM user (e.g. `deluge-staging`, `deluge-prod`) for both deploy and running the app/seed, add a statement like the one in **`iam-dynamodb-data-policy-snippet.json`** to that user’s policy:

1. Open **IAM → Users → &lt;your-user&gt; → Permissions → Add permissions → Create inline policy** (or edit the existing policy).
2. Add a new statement with the contents of `iam-dynamodb-data-policy-snippet.json` (Sid `DynamoDBData`, Effect Allow, the listed actions, Resource `arn:aws:dynamodb:*:*:table/deluge-*` and `.../table/deluge-*/index/*`).

After saving, the seed command should succeed:

```bash
DYNAMODB_TABLE_PREFIX=deluge-staging AWS_PROFILE=deluge-staging npm run seed
```
