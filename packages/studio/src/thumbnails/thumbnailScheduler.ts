export type ThumbnailPriority = "visible" | "hover" | "idle";
export type ThumbnailLane = "default" | "headless";
export type ThumbnailJobResult = Blob | ImageBitmap | string | null;

export interface ThumbnailSchedulerOptions {
  maxActiveJobs?: number;
  maxActiveHeadlessJobs?: number;
}

export interface ScheduleThumbnailOptions {
  key: string;
  priority: ThumbnailPriority;
  lane?: ThumbnailLane;
  signal?: AbortSignal;
  task: (signal: AbortSignal) => Promise<ThumbnailJobResult>;
}

export interface ThumbnailSchedulerStats {
  queued: number;
  active: number;
  activeHeadless: number;
  trackedJobs: number;
}

interface ScheduledJob {
  key: string;
  priority: ThumbnailPriority;
  lane: ThumbnailLane;
  task: (signal: AbortSignal) => Promise<ThumbnailJobResult>;
  controller: AbortController;
  promise: Promise<ThumbnailJobResult>;
  resolve: (value: ThumbnailJobResult) => void;
  reject: (reason: unknown) => void;
  consumers: Set<symbol>;
  state: "queued" | "running" | "settled";
}

const PRIORITIES: ThumbnailPriority[] = ["visible", "hover", "idle"];

export class ThumbnailScheduler {
  readonly maxActiveJobs: number;
  readonly maxActiveHeadlessJobs: number;

  private queues = new Map<ThumbnailPriority, ScheduledJob[]>(
    PRIORITIES.map((priority) => [priority, []]),
  );
  private jobsByKey = new Map<string, ScheduledJob>();
  private activeJobs = new Set<ScheduledJob>();
  private activeHeadlessJobs = 0;

  constructor(options: ThumbnailSchedulerOptions = {}) {
    this.maxActiveJobs = Math.max(1, options.maxActiveJobs ?? 2);
    this.maxActiveHeadlessJobs = Math.max(0, options.maxActiveHeadlessJobs ?? 1);
  }

  schedule(options: ScheduleThumbnailOptions): Promise<ThumbnailJobResult> {
    const existing = this.jobsByKey.get(options.key);
    if (existing) return this.attachConsumer(existing, options.signal);

    let resolveJob: (value: ThumbnailJobResult) => void = () => {};
    let rejectJob: (reason: unknown) => void = () => {};
    const promise = new Promise<ThumbnailJobResult>((resolve, reject) => {
      resolveJob = resolve;
      rejectJob = reject;
    });
    const job: ScheduledJob = {
      key: options.key,
      priority: options.priority,
      lane: options.lane ?? "default",
      task: options.task,
      controller: new AbortController(),
      promise,
      resolve: resolveJob,
      reject: rejectJob,
      consumers: new Set(),
      state: "queued",
    };

    this.jobsByKey.set(job.key, job);
    this.getQueue(job.priority).push(job);
    const consumerPromise = this.attachConsumer(job, options.signal);
    this.pump();
    return consumerPromise;
  }

  stats(): ThumbnailSchedulerStats {
    return {
      queued: Array.from(this.queues.values()).reduce((total, queue) => total + queue.length, 0),
      active: this.activeJobs.size,
      activeHeadless: this.activeHeadlessJobs,
      trackedJobs: this.jobsByKey.size,
    };
  }

  private attachConsumer(
    job: ScheduledJob,
    signal: AbortSignal | undefined,
  ): Promise<ThumbnailJobResult> {
    if (signal?.aborted) return Promise.reject(createAbortError(signal.reason));

    const token = Symbol(job.key);
    job.consumers.add(token);

    let abortReject: (reason: unknown) => void = () => {};
    const abortPromise = new Promise<never>((_resolve, reject) => {
      abortReject = reject;
    });
    const onAbort = () => {
      this.detachConsumer(job, token);
      abortReject(createAbortError(signal?.reason));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    return Promise.race([job.promise, abortPromise]).finally(() => {
      signal?.removeEventListener("abort", onAbort);
      job.consumers.delete(token);
    });
  }

  private detachConsumer(job: ScheduledJob, token: symbol): void {
    job.consumers.delete(token);
    if (job.state === "settled" || job.consumers.size > 0) return;

    const abortError = createAbortError();
    job.controller.abort(abortError);
    if (job.state === "queued") {
      this.removeQueuedJob(job);
      this.settleJob(job, "reject", abortError);
    }
  }

  private pump(): void {
    while (this.activeJobs.size < this.maxActiveJobs) {
      const next = this.takeNextRunnableJob();
      if (!next) return;
      this.runJob(next);
    }
  }

  private takeNextRunnableJob(): ScheduledJob | null {
    for (const priority of PRIORITIES) {
      const queue = this.getQueue(priority);
      const index = queue.findIndex((job) => this.canRun(job));
      if (index >= 0) {
        const [job] = queue.splice(index, 1);
        return job ?? null;
      }
    }
    return null;
  }

  private canRun(job: ScheduledJob): boolean {
    return job.lane !== "headless" || this.activeHeadlessJobs < this.maxActiveHeadlessJobs;
  }

  private async runJob(job: ScheduledJob): Promise<void> {
    if (job.controller.signal.aborted) {
      this.settleJob(job, "reject", createAbortError(job.controller.signal.reason));
      this.pump();
      return;
    }

    job.state = "running";
    this.activeJobs.add(job);
    if (job.lane === "headless") this.activeHeadlessJobs += 1;

    try {
      this.settleJob(job, "resolve", await job.task(job.controller.signal));
    } catch (error) {
      this.settleJob(job, "reject", error);
    } finally {
      this.activeJobs.delete(job);
      if (job.lane === "headless") {
        this.activeHeadlessJobs = Math.max(0, this.activeHeadlessJobs - 1);
      }
      this.pump();
    }
  }

  private settleJob(
    job: ScheduledJob,
    mode: "resolve" | "reject",
    value: ThumbnailJobResult | unknown,
  ): void {
    if (job.state === "settled") return;

    job.state = "settled";
    this.jobsByKey.delete(job.key);
    this.removeQueuedJob(job);

    if (mode === "resolve") {
      job.resolve(isThumbnailJobResult(value) ? value : null);
    } else {
      job.reject(value);
    }
  }

  private removeQueuedJob(job: ScheduledJob): void {
    for (const queue of this.queues.values()) {
      const index = queue.indexOf(job);
      if (index >= 0) {
        queue.splice(index, 1);
        return;
      }
    }
  }

  private getQueue(priority: ThumbnailPriority): ScheduledJob[] {
    const queue = this.queues.get(priority);
    if (queue) return queue;
    throw new Error(`Unknown thumbnail priority: ${priority}`);
  }
}

function isThumbnailJobResult(value: unknown): value is ThumbnailJobResult {
  return (
    value == null || typeof value === "string" || value instanceof Blob || isImageBitmap(value)
  );
}

function isImageBitmap(value: unknown): value is ImageBitmap {
  return typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap;
}

function createAbortError(reason?: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof DOMException === "function") {
    return new DOMException("Thumbnail request aborted.", "AbortError");
  }
  return new Error("Thumbnail request aborted.");
}
