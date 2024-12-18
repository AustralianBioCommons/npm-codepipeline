#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NpmCodepipelineStack } from '../lib/npm-codepipeline-stack';

const app = new cdk.App();
new NpmCodepipelineStack(app, "NpmCodepipelineStack", {
  // Update your repo here:
  owner: "AustralianBioCommons",
  repo: "my-repo-name",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});