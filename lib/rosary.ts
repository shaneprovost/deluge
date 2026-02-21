/**
 * Rosary bead structure: one bead = one prayer = one assigned person.
 * Prayer type sent to API: our_father | hail_mary | other (for Glory Be, Creed, etc.)
 */
export type RosaryPrayerBeadType = "our_father" | "hail_mary" | "other";

export type MysterySet = "joyful" | "sorrowful" | "glorious" | "luminous";

export interface RosaryBead {
  index: number;
  prayerType: RosaryPrayerBeadType;
  /** For display: "creed" | "our_father" | "hail_mary" | "glory_be" | "fatima" */
  label: "creed" | "our_father" | "hail_mary" | "glory_be" | "fatima";
  decade?: number; // 1-5 for decade beads
  beadInDecade?: number; // 1-10 for Hail Marys in decade
}

/**
 * Build the full rosary prayer sequence (70 steps).
 * One physical bead is used for Glory Be + Fatima + Our Father between decades;
 * we still have 3 prayer steps (and 3 assignments) for that bead.
 */
export function getRosaryBeads(): RosaryBead[] {
  const beads: RosaryBead[] = [];
  let index = 0;

  // Introductory: Cross (Creed), Our Father, 3 Hail Marys
  beads.push({ index: index++, label: "creed", prayerType: "other" });
  beads.push({ index: index++, label: "our_father", prayerType: "our_father" });
  beads.push({ index: index++, label: "hail_mary", prayerType: "hail_mary" });
  beads.push({ index: index++, label: "hail_mary", prayerType: "hail_mary" });
  beads.push({ index: index++, label: "hail_mary", prayerType: "hail_mary" });

  // 5 decades: each = one triple bead (GB, Fatima, OF) + 10 Hail Marys
  for (let decade = 1; decade <= 5; decade++) {
    beads.push({ index: index++, label: "glory_be", prayerType: "other", decade });
    beads.push({ index: index++, label: "fatima", prayerType: "other", decade });
    beads.push({ index: index++, label: "our_father", prayerType: "our_father", decade });
    for (let i = 1; i <= 10; i++) {
      beads.push({
        index: index++,
        label: "hail_mary",
        prayerType: "hail_mary",
        decade,
        beadInDecade: i,
      });
    }
  }

  return beads;
}

export const ROSARY_BEAD_COUNT = 70;

/** Minimum seconds before "Next" is enabled for any bead (abuse prevention). */
export const ROSARY_MIN_SECONDS_BEFORE_NEXT = 8;

/** Seconds before auto-advance (when enabled) per prayer type; used only for decade Hail Marys. */
const BEAD_SECONDS: Record<RosaryBead["label"], number> = {
  creed: 35,
  our_father: 25,
  hail_mary: 25,
  glory_be: 15,
  fatima: 15,
};

/** Minimum seconds for this bead before Next is enabled. */
export function getSecondsForBead(bead: RosaryBead): number {
  return BEAD_SECONDS[bead.label] ?? 25;
}

/** True only for the 10 Hail Marys within each decade (auto-advance applies only to these when option is on). */
export function isDecadeHailMary(bead: RosaryBead): boolean {
  return bead.label === "hail_mary" && bead.decade != null && bead.beadInDecade != null;
}

/** One physical bead = one prayer step. Triple = one bead with GB, Fatima, OF. */
export type VisualBead =
  | { type: "single"; index: number }
  | { type: "triple"; indices: [number, number, number] };

/** 60 visual beads: singles + triples (one element per GB/Fatima/OF group). */
export function getVisualBeads(beads: RosaryBead[]): VisualBead[] {
  const out: VisualBead[] = [];
  let i = 0;
  while (i < beads.length) {
    const b = beads[i];
    if (b.label === "glory_be" && beads[i + 1]?.label === "fatima" && beads[i + 2]?.label === "our_father") {
      out.push({ type: "triple", indices: [i, i + 1, i + 2] });
      i += 3;
    } else {
      out.push({ type: "single", index: i });
      i += 1;
    }
  }
  return out;
}

/** Our Father bead index that starts each decade (1–5). */
const DECADE_OF_INDEX = [7, 20, 33, 46, 59];

/** Beads for one decade only: OF, 10 HM, GB, Fatima, OF (14 steps). Decade 1–5. */
export function getBeadsForDecade(decadeNumber: number): RosaryBead[] {
  const full = getRosaryBeads();
  const start = DECADE_OF_INDEX[decadeNumber - 1] ?? 7;
  const slice = full.slice(start, start + 14);
  return slice.map((b, i) => ({ ...b, index: i }));
}

export const DECADE_BEAD_COUNT = 14;

/** Current decade (1–5) for display: stays the same until the Our Father of the *next* decade. Intro shows decade 1. */
export function getCurrentDecade(beadIndex: number): number {
  if (beadIndex < DECADE_OF_INDEX[0]) return 1;
  if (beadIndex < DECADE_OF_INDEX[1]) return 1;
  if (beadIndex < DECADE_OF_INDEX[2]) return 2;
  if (beadIndex < DECADE_OF_INDEX[3]) return 3;
  if (beadIndex < DECADE_OF_INDEX[4]) return 4;
  return 5;
}
