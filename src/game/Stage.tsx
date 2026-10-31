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
  type JudgmentKind,
  type Note,
} from "./judgment";
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

const RECEPTOR_Y = JUDGE_LINE_Y + NOTE_HEIGHT / 2;
const LANE_PRESS_DURATION = 0.18;

export type HitEffect = {
  kind: JudgmentKind;
  lane: number;
  startedAt: number;
};

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

const EFFECT_STYLE: Record<
  JudgmentKind,
  { color: number; sparks: number; ring: number; flash: number }
> = {
  perfect: { color: 0x7dffe8, sparks: 8, ring: 28, flash: 0.42 },
  good: { color: 0xffcc00, sparks: 6, ring: 20, flash: 0.28 },
  bad: { color: 0xff5500, sparks: 5, ring: 14, flash: 0.2 },
  miss: { color: 0xff3355, sparks: 0, ring: 12, flash: 0.36 },
};

const judgmentTextStyle = new TextStyle({
  fontFamily: "sans-serif",
  fontSize: 24,
  fontWeight: "bold",
  fill: 0xffffff,
  align: "center",
  dropShadow: {
    color: "#000000",
    alpha: 0.7,
    blur: 4,
    distance: 0,
  },
});

function drawEmpty(graphics: Graphics) {
  graphics.clear();
}

function drawBurst(graphics: Graphics, effect: HitEffect, age: number) {
  const style = EFFECT_STYLE[effect.kind];
  const originX = receptorX(effect.lane);
  const left = laneLeft(effect.lane);
  const t = Math.min(age / EFFECT_DURATION[effect.kind], 1);
  const fade = 1 - t;
  const expand = 1 - (1 - t) ** 3;

  graphics.rect(left, JUDGE_LINE_Y - 18, LANE_WIDTH, 54).fill({
    color: style.color,
    alpha: fade * style.flash,
  });

  graphics.circle(originX, RECEPTOR_Y, 6 + expand * style.ring).stroke({
    width: 2 + fade * 2,
    color: style.color,
    alpha: fade * 0.95,
  });

  if (effect.kind === "perfect") {
    graphics.circle(originX, RECEPTOR_Y, 12 * fade).fill({ color: 0xffffff, alpha: fade * 0.85 });
    graphics.circle(originX, RECEPTOR_Y, 4 + expand * 16).stroke({
      width: 2,
      color: 0xffffff,
      alpha: fade * 0.75,
    });
  }

  if (effect.kind === "miss") {
    const size = 8 + expand * 5;
    graphics
      .moveTo(originX - size, RECEPTOR_Y - size)
      .lineTo(originX + size, RECEPTOR_Y + size)
      .stroke({ width: 4, color: style.color, alpha: fade });
    graphics
      .moveTo(originX + size, RECEPTOR_Y - size)
      .lineTo(originX - size, RECEPTOR_Y + size)
      .stroke({ width: 4, color: style.color, alpha: fade });
    return;
  }

  if (effect.kind === "bad") {
    for (let index = 0; index < style.sparks; index += 1) {
      const spread = (index - (style.sparks - 1) / 2) * 8;
      graphics.circle(originX + spread, RECEPTOR_Y + 8 + expand * 24, 2.2).fill({
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
      .circle(originX + Math.cos(angle) * distance, RECEPTOR_Y + Math.sin(angle) * distance, 2.6)
      .fill({
        color: index % 2 === 0 ? 0xffffff : style.color,
        alpha: fade,
      });
  }
}

type NoteFieldProps = {
  audioContextRef: RefObject<AudioContext | null>;
  startTimeRef: RefObject<number>;
  notesRef: RefObject<Note[]>;
  effectsRef: RefObject<HitEffect[]>;
  onMiss: (lane: number) => void;
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
      graphics.rect(left, JUDGE_LINE_Y - 24, LANE_WIDTH, 48).fill({
        color: 0xffffff,
        alpha: fade * 0.28,
      });
    }
  }, [pressesRef]);

  useTick(updatePresses);

  return <pixiGraphics ref={graphicsRef} draw={drawEmpty} />;
});

const EffectLayer = memo(function EffectLayer({
  audioContextRef,
  startTimeRef,
  effectsRef,
}: Pick<NoteFieldProps, "audioContextRef" | "startTimeRef" | "effectsRef">) {
  const graphicsRef = useRef<Graphics | null>(null);
  const labelRef = useRef<Text | null>(null);
  const shownKindRef = useRef<JudgmentKind | null>(null);

  const updateEffects = useCallback(() => {
    const audioContext = audioContextRef.current;
    const graphics = graphicsRef.current;
    if (!audioContext || !graphics) return;

    const elapsedTime = audioContext.currentTime - startTimeRef.current;
    const effects = effectsRef.current;

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

    const label = labelRef.current;
    const latest = effects[effects.length - 1];
    if (!label) return;

    if (!latest) {
      label.alpha = 0;
      shownKindRef.current = null;
      return;
    }

    if (shownKindRef.current !== latest.kind) {
      shownKindRef.current = latest.kind;
      label.text = JUDGMENT_LABEL[latest.kind];
      label.style.fill = EFFECT_STYLE[latest.kind].color;
    }

    const age = elapsedTime - latest.startedAt;
    const progress = Math.min(age / EFFECT_DURATION[latest.kind], 1);
    const fade = 1 - progress;
    const expand = 1 - (1 - progress) ** 3;
    const pop = Math.min(progress / 0.18, 1);
    label.alpha = progress < 0.12 ? progress / 0.12 : fade;
    label.scale.set(0.72 + pop * 0.28);
    label.position.set(receptorX(latest.lane), JUDGE_LINE_Y - 46 - expand * 28);
  }, [audioContextRef, effectsRef, startTimeRef]);

  useTick({
    callback: updateEffects,
    priority: UPDATE_PRIORITY.LOW,
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={graphicsRef} draw={drawEmpty} />
      <pixiText
        ref={(node) => {
          labelRef.current = node;
          node?.anchor.set(0.5);
        }}
        text=""
        x={STAGE_WIDTH / 2}
        y={JUDGE_LINE_Y - 46}
        alpha={0}
        style={judgmentTextStyle}
      />
    </pixiContainer>
  );
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
    graphics
      .roundRect(noteLeft(lane) - 4, JUDGE_LINE_Y - 2, NOTE_WIDTH + 8, NOTE_HEIGHT + 4, 8)
      .stroke({ width: 2, color: LANE_DEFS[lane].color, alpha: 0.95 });
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
  notesRef,
  effectsRef,
  onMiss,
}: NoteFieldProps) {
  const noteGraphicsRef = useRef<Array<Graphics | null>>([]);

  const updateNotes = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const elapsedTime = audioContext.currentTime - startTimeRef.current;

    notesRef.current.forEach((note, index) => {
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
        onMiss(note.lane);
        return;
      }

      graphic.visible = true;
      graphic.position.set(noteLeft(note.lane), noteY);
    });
  }, [audioContextRef, notesRef, onMiss, startTimeRef]);

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
      <EffectLayer
        audioContextRef={audioContextRef}
        startTimeRef={startTimeRef}
        effectsRef={effectsRef}
      />
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
  notesRef,
  effectsRef,
  pressesRef,
  onMiss,
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
        <NoteField
          audioContextRef={audioContextRef}
          startTimeRef={startTimeRef}
          notesRef={notesRef}
          effectsRef={effectsRef}
          onMiss={onMiss}
        />
      ) : null}
    </Application>
  );
});
