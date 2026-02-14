/**
 * Seed script: populates DynamoDB with initial cemeteries and deceased persons.
 * Run after deploying CDK stack and setting DYNAMODB_TABLE_PREFIX (e.g. deluge-dev).
 *
 * Usage: npm run seed
 */
import { deceasedRepository } from "../lib/db/deceased";
import { cemeteriesRepository } from "../lib/db/cemeteries";
import { assignmentPriorityRepository } from "../lib/db/assignment-priority";

const CEMETERIES = [
  { name: "Holy Spirit Cemetery", city: "Atlanta", state: "GA", latitude: 33.749, longitude: -84.388, archdiocese: "Atlanta" },
  { name: "Arlington Memorial Park", city: "Atlanta", state: "GA", latitude: 33.878, longitude: -84.332, archdiocese: "Atlanta" },
];

const DECEASED = [
  { firstName: "John", lastInitial: "D", yearOfDeath: 1987, role: "priest" as const, cemeteryName: "Holy Spirit Cemetery" },
  { firstName: "Michael", lastInitial: "S", yearOfDeath: 1992, role: "priest" as const, cemeteryName: "Holy Spirit Cemetery" },
  { firstName: "Robert", lastInitial: "K", yearOfDeath: 2001, role: "bishop" as const, cemeteryName: "Arlington Memorial Park" },
];

async function main() {
  const prefix = process.env.DYNAMODB_TABLE_PREFIX;
  if (!prefix) {
    console.error("Set DYNAMODB_TABLE_PREFIX (e.g. deluge-dev) and AWS credentials.");
    process.exit(1);
  }

  console.log("Creating cemeteries...");
  const cemeteryIds: Record<string, string> = {};
  for (const c of CEMETERIES) {
    const created = await cemeteriesRepository.create({
      name: c.name,
      city: c.city,
      state: c.state,
      latitude: c.latitude,
      longitude: c.longitude,
      archdiocese: c.archdiocese,
    });
    cemeteryIds[c.name] = created.cemeteryId;
    console.log("  ", created.name, created.cemeteryId);
  }

  console.log("Creating deceased and assignment-priority...");
  for (const d of DECEASED) {
    const cemeteryId = cemeteryIds[d.cemeteryName];
    if (!cemeteryId) {
      console.warn("  Skip (unknown cemetery):", d.firstName, d.lastInitial);
      continue;
    }
    const person = await deceasedRepository.create({
      firstName: d.firstName,
      lastInitial: d.lastInitial,
      yearOfDeath: d.yearOfDeath,
      role: d.role,
      cemeteryId,
      cemeteryName: d.cemeteryName,
    });
    await assignmentPriorityRepository.put({
      personId: person.personId,
      prayerCount: 0,
      lastPrayedAt: null,
      cemeteryId,
      role: person.role,
      isActive: true,
    });
    console.log("  ", person.firstName, person.lastInitial, person.personId);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
