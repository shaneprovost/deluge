import { PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, getTableName } from "./client";
import type { Prayer, PrayerDynamoItem, CreatePrayer } from "@/lib/types";
import { createId } from "@/lib/utils/id";

const TABLE = "prayers";
const PK_PREFIX = "PRAYER#";
const SK_METADATA = "METADATA";

function toDomain(item: PrayerDynamoItem): Prayer {
  return {
    prayerId: item.prayerId,
    personId: item.personId,
    cemeteryId: item.cemeteryId,
    prayerType: item.prayerType,
    sessionId: item.sessionId ?? null,
    ipAddressHash: item.ipAddressHash ?? null,
    userAgent: item.userAgent ?? null,
    userId: item.userId ?? null,
    metadata: item.metadata ?? null,
    createdAt: item.createdAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function toItem(p: Prayer): PrayerDynamoItem {
  return {
    PK: `${PK_PREFIX}${p.prayerId}`,
    SK: SK_METADATA,
    prayerId: p.prayerId,
    personId: p.personId,
    cemeteryId: p.cemeteryId,
    prayerType: p.prayerType,
    sessionId: p.sessionId ?? undefined,
    ipAddressHash: p.ipAddressHash ?? undefined,
    userAgent: p.userAgent ?? undefined,
    userId: p.userId ?? undefined,
    metadata: p.metadata ?? undefined,
    createdAt: p.createdAt,
    deletedAt: p.deletedAt ?? undefined,
  };
}

export const prayersRepository = {
  async create(data: CreatePrayer & { sessionId?: string; ipAddressHash?: string; userAgent?: string }): Promise<Prayer> {
    const prayerId = createId();
    const now = new Date().toISOString();
    const prayer: Prayer = {
      prayerId,
      personId: data.personId,
      cemeteryId: data.cemeteryId,
      prayerType: data.prayerType,
      sessionId: data.sessionId ?? null,
      ipAddressHash: data.ipAddressHash ?? null,
      userAgent: data.userAgent ?? null,
      userId: null,
      metadata: null,
      createdAt: now,
      deletedAt: null,
    };
    await dynamodb.send(
      new PutCommand({
        TableName: getTableName(TABLE),
        Item: toItem(prayer),
      })
    );
    return prayer;
  },

  async getById(prayerId: string): Promise<Prayer | null> {
    const res = await dynamodb.send(
      new GetCommand({
        TableName: getTableName(TABLE),
        Key: { PK: `${PK_PREFIX}${prayerId}`, SK: SK_METADATA },
      })
    );
    if (!res.Item) return null;
    const item = res.Item as PrayerDynamoItem;
    if (item.deletedAt) return null;
    return toDomain(item);
  },

  async listByPerson(personId: string, limit = 10): Promise<Prayer[]> {
    const res = await dynamodb.send(
      new QueryCommand({
        TableName: getTableName(TABLE),
        IndexName: "person-prayers-index",
        KeyConditionExpression: "personId = :pid",
        ExpressionAttributeValues: { ":pid": personId },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (res.Items ?? []).map((i) => toDomain(i as PrayerDynamoItem));
  },

  async listByCemetery(cemeteryId: string, limit = 5): Promise<Prayer[]> {
    const res = await dynamodb.send(
      new QueryCommand({
        TableName: getTableName(TABLE),
        IndexName: "cemetery-prayers-index",
        KeyConditionExpression: "cemeteryId = :cid",
        ExpressionAttributeValues: { ":cid": cemeteryId },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    // KEYS_ONLY projection returns only PK/SK/personId/cemeteryId/createdAt; we need full item for prayerType.
    // CDK stack has cemetery-prayers-index as KEYS_ONLY - so we get only keys. We'd need to batch get or change to ALL.
    // For recent activity we need prayerType and createdAt. So we use person-prayers-index for "recent activity" by cemetery
    // by querying prayers and filtering, or we change GSI to ALL. Per schema it's KEYS_ONLY. So we fetch by key - we have PK/SK from the index.
    // Actually with KEYS_ONLY we get PK, SK, personId, cemeteryId, createdAt (the GSI keys). We don't get prayerType.
    // So for "recent activity at cemetery" we have two options: (1) change GSI to ALL, or (2) do a batch GetItem for each PK,SK.
    // I'll assume we use ALL for cemetery-prayers-index for simplicity in the app (we can document that). Checking the CDK...
    // In deluge-stack.ts: cemetery-prayers-index is KEYS_ONLY. So the Query returns items with only PK, SK, personId, cemeteryId, createdAt.
    // We need to BatchGetItem to get full items for prayerType. For MVP we can return minimal recent activity (just createdAt and fetch prayer type in a follow-up) or we add ALL.
    // I'll return what we have and add a note - or we could BatchGet. Let me just return the items we get; the type might need optional prayerType. Actually the schema says "for activity feed" so we need prayerType. I'll add a BatchGet for the returned keys to fill in prayerType, or we simplify and use ALL in a comment. For now I'll do a batch get.
    const items = res.Items ?? [];
    if (items.length === 0) return [];
    const fullItems = await Promise.all(
      items.map((row) => dynamodb.send(new GetCommand({
        TableName: getTableName(TABLE),
        Key: { PK: (row as { PK: string }).PK, SK: (row as { SK: string }).SK },
      })))
    );
    return fullItems
      .map((r) => r.Item as PrayerDynamoItem | undefined)
      .filter((i): i is PrayerDynamoItem => !!i && !i.deletedAt)
      .map(toDomain);
  },
};
