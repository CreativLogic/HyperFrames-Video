import { memo, useState, useRef, useEffect } from "react";
import { RenderQueueItem } from "./RenderQueueItem";
import type { RenderJob } from "./useRenderQueue";

interface RenderQueueProps {
  jobs: RenderJob[];
  projectId: string;
  onDelete: (jobId: string) => void;
  onClearCompleted: () => void;
  onStartRender: (format: "mp4" | "webm" | "mov", quality: "draft" | "standard" | "high") => void;
  isRendering: boolean;
}

const FORMAT_INFO: Record<"mp4" | "webm" | "mov", { label: string; desc: string }> = {
  mp4: { label: "MP4", desc: "Best for general use. Smallest file, universal playback." },
  mov: {
    label: "MOV (ProRes 4444)",
    desc: "Transparent video. Works in CapCut, Final Cut Pro, Premiere, DaVinci Resolve, After Effects. Large files.",
  },
  webm: {
    label: "WebM (VP9)",
    desc: "Transparent video for web. Smaller than MOV but limited editor support.",
  },
};

function FormatInfoTooltip({ format }: { format: "mp4" | "webm" | "mov" }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const hide = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const info = FORMAT_INFO[format];

  return (
    <div className="relative" onPointerEnter={show} onPointerLeave={hide}>
      <button
        type="button"
        aria-label={`${info.label} export details`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-500 transition-colors hover:border-neutral-700 hover:text-neutral-200"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-neutral-700 bg-neutral-950 p-3 shadow-2xl">
          <p className="mb-1 text-[11px] font-semibold text-neutral-100">{info.label}</p>
          <p className="text-[10px] leading-4 text-neutral-400">{info.desc}</p>
          <div className="mt-2 border-t border-neutral-800 pt-2">
            {(["mp4", "mov", "webm"] as const)
              .filter((f) => f !== format)
              .map((f) => (
                <p key={f} className="text-[10px] leading-4 text-neutral-500">
                  <span className="font-medium text-neutral-300">{FORMAT_INFO[f].label}</span>
                  {" — "}
                  {FORMAT_INFO[f].desc}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const QUALITY_OPTIONS: {
  value: "draft" | "standard" | "high";
  label: string;
  title: string;
}[] = [
  { value: "draft", label: "Draft", title: "Fast render, smaller file" },
  { value: "standard", label: "Standard", title: "Good quality, balanced file size" },
  { value: "high", label: "High Quality", title: "Best quality, larger file" },
];

function FormatExportButton({
  onStartRender,
  isRendering,
}: {
  onStartRender: (format: "mp4" | "webm" | "mov", quality: "draft" | "standard" | "high") => void;
  isRendering: boolean;
}) {
  const [format, setFormat] = useState<"mp4" | "webm" | "mov">("mp4");
  const [quality, setQuality] = useState<"draft" | "standard" | "high">("standard");

  // MOV (ProRes) is a fixed-quality codec — quality selector has no effect.
  const showQuality = format !== "mov";

  return (
    <div className="border-b border-neutral-800 px-4 py-4">
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Export
          </div>
          <div className="mt-1 text-[11px] leading-5 text-neutral-400">
            Render the current composition.
          </div>
        </div>
        <FormatInfoTooltip format={format} />
      </div>
      {showQuality && (
        <div className="mb-4 grid gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Quality
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.title}
                disabled={isRendering}
                onClick={() => setQuality(option.value)}
                className={`h-8 min-w-0 rounded-lg px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  quality === option.value
                    ? "bg-neutral-800 text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                    : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-4 grid gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Format
        </div>
        <div className="grid grid-cols-3 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
          {(["mp4", "mov", "webm"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={isRendering}
              onClick={() => setFormat(option)}
              className={`h-8 min-w-0 rounded-lg px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                format === option
                  ? "bg-neutral-800 text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                  : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
              }`}
            >
              {FORMAT_INFO[option].label.replace(" (ProRes 4444)", "").replace(" (VP9)", "")}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onStartRender(format, quality)}
        disabled={isRendering}
        className="flex h-10 w-full items-center justify-center rounded-xl bg-studio-accent px-4 text-[12px] font-semibold text-[#09090B] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRendering ? "Rendering..." : `Export ${FORMAT_INFO[format].label.split(" ")[0]}`}
      </button>
    </div>
  );
}

export const RenderQueue = memo(function RenderQueue({
  jobs,
  projectId,
  onDelete,
  onClearCompleted,
  onStartRender,
  isRendering,
}: RenderQueueProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new jobs are added.
  // Runs in an effect to avoid side effects during the render phase.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [jobs.length]);

  const completedCount = jobs.filter((j) => j.status !== "rendering").length;

  return (
    <div className="flex h-full flex-col bg-neutral-900 text-neutral-100">
      <FormatExportButton onStartRender={onStartRender} isRendering={isRendering} />

      {/* Job list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-neutral-700"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="2.18"
                ry="2.18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="text-[12px] font-medium text-neutral-300">No renders yet</p>
              <p className="mt-1 text-[11px] leading-5 text-neutral-600">
                Exports will appear here with progress, downloads, and history.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b border-neutral-800/70 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                History
              </div>
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={onClearCompleted}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-[10px] font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-100"
                >
                  Clear completed
                </button>
              )}
            </div>
            {jobs.map((job) => (
              <RenderQueueItem
                key={job.id}
                job={job}
                projectId={projectId}
                onDelete={() => onDelete(job.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
