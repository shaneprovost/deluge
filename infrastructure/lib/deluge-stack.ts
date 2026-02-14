import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface DelugeStackProps extends cdk.StackProps {
  envName: string;
}

const TABLE_PREFIX = 'deluge';

export class DelugeStack extends cdk.Stack {
  public readonly deceasedTable: dynamodb.Table;
  public readonly cemeteriesTable: dynamodb.Table;
  public readonly prayersTable: dynamodb.Table;
  public readonly assignmentPriorityTable: dynamodb.Table;
  public readonly rateLimitsTable: dynamodb.Table;
  public readonly updateAggregatesLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: DelugeStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const tablePrefix = `${TABLE_PREFIX}-${envName}`;
    const ssmPrefix = `/deluge/${envName}`;

    // Stack tags for billing and organization
    cdk.Tags.of(this).add('Project', 'Deluge');
    cdk.Tags.of(this).add('Environment', envName);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // -------------------------------------------------------------------------
    // Table: deceased (DeceasedPerson)
    // PK: PERSON#{personId}, SK: METADATA
    // -------------------------------------------------------------------------
    this.deceasedTable = new dynamodb.Table(this, 'DeceasedTable', {
      tableName: `${tablePrefix}-deceased`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.deceasedTable.addGlobalSecondaryIndex({
      indexName: 'cemetery-index',
      partitionKey: { name: 'cemeteryId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'personId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.deceasedTable.addGlobalSecondaryIndex({
      indexName: 'role-index',
      partitionKey: { name: 'role', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'personId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // -------------------------------------------------------------------------
    // Table: cemeteries
    // PK: CEMETERY#{cemeteryId}, SK: METADATA
    // -------------------------------------------------------------------------
    this.cemeteriesTable = new dynamodb.Table(this, 'CemeteriesTable', {
      tableName: `${tablePrefix}-cemeteries`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.cemeteriesTable.addGlobalSecondaryIndex({
      indexName: 'archdiocese-index',
      partitionKey: { name: 'archdiocese', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'cemeteryId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // -------------------------------------------------------------------------
    // Table: prayers (with stream for Lambda)
    // PK: PRAYER#{prayerId}, SK: METADATA
    // -------------------------------------------------------------------------
    this.prayersTable = new dynamodb.Table(this, 'PrayersTable', {
      tableName: `${tablePrefix}-prayers`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });
    this.prayersTable.addGlobalSecondaryIndex({
      indexName: 'person-prayers-index',
      partitionKey: { name: 'personId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.prayersTable.addGlobalSecondaryIndex({
      indexName: 'cemetery-prayers-index',
      partitionKey: { name: 'cemeteryId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // -------------------------------------------------------------------------
    // Table: assignment-priority (PK only: PERSON#{personId})
    // -------------------------------------------------------------------------
    this.assignmentPriorityTable = new dynamodb.Table(this, 'AssignmentPriorityTable', {
      tableName: `${tablePrefix}-assignment-priority`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // -------------------------------------------------------------------------
    // Table: rate-limits (PK: identifier, SK: windowStart, TTL: expiresAt)
    // -------------------------------------------------------------------------
    this.rateLimitsTable = new dynamodb.Table(this, 'RateLimitsTable', {
      tableName: `${tablePrefix}-rate-limits`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'expiresAt',
    });

    // -------------------------------------------------------------------------
    // SSM Parameters: table names for app config discovery (e.g. Next.js env)
    // -------------------------------------------------------------------------
    new ssm.StringParameter(this, 'SsmDeceasedTable', {
      parameterName: `${ssmPrefix}/tables/deceased`,
      stringValue: this.deceasedTable.tableName,
      description: 'Deceased persons DynamoDB table name',
    });
    new ssm.StringParameter(this, 'SsmCemeteriesTable', {
      parameterName: `${ssmPrefix}/tables/cemeteries`,
      stringValue: this.cemeteriesTable.tableName,
      description: 'Cemeteries DynamoDB table name',
    });
    new ssm.StringParameter(this, 'SsmPrayersTable', {
      parameterName: `${ssmPrefix}/tables/prayers`,
      stringValue: this.prayersTable.tableName,
      description: 'Prayers DynamoDB table name',
    });
    new ssm.StringParameter(this, 'SsmAssignmentPriorityTable', {
      parameterName: `${ssmPrefix}/tables/assignment-priority`,
      stringValue: this.assignmentPriorityTable.tableName,
      description: 'Assignment priority DynamoDB table name',
    });
    new ssm.StringParameter(this, 'SsmRateLimitsTable', {
      parameterName: `${ssmPrefix}/tables/rate-limits`,
      stringValue: this.rateLimitsTable.tableName,
      description: 'Rate limits DynamoDB table name',
    });

    // -------------------------------------------------------------------------
    // Lambda: update-aggregates (triggered by prayers table stream)
    // Placeholder inline code; pipeline can replace with built handler.
    // -------------------------------------------------------------------------
    this.updateAggregatesLambda = new lambda.Function(this, 'UpdateAggregates', {
      functionName: `${tablePrefix}-update-aggregates`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
  console.log('Stream records:', JSON.stringify(event.Records?.length ?? 0));
  for (const record of event.Records || []) {
    if (record.dynamodb?.NewImage) {
      const personId = record.dynamodb.NewImage.personId?.S;
      const cemeteryId = record.dynamodb.NewImage.cemeteryId?.S;
      if (personId && cemeteryId) {
        // TODO: Update deceased.prayerCount, lastPrayedAt; cemetery totals; assignment-priority
        console.log('Process prayer for person', personId, 'cemetery', cemeteryId);
      }
    }
  }
};
      `),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        DECEASED_TABLE_NAME: this.deceasedTable.tableName,
        CEMETERIES_TABLE_NAME: this.cemeteriesTable.tableName,
        ASSIGNMENT_PRIORITY_TABLE_NAME: this.assignmentPriorityTable.tableName,
      },
    });
    this.deceasedTable.grantReadWriteData(this.updateAggregatesLambda);
    this.cemeteriesTable.grantReadWriteData(this.updateAggregatesLambda);
    this.assignmentPriorityTable.grantReadWriteData(this.updateAggregatesLambda);
    this.updateAggregatesLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(this.prayersTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
      })
    );

    // Outputs for pipeline / app config
    new cdk.CfnOutput(this, 'DeceasedTableName', {
      value: this.deceasedTable.tableName,
      description: 'Deceased persons DynamoDB table',
      exportName: `${envName}-Deluge-DeceasedTableName`,
    });
    new cdk.CfnOutput(this, 'CemeteriesTableName', {
      value: this.cemeteriesTable.tableName,
      description: 'Cemeteries DynamoDB table',
      exportName: `${envName}-Deluge-CemeteriesTableName`,
    });
    new cdk.CfnOutput(this, 'PrayersTableName', {
      value: this.prayersTable.tableName,
      description: 'Prayers DynamoDB table',
      exportName: `${envName}-Deluge-PrayersTableName`,
    });
    new cdk.CfnOutput(this, 'AssignmentPriorityTableName', {
      value: this.assignmentPriorityTable.tableName,
      description: 'Assignment priority DynamoDB table',
      exportName: `${envName}-Deluge-AssignmentPriorityTableName`,
    });
    new cdk.CfnOutput(this, 'RateLimitsTableName', {
      value: this.rateLimitsTable.tableName,
      description: 'Rate limits DynamoDB table',
      exportName: `${envName}-Deluge-RateLimitsTableName`,
    });
    new cdk.CfnOutput(this, 'SsmConfigPrefix', {
      value: ssmPrefix,
      description: 'SSM parameter prefix for table names (e.g. /deluge/dev/tables/deceased)',
      exportName: `${envName}-Deluge-SsmConfigPrefix`,
    });
  }
}
