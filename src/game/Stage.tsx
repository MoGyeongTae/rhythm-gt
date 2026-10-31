import { Application, extend, useTick } from "@pixi/react";
import {
  Container,
  FillGradient,
  Graphics,
  Text,
  TextStyle,
  UPDATE_PRIORITY,
} from "pixi.js";
import { memo, useCallback, useRef, type RefObject } from "react";
import {
  JUDGMENT_LABEL,
  isPastStage,
  noteTravelY,
  type HitEffect,
  type JudgmentKind,
} from "./judgment";
import { useNoteStore } from "../store/noteStore";
import {
  CHART,
  JUDGE_LINE_Y,
  LANE_DEFS,
  LANE_WIDTH,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  PLAYFIELD_WIDTH,
  PLAYFIELD_X,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  laneLeft,
  noteLeft,
  receptorX,
} from "./playfield";

extend({ Container, Graphics, Text });

const stageFill = new FillGradient({
  type: "linear",
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: 0x2a1840 },
    { offset: 0.5, color: 0x14141f },
    { offset: 1, color: 0x07070c },
  ],
});

const noteFills = LANE_DEFS.map(
  (lane) =>
    new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: lane.stops[0] },
        { offset: 0.45, color: lane.stops[1] },
        { offset: 1, color: lane.stops[2] },
      ],
    }),
);

const laneLabelStyles = LANE_DEFS.map(
  (lane) =>
    new TextStyle({
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: "bold",
      fill: lane.color,
    }),
);

const LANE_PRESS_DURATION = 0.18;

export type LanePress = {
  lane: number;
  startedAt: number;
};

const EFFECT_DURATION: Record<JudgmentKind, number> = {
  perfect: 0.5,
  good: 0.4,
  bad: 0.34,
  miss: 0.42,
};

const EFFECT_STYLE: Record<JudgmentKind, { color: number; sparks: number; ring: number }> = {
  perfect: { color: 0x7dffe8, sparks: 8, ring: 28 },
  good: { color: 0xffcc00, sparks: 6, ring: 20 },
  bad: { color: 0xff5500, sparks: 5, ring: 14 },
  miss: { color: 0xff3355, sparks: 0, ring: 12 },
};

const judgmentTextStyle = new TextStyle({
  fontFamily: "sans-serif",
  fontSize: 22,
  fontWeight: "bold",
  fill: 0xffffff,
  align: "center",
  dropShadow: {
    color: "#000000",
    alpha: 0.45,
    blur: 3,
    distance: 0,
  },
});

const JUDGMENT_X = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
const JUDGMENT_Y = JUDGE_LINE_Y - 48;

function drawEmpty(graphics: Graphics) {
  graphics.clear();
}

function drawBurst(graphics: Graphics, effect: HitEffect, age: number) {
  const style = EFFECT_STYLE[effect.kind];
  const originX = receptorX(effect.lane);
  const t = Math.min(age / EFFECT_DURATION[effect.kind], 1);
  const fade = 1 - t;
  const expand = 1 - (1 - t) ** 3;

  graphics.circle(originX, JUDGE_LINE_Y, 6 + expand * style.ring).stroke({
    width: 2 + fade * 2,
    color: style.color,
    alpha: fade * 0.95,
  });

  if (effect.kind === "perfect") {
    graphics.circle(originX, JUDGE_LINE_Y, 12 * fade).fill({ color: 0xffffff, alpha: fade * 0.85 });
    graphics.circle(originX, JUDGE_LINE_Y, 4 + expand * 16).stroke({
      width: 2,
      color: 0xffffff,
      alpha: fade * 0.75,
    });
  }

  if (effect.kind === "miss") {
    const size = 8 + expand * 5;
    graphics
      .moveTo(originX - size, JUDGE_LINE_Y - size)
      .lineTo(originX + size, JUDGE_LINE_Y + size)
      .stroke({ width: 4, color: style.color, alpha: fade });
    graphics
      .moveTo(originX + size, JUDGE_LINE_Y - size)
      .lineTo(originX - size, JUDGE_LINE_Y + size)
      .stroke({ width: 4, color: style.color, alpha: fade });
    return;
  }

  if (effect.kind === "bad") {
    for (let index = 0; index < style.sparks; index += 1) {
      const spread = (index - (style.sparks - 1) / 2) * 8;
      graphics.circle(originX + spread, JUDGE_LINE_Y + 8 + expand * 24, 2.2).fill({
        color: style.color,
        alpha: fade,
      });
    }
    return;
  }

  for (let index = 0; index < style.sparks; index += 1) {
    const angle = (Math.PI * 2 * index) / style.sparks - Math.PI / 2;
    const distance = 8 + expand * style.ring;
    graphics
      .circle(originX + Math.cos(angle) * distance, JUDGE_LINE_Y + Math.sin(angle) * distance, 2.6)
      .fill({
        color: index % 2 === 0 ? 0xffffff : style.color,
        alpha: fade,
      });
  }
}

