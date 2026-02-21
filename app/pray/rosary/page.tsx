"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { MysterySet } from "@/lib/rosary";
import {
  getRosaryBeads,
  getBeadsForDecade,
  ROSARY_BEAD_COUNT,
  DECADE_BEAD_COUNT,
  ROSARY_MIN_SECONDS_BEFORE_NEXT,
  getSecondsForBead,
  isDecadeHailMary,
  getCurrentDecade,
} from "@/lib/rosary";
import { RosaryBeadStrip } from "@/components/RosaryBeadStrip";

type AssignData = {
  personId: string;
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: string;
  cemetery: { cemeteryId: string; name: string; city: string; state: string };
};

type Step = "choose_mystery" | "loading" | "praying" | "submitting" | "summary" | "error";

const MYSTERY_SETS: MysterySet[] = ["joyful", "sorrowful", "glorious", "luminous"];
const ROSARY_SINGLE_PERSON_KEY = "deluge_rosary_single_person";
const ROSARY_DECADE_KEY = "deluge_rosary_decade";

function getPrayerTextKey(label: string): string {
  if (label === "creed") return "creed";
  if (label === "glory_be") return "glory_be";
  if (label === "fatima") return "fatima";
  if (label === "our_father") return "our_father";
  if (label === "hail_mary") return "hail_mary";
  return "our_father";
}

