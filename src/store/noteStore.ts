import { create } from "zustand";
import { createNotes, type HitEffect, type JudgmentKind, type Note } from "../game/judgment";

const MAX_EFFECTS = 12;

type NoteState = {
  notes: Note[];
  effects: HitEffect[];
  resetNotes: () => void;
  recordJudgment: (kind: JudgmentKind, lane: number, startedAt: number) => void;
};

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  effects: [],
  // 히트와 이펙트 배열은 같은 객체를 직접 바꿉니다.
  resetNotes: () =>
    set({
      notes: createNotes(),
      effects: [],
    }),
  recordJudgment: (kind, lane, startedAt) => {
    const effects = get().effects;
    effects.push({ kind, lane, startedAt });
    if (effects.length > MAX_EFFECTS) effects.shift();
  },
}));
