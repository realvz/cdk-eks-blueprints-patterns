import * as cdk from '@aws-cdk/core';

// SSP Lib
import * as ssp from '@aws-quickstart/ssp-amazon-eks'
import * as team from '../teams'

export default class StarterConstruct extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);
        
        // Setup platform team
        const accountID = process.env.CDK_DEFAULT_ACCOUNT!
        const platformTeam = new team.TeamPlatform(accountID)

        // Onboard teams as necessary - import lib/teams
        const teams: Array<ssp.Team> = [
            platformTeam,
            new team.TeamTroiSetup,
            new team.TeamRikerSetup,
            new team.TeamBurnhamSetup(scope)
        ];

        // Include more addons as necessary
        const addOns: Array<ssp.ClusterAddOn> = [
            new ssp.ArgoCDAddOn
        ];

        const stackID = `${id}-blueprint`
        new ssp.EksBlueprint(scope, { id: stackID, addOns, teams }, {
            env: {
                region: 'us-east-1',
            },
        });
        
        // Pipeline construct
        const account = process.env.CDK_DEFAULT_ACCOUNT;
        const region = process.env.CDK_DEFAULT_REGION;
        const env = { account, region };
        const blueprint = ssp.EksBlueprint.builder()
            .account(accountID) 
            .region('us-east-1')
            .addOns(
                new ssp.AwsLoadBalancerControllerAddOn, 
                new ssp.NginxAddOn,
                new ssp.ArgoCDAddOn
            )
            .teams(
                new team.TeamPlatform(accountID),
                new team.TeamRikerSetup,
                new team.TeamBurnhamSetup(scope),
                new team.TeamTroiSetup
            );
            
        // Build code pipeline and add stages
        ssp.CodePipelineStack.builder()
            .name("ssp-eks-workshop-pipeline")
            .owner("aws-samples")
            .repository({
                repoUrl: 'ssp-eks-patterns',
                credentialsSecretName: 'github-token',
                targetRevision: 'young-workshop-test'
            })
            .stage({
                id: 'dev',
                stackBuilder: blueprint.clone('us-east-1')
            })
            .stage({
                id: 'prod',
                stackBuilder: blueprint.clone('us-west-2'),
                stageProps: {
                    manualApprovals: true
                }
            })
            .build(scope, `${id}-pipeline-stack`, {env});
    }
}


