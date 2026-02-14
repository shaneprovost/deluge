import { assignmentPriorityRepository } from "./assignment-priority";
import { deceasedRepository } from "./deceased";
import type { DeceasedPerson, AssignmentPriority } from "@/lib/types";
import { ASSIGNMENT_CACHE_TTL_MS } from "@/config/constants";

let candidateCache: AssignmentPriority[] = [];
let cacheTimestamp = 0;

async function refreshCache(): Promise<AssignmentPriority[]> {
  candidateCache = await assignmentPriorityRepository.scanActiveCandidates();
  cacheTimestamp = Date.now();
  return candidateCache;
}

/**
 * Get a person to assign for prayer. 70% from lowest prayer count pool, 30% random.
 * Uses an in-memory cache refreshed every 10 minutes or when pool is small.
 */
export async function getPersonToAssign(): Promise<DeceasedPerson | null> {
  if (Date.now() - cacheTimestamp > ASSIGNMENT_CACHE_TTL_MS || candidateCache.length < 10) {
    await refreshCache();
  }
  if (candidateCache.length === 0) return null;

  const useLowest = Math.random() < 0.7;
  let selected: AssignmentPriority;

  if (useLowest) {
    const sorted = [...candidateCache].sort((a, b) => a.prayerCount - b.prayerCount);
    const poolSize = Math.min(10, sorted.length);
    const candidates = sorted.slice(0, poolSize);
    selected = candidates[Math.floor(Math.random() * candidates.length)]!;
  } else {
    selected = candidateCache[Math.floor(Math.random() * candidateCache.length)]!;
  }

  const person = await deceasedRepository.getById(selected.personId);
  return person;
}
