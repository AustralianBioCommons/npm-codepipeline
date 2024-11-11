import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export class NpmPublishPipelineStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Retrieve GitHub token and CodeStar connection ARN from Secrets Manager
    const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GithubToken",
      "github-token"
    );
    const codestarConnectionArnSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "CodeStarConnectionArn",
      "codestar-connection-arn"
    );

    // Source action: Connect to GitHub using CodeStar connection
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction =
      new codepipelineActions.CodeStarConnectionsSourceAction({
        actionName: "GitHub_Source",
        owner: "your-org",
        repo: "your-repo",
        branch: "main",
        output: sourceOutput,
        connectionArn: codestarConnectionArnSecret.secretValue.toString(),
      });

    // CodeBuild project: Build and publish to CodeArtifact
    const buildProject = new codebuild.PipelineProject(this, "BuildProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        environmentVariables: {
          GITHUB_TOKEN: { value: githubTokenSecret.secretValue.toString() },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: [
              "npm ci", 
            ],
          },
          build: {
            commands: [
              "npm run build", 
              "npx release-please release-pr --token $GITHUB_TOKEN", 
              "npx release-please github-release --token $GITHUB_TOKEN", 
              "npm version from-git", 
              "npm run prepare", 
              "npm publish", 
            ],
          },
        },
      }),
    });

    // Build action
    const buildAction = new codepipelineActions.CodeBuildAction({
      actionName: "Build_And_Publish",
      project: buildProject,
      input: sourceOutput,
    });

    // Define the pipeline
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
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
