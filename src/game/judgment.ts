import { CHART, JUDGE_LINE_Y, NOTE_SPEED, STAGE_HEIGHT } from "./playfield";

export type Note = {
  targetTime: number;
  spawnTime: number;
  lane: number;
  hit: boolean;
};

export type JudgmentKind = "perfect" | "good" | "bad" | "miss";

export type Judgment = {
  text: string;
  color: string;
};

const PERFECT_WINDOW = 0.05;
const GOOD_WINDOW = 0.15;
const HIT_WINDOW = 0.3;

export const JUDGMENT_LABEL: Record<JudgmentKind, string> = {
  perfect: "PERFECT!",
  good: "GOOD",
  bad: "BAD",
  miss: "MISS",
};

export const JUDGMENT_CSS: Record<JudgmentKind, string> = {
  perfect: "#00ffcc",
  good: "#ffcc00",
  bad: "#ff5500",
  miss: "red",
};

export const EMPTY_JUDGMENT: Judgment = { text: "-", color: "white" };

export function createNotes(): Note[] {
  const spawnOffset = JUDGE_LINE_Y / NOTE_SPEED;
  return CHART.map((chartNote) => ({
    targetTime: chartNote.time,
    spawnTime: chartNote.time - spawnOffset,
    lane: chartNote.lane,
    hit: false,
  }));
}

export function noteTravelY(elapsedTime: number, spawnTime: number) {
  return (elapsedTime - spawnTime) * NOTE_SPEED;
}

export function isPastStage(noteY: number) {
  return noteY > STAGE_HEIGHT;
}

export function findNearestUnhitNote(notes: readonly Note[], lane: number, elapsedTime: number) {
  let note: Note | null = null;
  let diff = Infinity;

  for (const candidate of notes) {
    if (candidate.hit || candidate.lane !== lane) continue;
    const candidateDiff = Math.abs(elapsedTime - candidate.targetTime);
    if (candidateDiff < diff) {
      diff = candidateDiff;
      note = candidate;
    }
  }

  if (!note) return null;
  return { note, diff };
}

export function judgeTiming(diff: number): JudgmentKind | null {
  if (diff >= HIT_WINDOW) return null;
  if (diff <= PERFECT_WINDOW) return "perfect";
  if (diff <= GOOD_WINDOW) return "good";
  return "bad";
}

export function judgmentOf(kind: JudgmentKind): Judgment {
  return { text: JUDGMENT_LABEL[kind], color: JUDGMENT_CSS[kind] };
}
