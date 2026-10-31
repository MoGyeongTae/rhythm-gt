import { create } from "zustand";
import { createNotes, type Note } from "../game/judgment";

type NoteState = {
  notes: Note[];
  resetNotes: () => void;
};

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  // 히트는 이 배열의 노트 객체에 직접 표시합니다. resetNotes만 새 배열을 발행합니다.
  resetNotes: () => set({ notes: createNotes() }),
}));
