export const STAGE_WIDTH = 460;
export const STAGE_HEIGHT = 600;
export const JUDGE_LINE_Y = 500;
export const NOTE_SPEED = 400;
export const NOTE_WIDTH = 44;
export const NOTE_HEIGHT = 18;
export const LANE_WIDTH = 78;
export const LANE_GAP = 10;

export const LANE_DEFS = [
  { key: "d", label: "D", color: 0x3dffe8, stops: [0xb8fff4, 0x14c8b8, 0x067068] },
  { key: "f", label: "F", color: 0xff4d88, stops: [0xffb3cc, 0xff2266, 0xb00045] },
  { key: "j", label: "J", color: 0xffcc00, stops: [0xffe7a3, 0xffb400, 0xc47a00] },
  { key: "k", label: "K", color: 0x7aa2ff, stops: [0xd4e0ff, 0x4d74ff, 0x243eaa] },
] as const;

export const PLAYFIELD_WIDTH = LANE_DEFS.length * LANE_WIDTH + (LANE_DEFS.length - 1) * LANE_GAP;
export const PLAYFIELD_X = (STAGE_WIDTH - PLAYFIELD_WIDTH) / 2;

const NOTE_TIMINGS = [1.0, 2.0, 3.0, 4.5, 5.0, 6.0, 7.5, 8.0, 9.0];

export const CHART = NOTE_TIMINGS.map((time, index) => ({
  time,
  lane: index % LANE_DEFS.length,
}));

export function laneLeft(lane: number) {
  return PLAYFIELD_X + lane * (LANE_WIDTH + LANE_GAP);
}

export function noteLeft(lane: number) {
  return laneLeft(lane) + (LANE_WIDTH - NOTE_WIDTH) / 2;
}

export function receptorX(lane: number) {
  return noteLeft(lane) + NOTE_WIDTH / 2;
}

export function laneIndexFromKey(key: string) {
  return LANE_DEFS.findIndex((item) => item.key === key.toLowerCase());
}
