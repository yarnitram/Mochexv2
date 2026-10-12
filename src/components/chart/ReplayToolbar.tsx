"use client";

import React, { useEffect, useState } from "react";
import { replayEngine, ReplayState } from "@/lib/replay/replay-engine";
import { Play, Pause, SkipForward, SkipBack, X, Gauge } from "lucide-react";

interface ReplayToolbarProps {
  onClose?: () => void;
}

export function ReplayToolbar({ onClose }: ReplayToolbarProps) {
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

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setSpeedMs(val);
    replayEngine.setSpeed(val);
  };

  const handleExit = () => {
    replayEngine.exitReplay();
    onClose?.();
  };

  if (state === "IDLE") return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-card/95 backdrop-blur border border-border px-4 py-2 rounded-xl shadow-2xl text-xs font-mono">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-surface rounded text-muted uppercase font-bold text-[10px]">
        <span
          className={`w-2 h-2 rounded-full ${
            state === "PLAYING" ? "bg-bull animate-pulse" : state === "PAUSED" ? "bg-accent" : "bg-muted"
          }`}
        />
        <span>REPLAY: {state}</span>
      </div>

      <div className="text-foreground">
        Bar: <span className="text-accent font-bold">{cursor >= 0 ? cursor + 1 : 0}</span> / {total}
      </div>

      <div className="h-4 w-px bg-border mx-1" />

      <button
        onClick={handleStepBackward}
        disabled={cursor <= 0}
        className="p-1.5 hover:bg-surface-hover rounded text-foreground disabled:opacity-40"
        title="Step Backward"
      >
        <SkipBack size={14} />
      </button>

      <button
        onClick={handlePlayPause}
        className="p-1.5 bg-accent hover:bg-accent-hover text-white rounded font-bold"
        title={state === "PLAYING" ? "Pause" : "Play"}
      >
        {state === "PLAYING" ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <button
        onClick={handleStepForward}
        disabled={cursor >= total - 1}
        className="p-1.5 hover:bg-surface-hover rounded text-foreground disabled:opacity-40"
        title="Step Forward"
      >
        <SkipForward size={14} />
      </button>

      <div className="h-4 w-px bg-border mx-1" />

      <div className="flex items-center gap-1 text-muted">
        <Gauge size={13} />
        <select
          value={speedMs}
          onChange={handleSpeedChange}
          className="bg-surface border border-border rounded px-1.5 py-0.5 text-foreground outline-none"
        >
          <option value={2000}>0.5x (2s)</option>
          <option value={1000}>1x (1s)</option>
          <option value={500}>2x (0.5s)</option>
          <option value={250}>4x (250ms)</option>
          <option value={100}>10x (100ms)</option>
        </select>
      </div>

      <div className="h-4 w-px bg-border mx-1" />

      <button
        onClick={handleExit}
        className="p-1.5 hover:bg-bear/20 hover:text-bear rounded text-muted transition-colors"
        title="Exit Replay"
      >
        <X size={14} />
      </button>
    </div>
  );
}
