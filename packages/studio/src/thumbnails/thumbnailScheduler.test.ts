import { describe, expect, it } from "vitest";
import { ThumbnailScheduler, type ThumbnailJobResult } from "./thumbnailScheduler";

describe("ThumbnailScheduler", () => {
  it("dedupes jobs by key", async () => {
    const scheduler = new ThumbnailScheduler();
    let runs = 0;
    const task = async () => {
      runs += 1;
      return "thumbnail";
    };

    const first = scheduler.schedule({ key: "same", priority: "visible", task });
    const second = scheduler.schedule({ key: "same", priority: "visible", task });

    expect(await Promise.all([first, second])).toEqual(["thumbnail", "thumbnail"]);
    expect(runs).toBe(1);
  });

  it("runs higher priority queued work first", async () => {
    const scheduler = new ThumbnailScheduler({ maxActiveJobs: 1 });
    const blocker = deferred<ThumbnailJobResult>();
    const order: string[] = [];

    const first = scheduler.schedule({
      key: "first",
      priority: "visible",
      task: async () => {
        order.push("first");
        return blocker.promise;
      },
    });
    const idle = scheduler.schedule({
      key: "idle",
      priority: "idle",
      task: async () => {
        order.push("idle");
        return "idle";
      },
    });
    const visible = scheduler.schedule({
      key: "visible",
      priority: "visible",
      task: async () => {
        order.push("visible");
        return "visible";
      },
    });

    expect(order).toEqual(["first"]);
    blocker.resolve("first");

    expect(await first).toBe("first");
    expect(await visible).toBe("visible");
    expect(await idle).toBe("idle");
    expect(order).toEqual(["first", "visible", "idle"]);
  });

  it("aborts queued work when all consumers cancel", async () => {
    const scheduler = new ThumbnailScheduler({ maxActiveJobs: 1 });
    const blocker = deferred<ThumbnailJobResult>();
    let queuedRan = false;

    const first = scheduler.schedule({
      key: "first",
      priority: "visible",
      task: async () => blocker.promise,
    });
    const controller = new AbortController();
    const queued = scheduler.schedule({
      key: "queued",
      priority: "visible",
      signal: controller.signal,
      task: async () => {
        queuedRan = true;
        return "queued";
      },
    });

    controller.abort();
    await expect(queued).rejects.toThrow(/aborted/i);
    blocker.resolve("first");
    await expect(first).resolves.toBe("first");

    expect(queuedRan).toBe(false);
    expect(scheduler.stats()).toMatchObject({ queued: 0, active: 0, trackedJobs: 0 });
  });

  it("does not cancel shared work when only one duplicate consumer aborts", async () => {
    const scheduler = new ThumbnailScheduler({ maxActiveJobs: 1 });
    const blocker = deferred<ThumbnailJobResult>();
    const controller = new AbortController();

    const first = scheduler.schedule({
      key: "shared",
      priority: "visible",
      signal: controller.signal,
      task: async () => blocker.promise,
    });
    const second = scheduler.schedule({
      key: "shared",
      priority: "visible",
      task: async () => "should dedupe",
    });

    controller.abort();
    await expect(first).rejects.toThrow(/aborted/i);
    blocker.resolve("shared");
    await expect(second).resolves.toBe("shared");
  });

  it("respects headless concurrency while keeping default work moving", async () => {
    const scheduler = new ThumbnailScheduler({ maxActiveJobs: 2, maxActiveHeadlessJobs: 1 });
    const firstHeadless = deferred<ThumbnailJobResult>();
    const order: string[] = [];

    const h1 = scheduler.schedule({
      key: "h1",
      priority: "visible",
      lane: "headless",
      task: async () => {
        order.push("h1");
        return firstHeadless.promise;
      },
    });
    const h2 = scheduler.schedule({
      key: "h2",
      priority: "visible",
      lane: "headless",
      task: async () => {
        order.push("h2");
        return "h2";
      },
    });
    const d1 = scheduler.schedule({
      key: "d1",
      priority: "visible",
      task: async () => {
        order.push("d1");
        return "d1";
      },
    });

    expect(order).toEqual(["h1", "d1"]);
    await expect(d1).resolves.toBe("d1");
    firstHeadless.resolve("h1");
    await expect(h1).resolves.toBe("h1");
    await expect(h2).resolves.toBe("h2");
    expect(order).toEqual(["h1", "d1", "h2"]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
