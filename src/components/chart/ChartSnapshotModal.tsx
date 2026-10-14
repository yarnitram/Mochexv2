"use client";

import React, { useState } from "react";
import { Download, Copy, ExternalLink, Check, X, Camera } from "lucide-react";
import {
  ChartSnapshotResult,
  downloadSnapshotFile,
  copySnapshotToClipboard,
} from "@/lib/chart/chart-snapshot";

interface ChartSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: ChartSnapshotResult | null;
}

export function ChartSnapshotModal({
  isOpen,
  onClose,
  snapshot,
}: ChartSnapshotModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !snapshot) return null;

  const handleCopy = async () => {
    const success = await copySnapshotToClipboard(snapshot.blob);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    downloadSnapshotFile(snapshot.dataUrl, snapshot.filename);
  };

  const handleOpenNewTab = () => {
    if (typeof window === "undefined") return;
    const tab = window.open();
    if (tab) {
      tab.document.write(
        `<body style="margin:0;background:#0c1017;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${snapshot.dataUrl}" style="max-width:100%;max-height:100%;box-shadow:0 10px 40px rgba(0,0,0,0.8);border-radius:6px;"/></body>`
      );
      tab.document.title = snapshot.filename;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-surface-container-lowest border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-primary" />
            <span className="text-xs font-bold text-on-surface">
              Chart Snapshot Preview
            </span>
            <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface-container border border-border">
              {snapshot.width} × {snapshot.height} px
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                copied
                  ? "bg-secondary text-surface"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface border border-border"
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? "Copied to Clipboard!" : "Copy Image"}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1 rounded bg-primary-container hover:bg-primary text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Download size={13} />
              <span>Download PNG</span>
            </button>

            <button
              onClick={handleOpenNewTab}
              title="Open full resolution in new tab"
              className="p-1 rounded bg-surface-container hover:bg-surface-container-high text-muted hover:text-on-surface border border-border cursor-pointer transition-colors"
            >
              <ExternalLink size={14} />
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            <button
              onClick={onClose}
              className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Image Preview Canvas Box */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snapshot.dataUrl}
            alt="Mochex Chart Snapshot"
            className="max-w-full max-h-[70vh] rounded border border-border shadow-2xl object-contain"
          />
        </div>

        {/* Footer info ribbon */}
        <div className="px-4 py-2 bg-surface-container-lowest border-t border-border flex items-center justify-between text-[11px] text-muted">
          <span>Filename: <strong className="text-on-surface">{snapshot.filename}</strong></span>
          <span className="text-outline">High-DPI 60 FPS Composite</span>
        </div>
      </div>
    </div>
  );
}