type NoteFieldProps = {
  audioContextRef: RefObject<AudioContext | null>;
  startTimeRef: RefObject<number>;
};

const LaneFlash = memo(function LaneFlash({
  pressesRef,
}: {
  pressesRef: RefObject<LanePress[]>;
}) {
  const graphicsRef = useRef<Graphics | null>(null);

  const updatePresses = useCallback(() => {
    const graphics = graphicsRef.current;
    if (!graphics) return;

    const now = performance.now();
    const presses = pressesRef.current;

    for (let index = presses.length - 1; index >= 0; index -= 1) {
      if ((now - presses[index].startedAt) / 1000 >= LANE_PRESS_DURATION) {
        presses.splice(index, 1);
      }
    }

    graphics.clear();
    for (const press of presses) {
      const fade = 1 - Math.min((now - press.startedAt) / 1000 / LANE_PRESS_DURATION, 1);
      const left = laneLeft(press.lane);
      graphics.rect(left, 0, LANE_WIDTH, STAGE_HEIGHT).fill({
        color: LANE_DEFS[press.lane].color,
        alpha: fade * 0.22,
      });
    }
  }, [pressesRef]);

  useTick(updatePresses);

  return <pixiGraphics ref={graphicsRef} draw={drawEmpty} />;
});

const JudgmentLabel = memo(function JudgmentLabel({
  audioContextRef,
  startTimeRef,
}: NoteFieldProps) {
  const labelRef = useRef<Text | null>(null);
  const shownKindRef = useRef<JudgmentKind | null>(null);

  const updateLabel = useCallback(() => {
    const audioContext = audioContextRef.current;
    const label = labelRef.current;
    if (!audioContext || !label) return;

    const elapsedTime = audioContext.currentTime - startTimeRef.current;
    const effects = useNoteStore.getState().effects;
    const latest = effects[effects.length - 1];

    if (!latest || elapsedTime - latest.startedAt >= EFFECT_DURATION[latest.kind]) {
      label.alpha = 0;
      shownKindRef.current = null;
      return;
    }

    if (shownKindRef.current !== latest.kind) {
      shownKindRef.current = latest.kind;
      label.text = JUDGMENT_LABEL[latest.kind];
      label.style.fill = EFFECT_STYLE[latest.kind].color;
    }

    const progress = Math.min((elapsedTime - latest.startedAt) / EFFECT_DURATION[latest.kind], 1);
    const fade = 1 - progress;
    label.alpha = fade * 0.72;
    label.scale.set(1);
    label.position.set(JUDGMENT_X, JUDGMENT_Y - progress * 8);
  }, [audioContextRef, startTimeRef]);

  useTick(updateLabel);

  return (
    <pixiText
      ref={(node) => {
        labelRef.current = node;
        node?.anchor.set(0.5);
      }}
      text=""
      x={JUDGMENT_X}
      y={JUDGMENT_Y}
      alpha={0}
      style={judgmentTextStyle}
    />
  );
});

const EffectLayer = memo(function EffectLayer({
  audioContextRef,
  startTimeRef,
}: NoteFieldProps) {
  const graphicsRef = useRef<Graphics | null>(null);

  const updateEffects = useCallback(() => {
    const audioContext = audioContextRef.current;
    const graphics = graphicsRef.current;
    if (!audioContext || !graphics) return;

    const elapsedTime = audioContext.currentTime - startTimeRef.current;
    const effects = useNoteStore.getState().effects;

    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];
      if (elapsedTime - effect.startedAt >= EFFECT_DURATION[effect.kind]) {
        effects.splice(index, 1);
      }
    }

    graphics.clear();
    for (const effect of effects) {
      drawBurst(graphics, effect, elapsedTime - effect.startedAt);
    }
  }, [audioContextRef, startTimeRef]);

  useTick({
    callback: updateEffects,
    priority: UPDATE_PRIORITY.LOW,
  });

  return <pixiGraphics ref={graphicsRef} draw={drawEmpty} />;
});

