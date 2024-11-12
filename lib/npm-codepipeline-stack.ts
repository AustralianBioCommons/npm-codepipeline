import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class NpmCodepipelineStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Retrieve GitHub token and CodeStar connection ARN from Secrets Manager
    const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GithubToken",
      "config-github-token"
    );
    const codestarConnectionArnSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "CodeStarConnectionArn",
      "code-star-connection-arn"
    );

    //Update these
    const repo = 'gen3-aws-config';
    const owner = 'AustralianBioCommons';

    // Source action: Connect to GitHub using CodeStar connection
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction =
      new codepipelineActions.CodeStarConnectionsSourceAction({
        actionName: "GitHub_Source",
        owner,
        repo,
        branch: "main",
        output: sourceOutput,
        codeBuildCloneOutput: true,
        // We can expose connection arn
        connectionArn: codestarConnectionArnSecret.secretValue.unsafeUnwrap(),
        triggerOnPush: true,
      });

    // CodeBuild project: Build and publish to CodeArtifact
    const buildProject = new codebuild.PipelineProject(this, "BuildProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        environmentVariables: {
          GITHUB_TOKEN: {
            type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
            value:
              githubTokenSecret.secretFullArn || githubTokenSecret.secretArn,
          },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: [
              'git config --global codepipeline.biocommons "codepipeline.biocommons"',
              'git config --global user.name "codepipeline biocommons"',
              "npm install -g typescript",
            ],
          },
          pre_build: {
            commands: ["git checkout $CODEBUILD_RESOLVED_SOURCE_VERSION"],
          },
          build: {
            commands: [
              "npm ci",
              "npm run build",
              `npx release-please release-pr --repo-url git@github.com:${owner}/${repo}.git --token $GITHUB_TOKEN`,
              `npx release-please github-release --repo-url git@github.com:${owner}/${repo}.git --token $GITHUB_TOKEN`,
              "npm run prepare",
              "npm publish",
            ],
          },
        },
      }),
    });

    buildProject.role?.attachInlinePolicy(
      new Policy(this, "RunUnitTestsPolicy", {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: ["*"],
            actions: ["sts:GetServiceBearerToken"],
            conditions: {
              StringEquals: {
                "sts:AWSServiceName": "codeartifact.amazonaws.com",
              },
            },
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            // Adjust as needed
            resources: [
              `arn:aws:codeartifact:${this.region}:${this.account}:domain/*`,
            ],
            actions: ["codeartifact:GetAuthorizationToken"],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            // Adjust as needed
            resources: [
              `arn:aws:codeartifact:${this.region}:${this.account}:repository/*`,
              `arn:aws:codeartifact:${this.region}:${this.account}:package/*`,
            ],
            actions: [
              "codeartifact:ReadFromRepository",
              "codeartifact:GetRepositoryEndpoint",
              "codeartifact:List*",
              "codeartifact:PublishPackageVersion",
            ],
          }),
        ],
      })
    );

    // Build action
    const buildAction = new codepipelineActions.CodeBuildAction({
      actionName: "Build_And_Publish",
      project: buildProject,
      input: sourceOutput,
    });

    // Define the pipeline
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineType: codepipeline.PipelineType.V2,
      pipelineName: "NpmPublishPipeline",
      stages: [
        {
          stageName: "Source",
          actions: [sourceAction],
        },
        {
          stageName: "Build",
          actions: [buildAction],
        },
      ],
    });

    // Grant the necessary permissions for CodeBuild to access Secrets Manager
    githubTokenSecret.grantRead(buildProject.role!);
    codestarConnectionArnSecret.grantRead(buildProject.role!);
  }
}
