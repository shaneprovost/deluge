import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, getTableName } from "./client";
import type { DeceasedPerson, DeceasedDynamoItem, CreateDeceasedPerson } from "@/lib/types";
import { createId } from "@/lib/utils/id";

const TABLE = "deceased";
const PK_PREFIX = "PERSON#";
const SK_METADATA = "METADATA";

function toDomain(item: DeceasedDynamoItem): DeceasedPerson {
  return {
    personId: item.personId,
    firstName: item.firstName,
    lastInitial: item.lastInitial,
    yearOfDeath: item.yearOfDeath,
    role: item.role,
    cemeteryId: item.cemeteryId,
    cemeteryName: item.cemeteryName,
    prayerCount: item.prayerCount ?? 0,
    lastPrayedAt: item.lastPrayedAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function toItem(p: DeceasedPerson | (CreateDeceasedPerson & { personId: string; cemeteryName: string; prayerCount: number; lastPrayedAt: string | null; createdAt: string; updatedAt: string; deletedAt: string | null })): DeceasedDynamoItem {
  return {
    PK: `${PK_PREFIX}${p.personId}`,
    SK: SK_METADATA,
    personId: p.personId,
    firstName: p.firstName,
    lastInitial: p.lastInitial,
    yearOfDeath: p.yearOfDeath,
    role: p.role,
    cemeteryId: p.cemeteryId,
    cemeteryName: p.cemeteryName,
    prayerCount: "prayerCount" in p ? p.prayerCount : 0,
    lastPrayedAt: "lastPrayedAt" in p ? p.lastPrayedAt ?? undefined : undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: "deletedAt" in p ? p.deletedAt ?? undefined : undefined,
  };
}

export const deceasedRepository = {
  async getById(personId: string): Promise<DeceasedPerson | null> {
    const res = await dynamodb.send(
      new GetCommand({
        TableName: getTableName(TABLE),
        Key: { PK: `${PK_PREFIX}${personId}`, SK: SK_METADATA },
      })
    );
    if (!res.Item) return null;
    const item = res.Item as DeceasedDynamoItem;
    if (item.deletedAt) return null;
    return toDomain(item);
  },

  async create(data: CreateDeceasedPerson & { cemeteryName: string }): Promise<DeceasedPerson> {
    const personId = createId();
    const now = new Date().toISOString();
    const person: DeceasedPerson = {
      ...data,
      personId,
      prayerCount: 0,
      lastPrayedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await dynamodb.send(
      new PutCommand({
        TableName: getTableName(TABLE),
        Item: toItem(person),
      })
    );
    return person;
  },

  async update(personId: string, updates: Partial<Pick<DeceasedPerson, "firstName" | "lastInitial" | "yearOfDeath" | "role" | "cemeteryId" | "cemeteryName">>): Promise<DeceasedPerson | null> {
    const existing = await this.getById(personId);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: DeceasedPerson = { ...existing, ...updates, updatedAt: now };
    await dynamodb.send(
      new PutCommand({
        TableName: getTableName(TABLE),
        Item: toItem(updated),
      })
    );
    return updated;
  },

  async softDelete(personId: string): Promise<void> {
    const existing = await this.getById(personId);
    if (!existing) return;
    const now = new Date().toISOString();
    await dynamodb.send(
      new PutCommand({
        TableName: getTableName(TABLE),
        Item: toItem({ ...existing, deletedAt: now, updatedAt: now }),
      })
    );
  },

  async listByCemetery(cemeteryId: string): Promise<DeceasedPerson[]> {
    const res = await dynamodb.send(
      new QueryCommand({
        TableName: getTableName(TABLE),
        IndexName: "cemetery-index",
        KeyConditionExpression: "cemeteryId = :cid",
        FilterExpression: "attribute_not_exists(deletedAt)",
        ExpressionAttributeValues: { ":cid": cemeteryId },
      })
    );
    return (res.Items ?? []).map((i) => toDomain(i as DeceasedDynamoItem));
  },

  async incrementPrayerCount(personId: string, timestamp: string): Promise<void> {
    await dynamodb.send(
      new UpdateCommand({
        TableName: getTableName(TABLE),
        Key: { PK: `${PK_PREFIX}${personId}`, SK: SK_METADATA },
        UpdateExpression: "SET prayerCount = if_not_exists(prayerCount, :zero) + :inc, lastPrayedAt = :ts, updatedAt = :ts",
        ExpressionAttributeValues: { ":zero": 0, ":inc": 1, ":ts": timestamp },
      })
    );
  },
};
