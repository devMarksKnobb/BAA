import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../src/core/retry.js";

describe("withRetry", () => {
  it("retries transient failures and returns the successful result", async () => {
    let n = 0;
    const result = await withRetry(async () => {
      if (++n < 3) throw Error("temporary");
      return "ok";
    }, { attempts: 3, baseDelayMs: 0 });
    expect(result).toBe("ok");
    expect(n).toBe(3);
  });

  it("does not retry when policy rejects an error", async () => {
    let n = 0;
    await expect(withRetry(async () => {
      n++;
      throw Error("fatal");
    }, { attempts: 4, baseDelayMs: 0, shouldRetry: () => false })).rejects.toThrow("fatal");
    expect(n).toBe(1);
  });

  it("uses bounded full jitter and reports the selected delay", async () => {
    const onRetry = vi.fn();
    let n = 0;
    await withRetry(async () => {
      if (++n === 1) throw Error("temporary");
      return "ok";
    }, { attempts: 2, baseDelayMs: 100, maxDelayMs: 100, random: () => 0.5, onRetry });
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 50);
  });

  it("aborts while waiting between retries", async () => {
    const controller = new AbortController();
    let n = 0;
    const pending = withRetry(async () => {
      n++;
      throw Error("temporary");
    }, { attempts: 5, baseDelayMs: 10_000, signal: controller.signal });
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
    expect(n).toBe(1);
  });
});