export default function RosaryPage() {
  const { t } = useTranslation("rosary");
  const { t: tPrayers } = useTranslation("prayers");
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose_mystery");
  const [mysterySet, setMysterySet] = useState<MysterySet | null>(null);
  const [autoNext, setAutoNext] = useState(false);
  const [beads, setBeads] = useState(() => getRosaryBeads());
  const [beadCount, setBeadCount] = useState(ROSARY_BEAD_COUNT);
  const [beadPeople, setBeadPeople] = useState<(AssignData | null)[]>(() =>
    Array(ROSARY_BEAD_COUNT).fill(null)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canAdvanceAt, setCanAdvanceAt] = useState(0);
  const [autoAdvanceAt, setAutoAdvanceAt] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [autoCountdown, setAutoCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const hasAutoAdvancedRef = useRef(false);
  const mysteryFormRef = useRef<HTMLFieldSetElement>(null);
  const [singlePerson, setSinglePerson] = useState<AssignData | null>(null);
  const [decadeMode, setDecadeMode] = useState<{ mysterySet: MysterySet; decade: number } | null>(null);

  const fetchAssign = useCallback(async (index: number): Promise<AssignData | null> => {
    const res = await fetch("/api/assign");
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) return null;
    return json.data;
  }, []);

  const recordPrayer = useCallback(
    async (personId: string, prayerType: "our_father" | "hail_mary" | "other"): Promise<boolean> => {
      const res = await fetch("/api/pray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, prayerType }),
      });
      const json = await res.json();
      return res.ok && json.success;
    },
    []
  );

  const advanceToNext = useCallback(async () => {
    const person = beadPeople[currentIndex];
    if (!person) return;
    const bead = beads[currentIndex];
    const apiPrayerType = bead.prayerType;

    setStep("submitting");
    setError(null);
    const ok = await recordPrayer(person.personId, apiPrayerType);
    if (!ok) {
      setError("Prayer could not be recorded.");
      setStep("praying");
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= beadCount) {
      try {
        sessionStorage.removeItem(ROSARY_SINGLE_PERSON_KEY);
        sessionStorage.removeItem(ROSARY_DECADE_KEY);
      } catch {
        // ignore
      }
      setStep("summary");
      return;
    }

    // Single-person mode: next slot is already filled. Otherwise use prefetched or fetch.
    let nextPerson = beadPeople[nextIndex];
    if (!nextPerson && !singlePerson) {
      nextPerson = await fetchAssign(nextIndex);
    }
    if (nextPerson) {
      setBeadPeople((prev) => {
        const next = [...prev];
        next[nextIndex] = nextPerson;
        return next;
      });
    }
    const nextBead = beads[nextIndex];
    const now = Date.now();
    setCurrentIndex(nextIndex);
    setCanAdvanceAt(now + ROSARY_MIN_SECONDS_BEFORE_NEXT * 1000);
    setAutoAdvanceAt(
      autoNext && isDecadeHailMary(nextBead)
        ? now + getSecondsForBead(nextBead) * 1000
        : 0
    );
    hasAutoAdvancedRef.current = false;
    setStep("praying");
  }, [beadPeople, currentIndex, beads, recordPrayer, fetchAssign, autoNext, singlePerson, beadCount]);

  // On mount: read single-person and optional decade mode from /pray redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(ROSARY_SINGLE_PERSON_KEY);
      if (raw) {
        const data = JSON.parse(raw) as AssignData;
        if (data?.personId && data?.firstName != null) setSinglePerson(data);
      }
      const decadeRaw = sessionStorage.getItem(ROSARY_DECADE_KEY);
      if (decadeRaw) {
        const d = JSON.parse(decadeRaw) as { mysterySet: MysterySet; decade: number };
        if (d?.mysterySet && d?.decade >= 1 && d?.decade <= 5) {
          setDecadeMode(d);
          setBeads(getBeadsForDecade(d.decade));
          setBeadCount(DECADE_BEAD_COUNT);
          setMysterySet(d.mysterySet);
          setStep("loading");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial assign for bead 0 (or use single person for all beads)
  useEffect(() => {
    if (step !== "loading" || mysterySet === null) return;
    if (singlePerson) {
      setBeadPeople(Array(beadCount).fill(singlePerson));
      const bead0 = beads[0];
      const now = Date.now();
      setCanAdvanceAt(now + ROSARY_MIN_SECONDS_BEFORE_NEXT * 1000);
      setAutoAdvanceAt(
        autoNext && isDecadeHailMary(bead0)
          ? now + getSecondsForBead(bead0) * 1000
          : 0
      );
      setStep("praying");
      return;
    }
    let cancelled = false;
    (async () => {
      const person = await fetchAssign(0);
      if (cancelled) return;
      setBeadPeople((prev) => {
        const next = [...prev];
        next[0] = person;
        return next;
      });
      if (person) {
        const bead0 = beads[0];
        const now = Date.now();
        setCanAdvanceAt(now + ROSARY_MIN_SECONDS_BEFORE_NEXT * 1000);
        setAutoAdvanceAt(
          autoNext && isDecadeHailMary(bead0)
            ? now + getSecondsForBead(bead0) * 1000
            : 0
        );
        setStep("praying");
      } else {
        setError("No one could be assigned. Try again.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, mysterySet, autoNext, fetchAssign, beads, singlePerson, beadCount]);

  // Prefetch next person in background so "Next" has no delay
  // Only prefetch AFTER we've started (currentIndex > 0) to avoid showing names before they're prayed for
  useEffect(() => {
    if (step !== "praying") return;
    if (currentIndex === 0) return; // Don't prefetch until we've advanced at least once
    const nextIndex = currentIndex + 1;
    if (nextIndex >= beadCount) return;
    if (beadPeople[nextIndex] != null) return;
    let cancelled = false;
    fetchAssign(nextIndex).then((person) => {
      if (cancelled) return;
      setBeadPeople((prev) => {
        if (prev[nextIndex] != null) return prev;
        const next = [...prev];
        next[nextIndex] = person;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [step, currentIndex, beadPeople, fetchAssign, singlePerson, beadCount]);

  // Countdown: "Next" after 8s; optional "Auto-advance" countdown when feature is on
  useEffect(() => {
    if (step !== "praying") return;
    const tick = () => {
      const now = Date.now();
      const toNext = Math.max(0, Math.ceil((canAdvanceAt - now) / 1000));
      const toAuto =
        autoAdvanceAt > 0 ? Math.max(0, Math.ceil((autoAdvanceAt - now) / 1000)) : 0;
      setCountdown(toNext);
      setAutoCountdown(toAuto);
      if (
        autoAdvanceAt > 0 &&
        now >= autoAdvanceAt &&
        !hasAutoAdvancedRef.current
      ) {
        hasAutoAdvancedRef.current = true;
        advanceToNext();
      }
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [step, canAdvanceAt, autoAdvanceAt, advanceToNext]);

  const handleStart = () => {
    const checked = mysteryFormRef.current?.querySelector<HTMLInputElement>(
      'input[name="mystery"]:checked'
    );
    const value = (checked?.value ?? mysterySet) as MysterySet | undefined;
    if (!value || !MYSTERY_SETS.includes(value)) {
      setError("Please select a set of mysteries.");
      return;
    }
    setMysterySet(value);
    setError(null);
    // Reset state for a fresh rosary
    setBeads(getRosaryBeads());
    setBeadCount(ROSARY_BEAD_COUNT);
    setBeadPeople(Array(ROSARY_BEAD_COUNT).fill(null));
    setCurrentIndex(0);
    setDecadeMode(null);
    setStep("loading");
  };

  const handleNext = () => {
    if (step !== "praying" || Date.now() < canAdvanceAt) return;
    advanceToNext();
  };

  const beadStripPeople = beadPeople.map((p) =>
    p ? { firstName: p.firstName, lastInitial: p.lastInitial } : null
  );

  const onMysteryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as MysterySet;
    if (MYSTERY_SETS.includes(value)) setMysterySet(value);
  }, []);

  if (step === "choose_mystery") {
    return (
      <main className="min-h-screen p-8 max-w-lg mx-auto">
        <h1 className="font-serif text-2xl text-primary mb-2">{t("title")}</h1>
        <p className="text-charcoal/80 mb-6">{t("choose-mysteries")}</p>
        <fieldset ref={mysteryFormRef} className="space-y-2 mb-6">
          <legend className="sr-only">{t("choose-mysteries")}</legend>
          {MYSTERY_SETS.map((set) => (
            <label
              key={set}
              className={`flex items-center gap-3 w-full rounded-lg border-2 px-4 py-3 cursor-pointer transition ${
                mysterySet === set
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-charcoal/20 text-charcoal hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="mystery"
                value={set}
                checked={mysterySet === set}
                onChange={onMysteryChange}
                className="w-4 h-4 accent-primary flex-shrink-0"
              />
              <span className="flex-1">{t(set)}</span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={autoNext}
            onChange={(e) => setAutoNext(e.target.checked)}
            className="w-4 h-4 accent-primary flex-shrink-0 rounded"
          />
          <span className="text-charcoal/90">{t("auto-next")}</span>
        </label>
        <p className="text-charcoal/60 text-sm mb-4">{t("auto-next-description")}</p>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition"
        >
          {t("start")}
        </button>
      </main>
    );
  }

  if (step === "loading") {
    return (
      <main className="min-h-screen p-8 flex flex-col items-center justify-center">
        <p className="text-charcoal/80">{t("loading")}</p>
      </main>
    );
  }

  if (step === "error") {
    return (
      <main className="min-h-screen p-8 flex flex-col items-center justify-center max-w-md text-center">
        <p className="text-charcoal/80 mb-6">{error}</p>
        <Link href="/pray/rosary" className="rounded-lg bg-primary px-6 py-3 text-cream font-medium">
          Try again
        </Link>
      </main>
    );
  }

  if (step === "praying" || step === "submitting") {
    const bead = beads[currentIndex];
    const person = beadPeople[currentIndex];
    const prayerKey = getPrayerTextKey(bead.label);
    const canNext = step === "praying" && Date.now() >= canAdvanceAt;

    return (
      <main className="min-h-screen flex flex-col max-w-lg mx-auto bg-cream pb-32">
        <div className="flex-shrink-0 p-4 pb-3">
          <RosaryBeadStrip
            beads={beadStripPeople}
            beadStructure={beads}
            currentIndex={currentIndex}
            total={beadCount}
            hideNames={!!singlePerson}
          />
        </div>
        <div className="flex-shrink-0 px-4 pb-3">
          {mysterySet && (decadeMode || currentIndex >= 7) && (
            <p className="text-primary font-serif text-base mb-1" aria-live="polite">
              {t(`${mysterySet}-${decadeMode ? decadeMode.decade : getCurrentDecade(currentIndex)}`)}
            </p>
          )}
          <p className="text-charcoal/60 text-sm mb-2">
            Prayer {currentIndex + 1} of {beadCount}
          </p>
          {person && (
            <div className="mb-3">
              <p className="font-serif text-xl text-primary leading-snug">
                {t("prayer-for", {
                  firstName: person.firstName,
                  lastInitial: person.lastInitial,
                })}
              </p>
              <p className="text-charcoal/70 text-base leading-snug mt-1">
                Died {person.yearOfDeath} · {person.cemetery.name}, {person.cemetery.city}
              </p>
            </div>
          )}
        </div>
        <div className="flex-1 px-4 pb-4">
          <div className="rounded-lg bg-cream/30 border border-charcoal/10 p-5">
            <p className="text-charcoal whitespace-pre-wrap font-serif leading-relaxed text-lg">
              {tPrayers(prayerKey)}
            </p>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-cream border-t border-charcoal/10 px-4 pt-3 pb-6 shadow-lg">
          {error && <p className="text-red-600 text-sm mb-2 text-center">{error}</p>}
          {step === "praying" && (
            <>
              {countdown > 0 && (
                <p className="text-charcoal/70 text-sm mb-2 text-center">{t("next-in", { seconds: countdown })}</p>
              )}
              {countdown === 0 && autoCountdown > 0 && (
                <p className="text-charcoal/60 text-sm mb-2 text-center">{t("auto-advance-in", { seconds: autoCountdown })}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExitModal(true)}
                  className="flex-1 rounded-lg border-2 border-charcoal/30 px-4 py-3 text-charcoal font-medium hover:bg-charcoal/5 transition text-center"
                >
                  Exit
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canNext}
                  className="flex-1 rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("next")}
                </button>
              </div>
            </>
          )}
          {step === "submitting" && (
            <p className="text-charcoal/80 text-center py-3 text-base">{t("recording")}</p>
          )}
        </div>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50" aria-modal="true" role="dialog">
            <div className="bg-cream rounded-lg shadow-lg max-w-sm w-full p-6">
              <p className="font-serif text-lg text-charcoal mb-4">Are you sure you want to exit? Your progress will not be saved.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 rounded-lg border-2 border-charcoal/30 px-4 py-3 text-charcoal font-medium hover:bg-charcoal/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem(ROSARY_SINGLE_PERSON_KEY);
                      sessionStorage.removeItem(ROSARY_DECADE_KEY);
                    } catch {
                      // ignore
                    }
                    setShowExitModal(false);
                    router.push("/");
                  }}
                  className="flex-1 rounded-lg bg-primary px-4 py-3 text-cream font-medium hover:opacity-90 transition"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  if (step === "summary") {
    const prayedFor = beadPeople.filter((p): p is AssignData => p !== null);
    return (
      <main className="min-h-screen p-8 max-w-lg mx-auto flex flex-col">
        <h2 className="font-serif text-2xl text-primary mb-2">
          {t("summary-title", { count: prayedFor.length })}
        </h2>
        <p className="text-charcoal/80 mb-6">{t("summary-subtitle")}</p>
        <ul className="flex flex-col gap-2 mb-8 max-h-96 overflow-y-auto">
          {prayedFor.map((p, i) => (
            <li key={i} className="text-charcoal/90">
              {p.firstName} {p.lastInitial}., {p.yearOfDeath}
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition text-center"
        >
          {t("done")}
        </Link>
      </main>
    );
  }

  return null;
}