function drawStage(graphics: Graphics) {
  graphics.clear();
  graphics.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill(stageFill);

  for (let lane = 0; lane < LANE_DEFS.length; lane += 1) {
    const left = laneLeft(lane);
    graphics.rect(left, 0, LANE_WIDTH, STAGE_HEIGHT).fill({
      color: 0x05050a,
      alpha: lane % 2 === 0 ? 0.5 : 0.32,
    });
    graphics.rect(left, 0, 2, STAGE_HEIGHT).fill({
      color: LANE_DEFS[lane].color,
      alpha: 0.45,
    });
    graphics.rect(left + LANE_WIDTH - 2, 0, 2, STAGE_HEIGHT).fill({
      color: LANE_DEFS[lane].color,
      alpha: 0.45,
    });
    const receptorHeight = NOTE_HEIGHT + 4;
    graphics
      .roundRect(
        noteLeft(lane) - 4,
        JUDGE_LINE_Y - receptorHeight / 2,
        NOTE_WIDTH + 8,
        receptorHeight,
        8,
      )
      .stroke({ width: 1.5, color: LANE_DEFS[lane].color, alpha: 0.16 });
  }

  graphics.rect(PLAYFIELD_X, JUDGE_LINE_Y - 10, PLAYFIELD_WIDTH, 20).fill({
    color: 0xffffff,
    alpha: 0.05,
  });
  graphics.rect(PLAYFIELD_X, JUDGE_LINE_Y - 1.5, PLAYFIELD_WIDTH, 3).fill({
    color: 0xd8fff6,
  });
}

const drawNotes = noteFills.map((fill) => (graphics: Graphics) => {
  graphics.clear();
  graphics.roundRect(1, 3, NOTE_WIDTH, NOTE_HEIGHT, 7).fill({ color: 0x000000, alpha: 0.35 });
  graphics.roundRect(0, 0, NOTE_WIDTH, NOTE_HEIGHT, 7).fill(fill);
  graphics.roundRect(4, 3, NOTE_WIDTH - 8, 5, 3).fill({ color: 0xffffff, alpha: 0.55 });
});

const NoteField = memo(function NoteField({
  audioContextRef,
  startTimeRef,
}: NoteFieldProps) {
  const noteGraphicsRef = useRef<Array<Graphics | null>>([]);

  const updateNotes = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const elapsedTime = audioContext.currentTime - startTimeRef.current;

    useNoteStore.getState().notes.forEach((note, index) => {
      const graphic = noteGraphicsRef.current[index];
      if (!graphic) return;

      if (elapsedTime < note.spawnTime || note.hit) {
        graphic.visible = false;
        return;
      }

      const noteY = noteTravelY(elapsedTime, note.spawnTime);
      if (isPastStage(noteY)) {
        note.hit = true;
        graphic.visible = false;
        useNoteStore.getState().recordJudgment("miss", note.lane, elapsedTime);
        return;
      }

      graphic.visible = true;
      graphic.position.set(noteLeft(note.lane), noteY);
    });
  }, [audioContextRef, startTimeRef]);

  useTick(updateNotes);

  return (
    <pixiContainer>
      {CHART.map((chartNote, index) => (
        <pixiGraphics
          key={`${chartNote.time}-${chartNote.lane}`}
          ref={(node) => {
            noteGraphicsRef.current[index] = node;
          }}
          draw={drawNotes[chartNote.lane]}
          x={noteLeft(chartNote.lane)}
          visible={false}
        />
      ))}
      <EffectLayer audioContextRef={audioContextRef} startTimeRef={startTimeRef} />
    </pixiContainer>
  );
});

type StageProps = NoteFieldProps & {
  isPlaying: boolean;
  pressesRef: RefObject<LanePress[]>;
};

export const Stage = memo(function Stage({
  isPlaying,
  audioContextRef,
  startTimeRef,
  pressesRef,
}: StageProps) {
  return (
    <Application
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      background={0x07070c}
      antialias
      autoDensity
      resolution={Math.min(globalThis.devicePixelRatio || 1, 2)}
      className="rhythm-stage"
    >
      <pixiGraphics draw={drawStage} />
      <LaneFlash pressesRef={pressesRef} />
      <JudgmentLabel audioContextRef={audioContextRef} startTimeRef={startTimeRef} />
      <pixiContainer>
        {LANE_DEFS.map((lane, index) => (
          <pixiText
            key={lane.key}
            ref={(node) => {
              node?.anchor.set(0.5);
            }}
            text={lane.label}
            x={receptorX(index)}
            y={26}
            alpha={0.9}
            style={laneLabelStyles[index]}
          />
        ))}
      </pixiContainer>
      {isPlaying ? (
        <NoteField audioContextRef={audioContextRef} startTimeRef={startTimeRef} />
      ) : null}
    </Application>
  );
});
