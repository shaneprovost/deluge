"use client";

import { useEffect, useRef } from "react";
import type { RosaryBead, VisualBead } from "@/lib/rosary";
import { getVisualBeads } from "@/lib/rosary";

type BeadPerson = { firstName: string; lastInitial: string } | null;

interface RosaryBeadStripProps {
  beads: BeadPerson[];
  beadStructure: RosaryBead[];
  currentIndex: number;
  total: number;
  /** When true (e.g. single-person rosary), show only color highlight, no names on beads. */
  hideNames?: boolean;
}

/** Whether this visual bead should have a gap after it (triple = between decades). */
function showGapAfter(v: VisualBead): boolean {
  return v.type === "triple";
}

function SingleBead({
  person,
  isCurrent,
  isCompleted,
  setRef,
  hideNames,
}: {
  person: BeadPerson;
  isCurrent: boolean;
  isCompleted: boolean;
  setRef?: (el: HTMLDivElement | null) => void;
  hideNames?: boolean;
}) {
  const label = person ? `${person.firstName} ${person.lastInitial}.` : "—";
  return (
    <div
      ref={setRef ?? undefined}
      className={`
        rounded-full flex items-center justify-center text-center font-medium
        transition-all duration-300 ease-out shrink-0 snap-center
        ${isCurrent ? "scale-110 bg-primary text-cream px-2.5 py-1.5 text-xs min-w-[3.25rem]" : ""}
        ${isCompleted ? "scale-90 bg-primary/35 text-primary px-2 py-1 text-[0.65rem] min-w-[2.75rem]" : ""}
        ${!isCurrent && !isCompleted ? "scale-75 bg-charcoal/15 text-charcoal/50 px-2 py-1 text-[0.65rem] min-w-[2rem]" : ""}
        ${hideNames ? "min-w-[1.5rem] w-6 h-6 min-h-[1.5rem] px-0 py-0" : ""}
      `}
      title={hideNames ? undefined : label}
    >
      {!hideNames && <span className="truncate max-w-[2.75rem]">{label}</span>}
    </div>
  );
}

function TripleBead({
  beads,
  indices,
  currentIndex,
  setRef,
  hideNames,
}: {
  beads: BeadPerson[];
  indices: [number, number, number];
  currentIndex: number;
  setRef?: (el: HTMLDivElement | null) => void;
  hideNames?: boolean;
}) {
  const [i0, i1, i2] = indices;
  const completed = currentIndex > i2 ? 3 : currentIndex > i1 ? 2 : currentIndex > i0 ? 1 : 0;
  const currentSegment = currentIndex === i0 ? 0 : currentIndex === i1 ? 1 : currentIndex === i2 ? 2 : -1;
  const segmentIndex: 0 | 1 | 2 | null = currentSegment >= 0 ? (currentSegment as 0 | 1 | 2) : null;
  const showPerson = segmentIndex !== null ? beads[indices[segmentIndex]] : beads[i2];
  const label = showPerson ? `${showPerson.firstName} ${showPerson.lastInitial}.` : "—";

  return (
    <div
      ref={setRef ?? undefined}
      className="flex flex-col items-center shrink-0 snap-center"
      title={hideNames ? undefined : label}
    >
      <div className="flex rounded-full overflow-hidden border border-charcoal/20 bg-charcoal/10 min-w-[2.5rem] w-14 h-8">
        {[0, 1, 2].map((seg) => {
          const isDone = seg < completed;
          const isCurrent = seg === currentSegment;
          return (
            <div
              key={seg}
              className={`
                flex-1 min-w-0 transition-all duration-300
                ${isCurrent ? "bg-primary" : ""}
                ${isDone && !isCurrent ? "bg-primary/35" : ""}
                ${!isDone && !isCurrent ? "bg-charcoal/15" : ""}
              `}
              aria-hidden
            />
          );
        })}
      </div>
      {!hideNames && (currentSegment >= 0 || completed > 0) && (
        <span
          className={`
            text-[0.6rem] mt-0.5 truncate max-w-[3.5rem] text-center block
            ${currentSegment >= 0 ? "text-primary font-medium" : "text-primary/80"}
          `}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function RosaryBeadStrip({
  beads,
  beadStructure,
  currentIndex,
  total,
  hideNames = false,
}: RosaryBeadStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentBeadRef = useRef<HTMLDivElement | null>(null);

  const visualBeads = getVisualBeads(beadStructure);

  useEffect(() => {
    if (currentIndex < 0 || !scrollRef.current || !currentBeadRef.current) return;
    currentBeadRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex]);

  const setCurrentRef = (el: HTMLDivElement | null) => {
    currentBeadRef.current = el;
  };

  return (
    <div
      ref={scrollRef}
      className="flex items-center overflow-x-auto overflow-y-hidden py-3 gap-1.5 scroll-smooth snap-x snap-mandatory"
      style={{ scrollPaddingInline: "50%" }}
    >
      {visualBeads.map((v, visualIndex) => {
        if (v.type === "single") {
          const i = v.index;
          const isCurrent = i === currentIndex;
          const isCompleted = i < currentIndex;
          const addGap = showGapAfter(v);
          return (
            <div key={`s-${i}`} className="flex items-center gap-1.5 shrink-0">
              <SingleBead
                person={beads[i]}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                setRef={isCurrent ? setCurrentRef : undefined}
                hideNames={hideNames}
              />
              {addGap && <span className="w-3 shrink-0" aria-hidden />}
            </div>
          );
        }
        const [i0, i1, i2] = v.indices;
        const isCurrent = currentIndex >= i0 && currentIndex <= i2;
        const addGap = showGapAfter(v);
        return (
          <div key={`t-${i0}`} className="flex items-center gap-1.5 shrink-0">
            <TripleBead
              beads={beads}
              indices={v.indices}
              currentIndex={currentIndex}
              setRef={isCurrent ? setCurrentRef : undefined}
              hideNames={hideNames}
            />
            {addGap && <span className="w-3 shrink-0" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
