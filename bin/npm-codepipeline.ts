#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NpmCodepipelineStack } from '../lib/npm-codepipeline-stack';

const app = new cdk.App();
new NpmCodepipelineStack(app, "NpmCodepipelineStack", {
  owner: "AustralianBioCommons",
  repo: "seqera-aws-config"
});