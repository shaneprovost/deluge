#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DelugeStack } from '../lib/deluge-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') as string | undefined;
const envName = environment ?? 'dev';

new DelugeStack(app, `DelugeStack-${envName}`, {
  envName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: `Deluge prayer tracking - ${envName} (DynamoDB, Lambda)`,
});
