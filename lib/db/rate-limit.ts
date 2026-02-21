import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, getTableName } from "./client";
import {
  RATE_LIMIT_SESSION_PER_HOUR,
  RATE_LIMIT_IP_PER_HOUR,
} from "@/config/constants";

const TABLE = "rate-limits";
const TTL_SECONDS = 7200; // 2 hours from window start

function isResourceNotFound(err: unknown): boolean {
  return (
    (err as { name?: string }).name === "ResourceNotFoundException" ||
    (err as { __type?: string }).__type?.includes("ResourceNotFoundException") === true
  );
}

function hourBucket(): string {
  return new Date().toISOString().slice(0, 13); // e.g. 2024-01-15T10
}

function getSecondsUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(next.getHours() + 1);
  next.setMinutes(0);
  next.setSeconds(0);
  next.setMilliseconds(0);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

async function getCount(pk: string, sk: string): Promise<number> {
  const res = await dynamodb.send(
    new GetCommand({
      TableName: getTableName(TABLE),
      Key: { PK: pk, SK: sk },
    })
  );
  const item = res.Item as { requestCount?: number } | undefined;
  return item?.requestCount ?? 0;
}

async function incrementCount(pk: string, sk: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TTL_SECONDS;
  await dynamodb.send(
    new UpdateCommand({
      TableName: getTableName(TABLE),
      Key: { PK: pk, SK: sk },
      UpdateExpression:
        "SET requestCount = if_not_exists(requestCount, :zero) + :inc, expiresAt = :ttl",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1,
        ":ttl": expiresAt,
      },
      ReturnValues: "UPDATED_NEW",
    })
  );
  const res = await dynamodb.send(
    new GetCommand({
      TableName: getTableName(TABLE),
      Key: { PK: pk, SK: sk },
    })
  );
  return (res.Item as { requestCount: number })?.requestCount ?? 1;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Check and consume one unit of rate limit for assignment requests.
 * Returns allowed: false with retryAfterSeconds when over limit.
 * If the rate-limits table does not exist (ResourceNotFoundException), allows the request and logs a warning.
 */
export async function checkRateLimitAssign(
  sessionId: string,
  ipHash: string
): Promise<RateLimitResult> {
  try {
    const sk = hourBucket();
    const sessionPk = `session:${sessionId}`;
    const ipPk = `ip:${ipHash}`;

    const [sessionCount, ipCount] = await Promise.all([
      getCount(sessionPk, sk),
      getCount(ipPk, sk),
    ]);

    if (sessionCount >= RATE_LIMIT_SESSION_PER_HOUR) {
      return { allowed: false, retryAfterSeconds: getSecondsUntilNextHour() };
    }
    if (ipCount >= RATE_LIMIT_IP_PER_HOUR) {
      return { allowed: false, retryAfterSeconds: getSecondsUntilNextHour() };
    }

    await Promise.all([
      incrementCount(sessionPk, sk),
      incrementCount(ipPk, sk),
    ]);
    return { allowed: true };
  } catch (err) {
    if (isResourceNotFound(err)) {
      const tableName = getTableName(TABLE);
      const region = process.env.AWS_REGION ?? "us-east-1";
      console.warn(
        `Rate limits table not found; allowing request. Table: ${tableName}, region: ${region}. ` +
          "Verify the CDK stack was deployed to this region and DYNAMODB_TABLE_PREFIX matches (e.g. deluge-staging)."
      );
      return { allowed: true };
    }
    throw err;
  }
}

/**
 * Check (without incrementing) whether the client is over the prayer submission rate limit.
 * If the rate-limits table does not exist, allows the request.
 */
export async function checkRateLimitPray(
  sessionId: string,
  ipHash: string
): Promise<RateLimitResult> {
  try {
    const sk = hourBucket();
    const sessionPk = `pray:session:${sessionId}`;
    const ipPk = `pray:ip:${ipHash}`;

    const [sessionCount, ipCount] = await Promise.all([
      getCount(sessionPk, sk),
      getCount(ipPk, sk),
    ]);

    if (sessionCount >= RATE_LIMIT_SESSION_PER_HOUR) {
      return { allowed: false, retryAfterSeconds: getSecondsUntilNextHour() };
    }
    if (ipCount >= RATE_LIMIT_IP_PER_HOUR) {
      return { allowed: false, retryAfterSeconds: getSecondsUntilNextHour() };
    }
    return { allowed: true };
  } catch (err) {
    if (isResourceNotFound(err)) {
      return { allowed: true };
    }
    throw err;
  }
}

/** Increment prayer rate limit counters (call after recording a prayer). No-op if rate-limits table does not exist. */
export async function incrementRateLimitPray(
  sessionId: string,
  ipHash: string
): Promise<void> {
  try {
    const sk = hourBucket();
    await Promise.all([
      incrementCount(`pray:session:${sessionId}`, sk),
      incrementCount(`pray:ip:${ipHash}`, sk),
    ]);
  } catch (err) {
    if (isResourceNotFound(err)) return;
    throw err;
  }
}
