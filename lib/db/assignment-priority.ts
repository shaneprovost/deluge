import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, getTableName } from "./client";
import type { AssignmentPriority, AssignmentPriorityDynamoItem } from "@/lib/types";

const TABLE = "assignment-priority";
const PK_PREFIX = "PERSON#";

function toDomain(item: AssignmentPriorityDynamoItem): AssignmentPriority {
  return {
    personId: item.personId,
    prayerCount: item.prayerCount ?? 0,
    lastPrayedAt: item.lastPrayedAt ?? null,
    cemeteryId: item.cemeteryId,
    role: item.role,
    isActive: item.isActive ?? true,
  };
}

function toItem(a: AssignmentPriority): AssignmentPriorityDynamoItem {
  return {
    PK: `${PK_PREFIX}${a.personId}`,
    personId: a.personId,
    prayerCount: a.prayerCount,
    lastPrayedAt: a.lastPrayedAt ?? undefined,
    cemeteryId: a.cemeteryId,
    role: a.role,
    isActive: a.isActive,
  };
}

export const assignmentPriorityRepository = {
  async getByPersonId(personId: string): Promise<AssignmentPriority | null> {
    const res = await dynamodb.send(
      new GetCommand({
        TableName: getTableName(TABLE),
        Key: { PK: `${PK_PREFIX}${personId}` },
      })
    );
    if (!res.Item) return null;
    return toDomain(res.Item as AssignmentPriorityDynamoItem);
  },

  async put(record: AssignmentPriority): Promise<void> {
    await dynamodb.send(
      new PutCommand({
        TableName: getTableName(TABLE),
        Item: toItem(record),
      })
    );
  },

  async updatePrayerStats(personId: string, prayerCount: number, lastPrayedAt: string): Promise<void> {
    await dynamodb.send(
      new UpdateCommand({
        TableName: getTableName(TABLE),
        Key: { PK: `${PK_PREFIX}${personId}` },
        UpdateExpression: "SET prayerCount = :pc, lastPrayedAt = :ts",
        ExpressionAttributeValues: { ":pc": prayerCount, ":ts": lastPrayedAt },
      })
    );
  },

  /**
   * Scan active candidates for assignment. Prefer using assignment.getPersonToAssign() which caches.
   */
  async scanActiveCandidates(limit = 100): Promise<AssignmentPriority[]> {
    const res = await dynamodb.send(
      new ScanCommand({
        TableName: getTableName(TABLE),
        FilterExpression: "isActive = :active",
        ExpressionAttributeValues: { ":active": true },
        Limit: limit,
      })
    );
    return (res.Items ?? []).map((i) => toDomain(i as AssignmentPriorityDynamoItem));
  },
};
