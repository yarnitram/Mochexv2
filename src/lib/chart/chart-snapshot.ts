export interface CaptureSnapshotOptions {
  symbol: string;
  resolution: string;
  markPrice: number;
  customTitle?: string;
}

export interface ChartSnapshotResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  filename: string;
}

/**
 * Captures the multi-pane Lightweight Charts container and HTML5 drawing overlays
 * into a single high-resolution PNG image complete with institutional header branding.
 */
export async function captureChartSnapshot(
  container: HTMLElement,
  options: CaptureSnapshotOptions
): Promise<ChartSnapshotResult> {
  const containerRect = container.getBoundingClientRect();
  const width = Math.floor(containerRect.width);
  const height = Math.floor(containerRect.height);
  const bannerHeight = 44;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width * dpr;
  outputCanvas.height = (height + bannerHeight) * dpr;

  const ctx = outputCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize 2D canvas context for chart snapshot.");
  }

  ctx.scale(dpr, dpr);

  // 1. Draw Master Dark Background
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, width, height + bannerHeight);

  // 2. Draw Institutional Branding Banner
  ctx.fillStyle = "#121824";
  ctx.fillRect(0, 0, width, bannerHeight);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, bannerHeight);
  ctx.lineTo(width, bannerHeight);
  ctx.stroke();

  // Branding Left
  ctx.fillStyle = "#2962ff";
  ctx.font = "bold 13px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("MOCHEX", 16, 26);

  ctx.fillStyle = "#64748b";
  ctx.font = "11px 'SF Mono', Consolas, monospace";
  ctx.fillText("PRO WORKSTATION", 76, 26);

  // Symbol, Timeframe & Price Center
  const centerText = `${options.symbol.replace("USDT", "/USDT")} · ${options.resolution} · $${options.markPrice >= 1 ? options.markPrice.toFixed(2) : options.markPrice.toFixed(4)}`;
  ctx.font = "bold 12px 'SF Mono', Consolas, monospace";
  ctx.fillStyle = "#f8fafc";
  const centerMetrics = ctx.measureText(centerText);
  const centerX = Math.max(220, (width - centerMetrics.width) / 2);
  ctx.fillText(centerText, centerX, 26);

  // Metadata & Timestamp Right
  const timeString = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
  ctx.font = "10px 'SF Mono', Consolas, monospace";
  ctx.fillStyle = "#94a3b8";
  const timeMetrics = ctx.measureText(timeString);
  if (width - timeMetrics.width - 16 > centerX + centerMetrics.width + 20) {
    ctx.fillText(timeString, width - timeMetrics.width - 16, 26);
  }

  // 3. Composite all child canvases (Lightweight Charts series, scales, and drawing overlay)
  const childCanvases = Array.from(container.querySelectorAll("canvas"));

  for (const canvas of childCanvases) {
    try {
      const rect = canvas.getBoundingClientRect();
      const relX = rect.left - containerRect.left;
      const relY = rect.top - containerRect.top + bannerHeight;

      if (rect.width > 0 && rect.height > 0) {
        ctx.drawImage(canvas, relX, relY, rect.width, rect.height);
      }
    } catch {
      // Continue even if a cross-origin or detached canvas fails
    }
  }

  // 4. Generate Output Blob and DataURL
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate image blob from chart snapshot."));
          return;
        }

        const dataUrl = outputCanvas.toDataURL("image/png");
        const safeSym = options.symbol.replace(/[^a-zA-Z0-9]/g, "");
        const filename = `mochex-${safeSym}-${options.resolution}-${Date.now()}.png`;

        resolve({
          dataUrl,
          blob,
          width,
          height: height + bannerHeight,
          filename,
        });
      },
      "image/png",
      1.0
    );
  });
}

/**
 * Triggers a native browser file download for the chart snapshot.
 */
export function downloadSnapshotFile(dataUrl: string, filename: string): void {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copies the snapshot image blob directly to the system clipboard.
 */
export async function copySnapshotToClipboard(blob: Blob): Promise<boolean> {
  if (typeof window === "undefined" || !navigator?.clipboard?.write) {
    return false;
  }
  try {
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}
