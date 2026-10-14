import { beforeEach, describe, expect, it, vi } from "vitest";

const { bootModules } = vi.hoisted(() => ({
  bootModules: vi.fn(),
}));

vi.mock("./boot.js", () => ({ bootModules }));
vi.mock("./modules/index.js", () => ({
  modules: [{ name: "example", init: vi.fn() }],
}));

describe("site entry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    bootModules.mockReset();
    bootModules.mockResolvedValue(undefined);
    Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
    document.documentElement.className = "";
    document.documentElement.dataset.projectNamespace = "pistachio";
    delete window.pistachio;
  });

  it("logs when all module start attempts finish", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./index.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(log).toHaveBeenCalledWith("[pistachio] JS ready", {
      modules: ["example"],
    });
  });
  it("calls loader ready and logs only after startup settles", async () => {
    let finish;
    bootModules.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const ready = vi.fn();
    window.pistachio = { boot: { ready } };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await import("./index.js");
    expect(bootModules).toHaveBeenCalledOnce();
    expect(ready).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    finish();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("[pistachio] JS ready", { modules: ["example"] });
  });

  it("waits for startup before adding ready when the loader is absent", async () => {
    let finish;
    bootModules.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    await import("./index.js");
    expect(document.documentElement.classList.contains("pistachio-ready")).toBe(false);
    finish();
    await Promise.resolve();
    expect(document.documentElement.classList.contains("pistachio-ready")).toBe(true);
  });

});
