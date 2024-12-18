# NPM Build Pipeline

Creates a pipeline to build and publishes packages to code artifacts.

## Prerequesites
Codestar github connection in secrets manager named **code-star-connection-arn**

Github PAT in secrets manager named **config-github-token**

**release-please** configured in the source repo

## How to deploy this pipeline

1. Edit `./bin/npm-codepipeline-stack.ts` and your repo name:
```
new NpmCodepipelineStack(app, "NpmCodepipelineStack", {
  owner: "AustralianBioCommons",
  repo: "my-repo-name", //Update this with your repo name
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

2. Add the following environment variables in your terminal
`export CDK_DEFAULT_ACCOUNT=<your-tooling-aws-account-name>`
`CDK_DEFAULT_REGION=<aws-region>`

3. Deploy the pipeline
`cdk deploy NpmCodepipelineStack`
* `npm run build`   compile typescript to js

# npm-codepipeline
