"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { PrayerType } from "@/lib/types";
import { PRAY_MINIMUM_SECONDS } from "@/config/constants";

const PRAYER_TYPES: PrayerType[] = [
  "our_father",
  "hail_mary",
  "decade_rosary",
  "full_rosary",
  "mass",
  "divine_mercy_chaplet",
  "other",
];

type AssignData = {
  personId: string;
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: string;
  cemetery: { cemeteryId: string; name: string; city: string; state: string };
};

type FlowState =
  | "loading"
  | "assign_error"
  | "choose_type"
  | "praying"
  | "submitting"
  | "thank_you";

const SESSION_COUNT_KEY = "deluge_session_pray_count";

function getSessionPrayCount(): number {
  if (typeof window === "undefined") return 0;
  const s = sessionStorage.getItem(SESSION_COUNT_KEY);
  return s ? Math.max(0, parseInt(s, 10)) : 0;
}

function incrementSessionPrayCount(): number {
  const n = getSessionPrayCount() + 1;
  sessionStorage.setItem(SESSION_COUNT_KEY, String(n));
  return n;
}

export default function PrayPage() {
  const { t } = useTranslation("pray");
  const { t: tPrayers } = useTranslation("prayers");
  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [assignData, setAssignData] = useState<AssignData | null>(null);
  const [selectedType, setSelectedType] = useState<PrayerType | null>(null);
  const [assignError, setAssignError] = useState<{ message: string; retryAfterSeconds?: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [canFinishAt, setCanFinishAt] = useState<number>(0);
  const [finishCountdown, setFinishCountdown] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

  const fetchAssign = useCallback(async () => {
    setFlowState("loading");
    setAssignError(null);
    try {
      const res = await fetch("/api/assign");
      const json = await res.json();
      if (!res.ok) {
        setAssignError({
          message: json?.error?.message ?? t("error-no-candidates"),
          retryAfterSeconds: json?.error?.retryAfterSeconds,
        });
        setFlowState("assign_error");
        return;
      }
      if (json.success && json.data) {
        setAssignData(json.data);
        setSelectedType(null);
        setFlowState("choose_type");
      } else {
        setAssignError({ message: t("error-no-candidates") });
        setFlowState("assign_error");
      }
    } catch {
      setAssignError({ message: t("error-no-candidates") });
      setFlowState("assign_error");
    }
  }, [t]);

  useEffect(() => {
    fetchAssign();
  }, [fetchAssign]);

  // 15s countdown: enable Finish after PRAY_MINIMUM_SECONDS; tick every second for display
  useEffect(() => {
    if (flowState !== "praying") return;
    const deadline = Date.now() + PRAY_MINIMUM_SECONDS * 1000;
    setCanFinishAt(deadline);
    setFinishCountdown(PRAY_MINIMUM_SECONDS);
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setFinishCountdown(remaining);
      if (remaining <= 0) setCanFinishAt(0);
    }, 500);
    return () => clearInterval(interval);
  }, [flowState]);

  const handleStart = useCallback(() => {
    if (selectedType) setFlowState("praying");
  }, [selectedType]);

  const handleFinish = useCallback(async () => {
    if (!assignData || !selectedType) return;
    if (Date.now() < canFinishAt) return;
    setFlowState("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/pray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: assignData.personId, prayerType: selectedType }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json?.error?.message ?? t("error-submit"));
        setFlowState("praying");
        return;
      }
      setSessionCount(incrementSessionPrayCount());
      setFlowState("thank_you");
    } catch {
      setSubmitError(t("error-submit"));
      setFlowState("praying");
    }
  }, [assignData, selectedType, canFinishAt, t]);

  const handlePrayForAnother = useCallback(() => {
    fetchAssign();
  }, [fetchAssign]);

  const roleLabel = assignData ? t(`role-${assignData.role}` as "role-priest") : "";

  if (flowState === "loading") {
    return (
      <main className="min-h-screen p-8 flex flex-col items-center justify-center">
        <p className="text-charcoal/80">{t("loading")}</p>
      </main>
    );
  }

  if (flowState === "assign_error") {
    return (
      <main className="min-h-screen p-8 flex flex-col items-center justify-center max-w-md mx-auto text-center">
        <p className="text-charcoal/80 mb-6">{assignError?.message}</p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={fetchAssign}
            className="rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition"
          >
            {t("try-again")}
          </button>
          <Link
            href="/"
            className="rounded-lg border-2 border-primary px-6 py-3 text-primary font-medium hover:bg-primary/5 transition"
          >
            {t("done")}
          </Link>
        </div>
      </main>
    );
  }

  if (flowState === "choose_type" && assignData) {
    return (
      <main className="min-h-screen p-8 max-w-lg mx-auto">
        <h1 className="font-serif text-2xl text-primary mb-2">{t("title")}</h1>
        <p className="text-charcoal/80 mb-2">
          {t("person-line", {
            firstName: assignData.firstName,
            lastInitial: assignData.lastInitial,
            year: assignData.yearOfDeath,
            role: roleLabel,
          })}
        </p>
        <p className="text-charcoal/60 text-sm mb-6">
          {t("cemetery-line", {
            cemeteryName: assignData.cemetery.name,
            city: assignData.cemetery.city,
            state: assignData.cemetery.state,
          })}
        </p>
        <p className="font-medium text-charcoal mb-3">{t("choose-how")}</p>
        <ul className="space-y-2 mb-6">
          {PRAYER_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => setSelectedType(type)}
                className={`w-full text-left rounded-lg border-2 px-4 py-3 transition ${
                  selectedType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-charcoal/20 text-charcoal hover:border-primary/50"
                }`}
              >
                {t(`prayer-type-${type}`)}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedType}
          className="w-full rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("start")}
        </button>
      </main>
    );
  }

  if (flowState === "praying" && assignData && selectedType) {
    const finishEnabled = canFinishAt === 0;

    return (
      <main className="min-h-screen p-8 max-w-lg mx-auto flex flex-col">
        <p className="text-charcoal/80 mb-4">
          {t("person-line", {
            firstName: assignData.firstName,
            lastInitial: assignData.lastInitial,
            year: assignData.yearOfDeath,
            role: roleLabel,
          })}
        </p>
        <div className="rounded-lg bg-cream/30 border border-charcoal/10 p-6 mb-6 flex-1">
          <p className="text-charcoal whitespace-pre-wrap font-serif leading-relaxed">
            {tPrayers(selectedType)}
          </p>
        </div>
        {submitError && <p className="text-red-600 text-sm mb-2">{submitError}</p>}
        {canFinishAt > 0 && finishCountdown > 0 ? (
          <p className="text-charcoal/70 text-sm mb-2">{t("finish-available-in", { seconds: finishCountdown })}</p>
        ) : null}
        <button
          type="button"
          onClick={handleFinish}
          disabled={!finishEnabled}
          className="w-full rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("finish")}
        </button>
      </main>
    );
  }

  if (flowState === "submitting") {
    return (
      <main className="min-h-screen p-8 flex flex-col items-center justify-center">
        <p className="text-charcoal/80">{t("recording")}</p>
      </main>
    );
  }

  if (flowState === "thank_you" && assignData) {
    return (
      <main className="min-h-screen p-8 max-w-lg mx-auto flex flex-col items-center text-center">
        <h2 className="font-serif text-2xl text-primary mb-4">
          {t("thank-you", {
            firstName: assignData.firstName,
            lastInitial: assignData.lastInitial,
          })}
        </h2>
        {sessionCount > 0 && (
          <p className="text-charcoal/80 mb-6">
            {t("you-prayed-count", { count: sessionCount })}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrayForAnother}
            className="rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition"
          >
            {t("pray-for-another")}
          </button>
          <Link
            href="/"
            className="rounded-lg border-2 border-primary px-6 py-3 text-primary font-medium hover:bg-primary/5 transition text-center"
          >
            {t("done")}
          </Link>
        </div>
      </main>
    );
  }

  return null;
}
