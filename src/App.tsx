import { useEffect, useRef, useState } from "react";
import { Stage, type LanePress } from "./game/Stage";
import { findNearestUnhitNote, judgeTiming } from "./game/judgment";
import { laneIndexFromKey } from "./game/playfield";
import { useNoteStore } from "./store/noteStore";

export default function RhythmGame() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef(0);
  const pressesRef = useRef<LanePress[]>([]);

  const initAudio = async () => {
    setIsLoading(true);
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;

      const response = await fetch("/music.mp3");
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      audioBufferRef.current = decodedBuffer;
      setIsLoading(false);
      startGame();
    } catch (err) {
      console.error(err);
      alert(
        "오디오 파일을 로드하는 데 실패했습니다. public 폴더에 music.mp3가 있는지 확인하세요.",
      );
      setIsLoading(false);
    }
  };

  const startGame = () => {
    const audioContext = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!audioContext || !buffer) return;

    useNoteStore.getState().resetNotes();

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    pressesRef.current = [];
    startTimeRef.current = audioContext.currentTime;
    source.start(0);
    setIsPlaying(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const lane = laneIndexFromKey(event.key);
      if (lane < 0) return;

      pressesRef.current.push({ lane, startedAt: performance.now() });
      if (pressesRef.current.length > 8) {
        pressesRef.current.shift();
      }

      const audioContext = audioContextRef.current;
      if (!isPlaying || !audioContext) return;

      const elapsedTime = audioContext.currentTime - startTimeRef.current;
      const nearest = findNearestUnhitNote(useNoteStore.getState().notes, lane, elapsedTime);
      if (!nearest) return;

      const kind = judgeTiming(nearest.diff);
      if (!kind) return;

      nearest.note.hit = true;
      useNoteStore.getState().recordJudgment(kind, lane, elapsedTime);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  return (
    <div
      style={{
        backgroundColor: "#111",
        color: "white",
        textAlign: "center",
        fontFamily: "sans-serif",
        padding: "20px",
      }}
    >
      <h1>React 리듬게임 싱크 데모</h1>
      <p>D F J K 키로 네 레인의 노트를 타이밍에 맞춰 맞추세요!</p>

      {!isPlaying && (
        <button
          onClick={initAudio}
          disabled={isLoading}
          style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
        >
          {isLoading ? "로딩 중..." : "게임 시작 (음악 로드)"}
        </button>
      )}

      <Stage
        isPlaying={isPlaying}
        audioContextRef={audioContextRef}
        startTimeRef={startTimeRef}
        pressesRef={pressesRef}
      />
    </div>
  );
}
