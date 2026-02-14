import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, getTableName } from "./client";
import type { Cemetery, CemeteryDynamoItem, CreateCemetery } from "@/lib/types";
import { createId } from "@/lib/utils/id";

const TABLE = "cemeteries";
const PK_PREFIX = "CEMETERY#";
const SK_METADATA = "METADATA";

function toDomain(item: CemeteryDynamoItem): Cemetery {
  return {
    cemeteryId: item.cemeteryId,
    name: item.name,
    address: item.address ?? null,
    city: item.city,
    state: item.state,
    zipCode: item.zipCode ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
    archdiocese: item.archdiocese,
    totalDeceased: item.totalDeceased ?? 0,
    totalPrayers: item.totalPrayers ?? 0,
    uniquePrayedFor: item.uniquePrayedFor ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function toItem(c: Cemetery): CemeteryDynamoItem {
  return {
    PK: `${PK_PREFIX}${c.cemeteryId}`,
    SK: SK_METADATA,
    cemeteryId: c.cemeteryId,
    name: c.name,
    address: c.address ?? undefined,
    city: c.city,
    state: c.state,
    zipCode: c.zipCode ?? undefined,
    latitude: c.latitude,
    longitude: c.longitude,
    archdiocese: c.archdiocese,
    totalDeceased: c.totalDeceased,
    totalPrayers: c.totalPrayers,
    uniquePrayedFor: c.uniquePrayedFor,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    deletedAt: c.deletedAt ?? undefined,
  };
}

export const cemeteriesRepository = {
  async getById(cemeteryId: string): Promise<Cemetery | null> {
    const res = await dynamodb.send(
      new GetCommand({
        TableName: getTableName(TABLE),
        Key: { PK: `${PK_PREFIX}${cemeteryId}`, SK: SK_METADATA },
      })
    );
    if (!res.Item) return null;
    const item = res.Item as CemeteryDynamoItem;
    if (item.deletedAt) return null;
    return toDomain(item);
  },

  async create(data: CreateCemetery): Promise<Cemetery> {
    const cemeteryId = createId();
    const now = new Date().toISOString();
    const cemetery: Cemetery = {
      ...data,
      cemeteryId,
      address: data.address ?? null,
      zipCode: data.zipCode ?? null,
      totalDeceased: 0,
      totalPrayers: 0,
      uniquePrayedFor: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await dynamodb.send(
      new PutCommand({
        TableName: getTableName(TABLE),
        Item: toItem(cemetery),
      })
    );
    return cemetery;
  },

  async listByArchdiocese(archdiocese: string): Promise<Cemetery[]> {
    const res = await dynamodb.send(
      new QueryCommand({
        TableName: getTableName(TABLE),
        IndexName: "archdiocese-index",
        KeyConditionExpression: "archdiocese = :arch",
        FilterExpression: "attribute_not_exists(deletedAt)",
        ExpressionAttributeValues: { ":arch": archdiocese },
      })
    );
    return (res.Items ?? []).map((i) => toDomain(i as CemeteryDynamoItem));
  },
};
