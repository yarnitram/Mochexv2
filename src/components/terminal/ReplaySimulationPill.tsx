"use client";

import React, { useEffect, useState } from "react";
import { replayEngine, ReplayState } from "@/lib/replay/replay-engine";
import { Play, Pause, SkipForward, SkipBack, X, Scissors, Gauge } from "lucide-react";

interface ReplaySimulationPillProps {
  onClose?: () => void;
}

export function ReplaySimulationPill({ onClose }: ReplaySimulationPillProps) {
  const [state, setState] = useState<ReplayState>("IDLE");
  const [cursor, setCursor] = useState(-1);
  const [total, setTotal] = useState(0);
  const [speedMs, setSpeedMs] = useState(1000);

  useEffect(() => {
    const unsubscribe = replayEngine.subscribe({
      onStateChange: (newState) => setState(newState),
      onTick: (_bar, c, t) => {
        setCursor(c);
        setTotal(t);
      },
    });
    setState(replayEngine.getState());
    setCursor(replayEngine.getCursorIndex());
    setTotal(replayEngine.getTotalBars());
    return unsubscribe;
  }, []);

  const handlePlayPause = () => {
    if (state === "PLAYING") {
      replayEngine.pause();
    } else {
      replayEngine.play();
    }
  };

  const handleStepForward = () => {
    replayEngine.stepForward();
  };

  const handleStepBackward = () => {
    replayEngine.stepBackward();
  };

  const handleSpeedSelect = (ms: number) => {
    setSpeedMs(ms);
    replayEngine.setSpeed(ms);
  };

  const handleExit = () => {
    replayEngine.exitReplay();
    onClose?.();
  };

  if (state === "IDLE") return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-surface-container-lowest/95 backdrop-blur-md border border-border px-3 py-1.5 rounded-full shadow-2xl text-xs font-mono select-none">
      {/* Simulation Badge */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 text-[10px] font-bold">
        <Scissors size={11} />
        <span>SIMULATION</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            state === "PLAYING" ? "bg-secondary animate-pulse" : "bg-gold"
          }`}
        />
      </div>

      {/* Bar Counter */}
      <div className="text-on-surface text-[11px] px-1">
        Bar <span className="text-primary font-bold">{cursor >= 0 ? cursor + 1 : 0}</span> / {total}
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Controls: Step Back, Play/Pause, Step Forward */}
      <button
        onClick={handleStepBackward}
        disabled={cursor <= 0}
        className="p-1 hover:bg-surface-container rounded text-muted hover:text-on-surface disabled:opacity-30 transition-colors"
        title="Step Backward (Left Arrow)"
      >
        <SkipBack size={13} />
      </button>

      <button
        onClick={handlePlayPause}
        className="p-1.5 bg-primary-container hover:bg-accent-hover text-white rounded-full font-bold shadow-xs transition-colors"
        title={state === "PLAYING" ? "Pause Simulation (Space)" : "Play Simulation (Space)"}
      >
        {state === "PLAYING" ? <Pause size={13} /> : <Play size={13} />}
      </button>

      <button
        onClick={handleStepForward}
        disabled={cursor >= total - 1}
        className="p-1 hover:bg-surface-container rounded text-muted hover:text-on-surface disabled:opacity-30 transition-colors"
        title="Step Forward (Right Arrow)"
      >
        <SkipForward size={13} />
      </button>

      <div className="h-3 w-px bg-border" />

      {/* Speed Selector Pills */}
      <div className="flex items-center gap-0.5 bg-surface-container p-0.5 rounded-full">
        {[
          { label: "1x", ms: 1000 },
          { label: "3x", ms: 333 },
          { label: "5x", ms: 200 },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => handleSpeedSelect(s.ms)}
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
              speedMs === s.ms
                ? "bg-primary-container text-white"
                : "text-muted hover:text-on-surface"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Exit Button */}
      <button
        onClick={handleExit}
        className="p-1 hover:bg-tertiary/20 hover:text-tertiary rounded-full text-muted transition-colors"
        title="Exit Bar Simulation"
      >
        <X size={13} />
      </button>
    </div>
  );
}
