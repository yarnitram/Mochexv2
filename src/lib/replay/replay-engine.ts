import { Bar } from "@/types/tradingview";

export type ReplayState = "IDLE" | "SELECTING" | "PAUSED" | "PLAYING";

export interface ReplayEngineListener {
  onStateChange?(state: ReplayState): void;
  onTick?(bar: Bar, cursorIndex: number, totalBars: number): void;
  onEnd?(): void;
}

export class BarReplayEngine {
  private state: ReplayState = "IDLE";
  private allBars: Bar[] = [];
  private cursorIndex = -1;
  private playbackIntervalMs = 1000;
  private timer: NodeJS.Timeout | null = null;
  private listeners: Set<ReplayEngineListener> = new Set();

  public subscribe(listener: ReplayEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getState(): ReplayState {
    return this.state;
  }

  public getCursorIndex(): number {
    return this.cursorIndex;
  }

  public getTotalBars(): number {
    return this.allBars.length;
  }

  public getVisibleBars(): Bar[] {
    if (this.state === "IDLE" || this.cursorIndex < 0) {
      return [...this.allBars];
    }
    return this.allBars.slice(0, this.cursorIndex + 1);
  }

  public loadHistory(bars: Bar[]): void {
    this.allBars = [...bars].sort((a, b) => a.time - b.time);
  }

  public startSelecting(): void {
    this.stopTimer();
    this.state = "SELECTING";
    this.notifyState();
  }

  public setCutoffTime(timestamp: number): boolean {
    const idx = this.allBars.findIndex((b) => b.time >= timestamp);
    if (idx === -1) {
      this.cursorIndex = this.allBars.length - 1;
    } else {
      this.cursorIndex = idx;
    }

    this.state = "PAUSED";
    this.notifyState();
    this.notifyTick();
    return true;
  }

  public play(): void {
    if (this.state === "IDLE" || this.cursorIndex >= this.allBars.length - 1) {
      return;
    }

    this.state = "PLAYING";
    this.notifyState();

    this.stopTimer();
    this.timer = setInterval(() => {
      this.stepForward();
    }, this.playbackIntervalMs);
  }

  public pause(): void {
    this.stopTimer();
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      this.notifyState();
    }
  }

  public stepForward(): boolean {
    if (this.cursorIndex >= this.allBars.length - 1) {
      this.pause();
      this.listeners.forEach((l) => l.onEnd?.());
      return false;
    }

    this.cursorIndex += 1;
    this.notifyTick();
    return true;
  }

  public stepBackward(): boolean {
    if (this.cursorIndex <= 0) {
      return false;
    }

    this.cursorIndex -= 1;
    this.notifyTick();
    return true;
  }

  public setSpeed(intervalMs: number): void {
    this.playbackIntervalMs = Math.max(50, intervalMs);
    if (this.state === "PLAYING") {
      this.stopTimer();
      this.timer = setInterval(() => {
        this.stepForward();
      }, this.playbackIntervalMs);
    }
  }

  public exitReplay(): void {
    this.stopTimer();
    this.state = "IDLE";
    this.cursorIndex = -1;
    this.notifyState();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private notifyState(): void {
    this.listeners.forEach((l) => l.onStateChange?.(this.state));
  }

  private notifyTick(): void {
    if (this.cursorIndex >= 0 && this.cursorIndex < this.allBars.length) {
      const currentBar = this.allBars[this.cursorIndex];
      this.listeners.forEach((l) => l.onTick?.(currentBar, this.cursorIndex, this.allBars.length));
    }
  }
}

export const replayEngine = new BarReplayEngine();
