import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export const dynamodb = DynamoDBDocumentClient.from(client);

/**
 * Resolve table name from prefix (e.g. deluge-dev) and suffix (e.g. deceased).
 * Set DYNAMODB_TABLE_PREFIX in env, or use full table names via SSM in production.
 */
export function getTableName(suffix: string): string {
  const prefix = process.env.DYNAMODB_TABLE_PREFIX;
  if (!prefix) {
    throw new Error("DYNAMODB_TABLE_PREFIX is not set");
  }
  return `${prefix}-${suffix}`;
}
