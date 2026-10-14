import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootModules } from "./boot.js";

describe("bootModules", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-modules-ready");
  });

  it("starts modules in list order", async () => {
    const calls = [];
    const modules = [
      { name: "first", init: () => calls.push("first") },
      { name: "second", init: () => calls.push("second") },
    ];

    await bootModules(modules);

    expect(calls).toEqual(["first", "second"]);
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
  });

  it("starts the next module after a fault", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn();
    const modules = [
      { name: "fault", init: () => { throw new Error("fault"); } },
      { name: "next", init: next },
    ];

    await bootModules(modules);

    expect(error).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    error.mockRestore();
  });
  it("starts every module before waiting for unresolved startup", async () => {
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const calls = [];
    const completion = bootModules([
      { name: "pending", init: () => { calls.push("pending"); return pending; } },
      { name: "next", init: () => calls.push("next") },
    ]);
    expect(calls).toEqual(["pending", "next"]);
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(false);
    finish();
    await completion;
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
  });

  it("logs an async rejection and waits for another module to settle", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fault = new Error("async fault");
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const next = vi.fn(() => pending);
    const completion = bootModules([
      { name: "fault", init: () => Promise.reject(fault) },
      { name: "next", init: next },
    ]);
    expect(next).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(log).toHaveBeenCalledWith("[site] fault did not start.", fault);
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(false);
    finish();
    await completion;
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
    log.mockRestore();
  });

});
