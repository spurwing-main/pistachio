import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const code = readFileSync("loader.js", "utf8");
const loaderSource = "https://cdn.jsdelivr.net/gh/spurwing-main/pistachio@1234567890abcdef/loader.js";

async function runLoader({ source = loaderSource, data = {} } = {}) {
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: { src: source, dataset: data },
  });
  window.eval(code);
  for (let step = 0; step < 6; step += 1) await Promise.resolve();
}

describe("loader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    document.querySelectorAll("[data-loader-panel]").forEach((panel) => panel.remove());
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.documentElement.className = "";
    delete document.documentElement.dataset.projectNamespace;
    delete window.pistachio;
  });

  it("loads the bundle from the loader commit", async () => {
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    expect(bundle.src).toBe(
      "https://cdn.jsdelivr.net/gh/spurwing-main/pistachio@1234567890abcdef/dist/bundle.js"
    );
    expect(window.pistachio.boot.commit).toBe("1234567890abcdef");
  });

  it("logs the environment and URL when the bundle loads", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    bundle.onload();

    expect(log).toHaveBeenCalledWith("[pistachio] JS bundle loaded", {
      environment: "live",
      source: "live",
      url: bundle.src,
      commit: "1234567890abcdef",
    });
  });

  it("ignores a valid commit query and shows the requested dev panel", async () => {
    window.history.replaceState({}, "", "/?dev=1&env=live&commit=abcdef1234567");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    expect(bundle.src).toContain("@1234567890abcdef/dist/bundle.js");
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
    expect(document.querySelector("[data-loader-commit]").textContent).toBe("1234567890");
  });

  it("shows content after the ready timeout", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    expect(document.documentElement.classList.contains("pistachio-loading")).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(document.documentElement.classList.contains("pistachio-ready")).toBe(true);
    expect(document.documentElement.classList.contains("pistachio-loading")).toBe(false);
  });

  it("uses the live bundle if the local module load fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=local");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await runLoader();

    const localBundle = document.head.querySelector('script[type="module"]');
    expect(localBundle.src).toBe("http://localhost:5500/bundle.js");
    localBundle.onerror();

    const bundles = document.head.querySelectorAll('script[type="module"]');
    expect(bundles).toHaveLength(2);
    expect(bundles[1].src).toContain("@1234567890abcdef/dist/bundle.js");
    expect(document.querySelector("[data-loader-status]").textContent).toBe("Local unavailable");
    expect(document.querySelector("[data-loader-source]").textContent).toBe("jsDelivr");
    bundles[1].onerror();
    expect(document.head.querySelectorAll('script[type="module"]')).toHaveLength(2);
  });

  it("does not look for a local bundle on staging unless asked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await runLoader();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.head.querySelector('script[type="module"]').src).toContain(
      "@1234567890abcdef/dist/bundle.js"
    );
    expect(document.querySelector("[data-loader-panel]")).toBeNull();
  });

  it("uses the local bundle when asked and the local server responds", async () => {
    window.history.replaceState({}, "", "/?env=local");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await runLoader();

    expect(document.head.querySelector('script[type="module"]').src).toBe(
      "http://localhost:5500/bundle.js"
    );
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
  });

  it("recovers visibility after a failed live bundle without retrying it", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?env=live");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runLoader();
    document.head.querySelector('script[type="module"]').onerror();
    expect(document.head.querySelectorAll('script[type="module"]')).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(document.documentElement.classList.contains("pistachio-ready")).toBe(true);
    expect(document.documentElement.classList.contains("pistachio-loading")).toBe(false);
  });

  it("uses the pinned live bundle when a requested local probe fails", async () => {
    window.history.replaceState({}, "", "/?env=local");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await runLoader();
    expect(document.head.querySelector('script[type="module"]').src).toBe(loaderSource.replace("/loader.js", "/dist/bundle.js"));
  });

  it("reads a stored environment on staging", async () => {
    window.sessionStorage.setItem("pistachio_environment", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await runLoader();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.pistachio.boot.environment).toBe("live");
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
  });
});


describe("code source boundaries", () => {
  async function boot({ host = "example.webflow.io", query = "?env=local", data = {}, stored, defaultsBase, defaultsEnvironment, clickEnvironment, reset = false } = {}) {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: `https://${host}/${query}`,
      runScripts: "outside-only",
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    dom.window.fetch = fetchMock;
    dom.window.console = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    Object.defineProperty(dom.window.document, "currentScript", {
      value: { src: loaderSource, dataset: data },
    });
    if (stored) dom.window.sessionStorage.setItem("pistachio_environment", stored);
    let source = defaultsBase ? code.replace('localBase: "http://localhost:5500"', `localBase: ${JSON.stringify(defaultsBase)}`) : code;
    if (defaultsEnvironment) source = source.replace('environment: "auto"', `environment: ${JSON.stringify(defaultsEnvironment)}`);
    const location = { hostname: host, search: query, href: `https://${host}/${query}` };
    runInNewContext(source, {
      window: dom.window, document: dom.window.document, location,
      sessionStorage: dom.window.sessionStorage, URL, URLSearchParams,
      AbortController, fetch: fetchMock, console: dom.window.console,
    });
    for (let step = 0; step < 8; step += 1) await Promise.resolve();
    const urls = [...dom.window.document.querySelectorAll('script[type="module"]')].map((script) => script.src);
    const config = dom.window.pistachio.boot;
    const panel = Boolean(dom.window.document.querySelector("[data-loader-panel]"));
    if (clickEnvironment) dom.window.document.querySelector(`[data-environment="${clickEnvironment}"]`).click();
    if (reset) dom.window.document.querySelector("[data-loader-reset]").click();
    const savedEnvironment = dom.window.sessionStorage.getItem("pistachio_environment");
    const destination = location.href;
    dom.window.close();
    return { fetchMock, urls, config, panel, destination, savedEnvironment };
  }

  describe.each(["pistachioapp.com", "www.pistachioapp.com", "example.webflow.io", "localhost"])("development controls on %s", (host) => {
    const data = { localBase: "https://pistachio.beta.localcan.dev" };
    it.each(["?env=local", "?dev=1&env=local", "?mode=dev&env=local"])("loads the configured source for %s", async (query) => {
      const result = await boot({ host, query, data });
      expect(result.urls).toEqual([`${data.localBase}/bundle.js`]);
      expect(result.panel).toBe(true);
    });

    it.each(["", "?env=auto", "?env=live", "?dev=1", "?mode=dev", "?local=https://attacker.test"])("does not probe for %s without a Local selection", async (query) => {
      const result = await boot({ host, query, data });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
      expect(result.panel).toBe(query.includes("dev") || query.includes("env="));
    });

    it("uses a stored Local selection when the developer panel is enabled", async () => {
      const result = await boot({ host, query: "?dev=1", stored: "local", data });
      expect(result.urls).toEqual([`${data.localBase}/bundle.js`]);
      expect(result.panel).toBe(true);
    });

    it.each(["?dev=1&env=auto", "?dev=1&env=live", "?dev=0"])("does not probe for %s despite a stored Local selection", async (query) => {
      const result = await boot({ host, query, stored: "local", data });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
    });

    it.each(["https://attacker.test", "http://localhost:5501", "https://pistachio.beta.localcan.dev/other"])("ignores source override %s", async (base) => {
      const result = await boot({ host, query: `?env=local&local=${encodeURIComponent(base)}`, data });
      expect(result.fetchMock).toHaveBeenCalledExactlyOnceWith(`${data.localBase}/bundle.js`, expect.any(Object));
      expect(result.urls).toEqual([`${data.localBase}/bundle.js`]);
    });
  });

  it.each(["local", "live", "auto"])("keeps panel selection %s after reloading production", async (selection) => {
    const first = await boot({ host: "pistachioapp.com", query: "?env=local", clickEnvironment: selection });
    const query = new URL(first.destination).search;
    const next = await boot({ host: "pistachioapp.com", query, stored: selection });
    expect(next.config.environment).toBe(selection);
    expect(next.panel).toBe(true);
    expect(next.urls).toEqual([selection === "local" ? "http://localhost:5500/bundle.js" : loaderSource.replace("/loader.js", "/dist/bundle.js")]);
  });

  describe.each(["pistachioapp.com", "example.webflow.io"])("navigation persistence on %s", (host) => {
    const data = { localBase: "https://pistachio.beta.localcan.dev" };
    it.each(["url", "panel"])("keeps an explicit %s Local selection on the next page", async (via) => {
      const first = await boot({ host, data, query: via === "url" ? "?env=local" : "?dev=1", clickEnvironment: via === "panel" ? "local" : undefined });
      const next = await boot({ host, data, query: "", stored: first.savedEnvironment });
      expect(next.urls).toEqual([`${data.localBase}/bundle.js`]);
      expect(next.panel).toBe(true);
      expect(next.config.devMode).toBe(true);
    });

    it.each(["live", "auto"])("persists an explicit %s override of stored Local mode", async (selection) => {
      const first = await boot({ host, data, query: `?env=${selection}`, stored: "local" });
      const next = await boot({ host, data, query: "", stored: first.savedEnvironment });
      expect(next.fetchMock).not.toHaveBeenCalled();
      expect(next.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
      expect(next.config.environment).toBe(selection);
    });

    it("Reset clears the selection for subsequent pages", async () => {
      const first = await boot({ host, data, query: "?env=local&dev=1", reset: true });
      const next = await boot({ host, data, query: "", stored: first.savedEnvironment });
      expect(first.savedEnvironment).toBeNull();
      expect(new URL(first.destination).search).toBe("");
      expect(next.fetchMock).not.toHaveBeenCalled();
      expect(next.panel).toBe(false);
    });

    it.each(["?dev=0", "?dev=0&env=local", "?dev=0&env=live", "?dev=0&mode=dev&env=local", "?mode=off&env=local"])("clears Local and forces published code for %s", async (query) => {
      const first = await boot({ host, data, query, stored: "local" });
      expect(first.savedEnvironment).toBeNull();
      expect(first.config.environment).toBe("live");
      expect(first.panel).toBe(false);
      expect(first.fetchMock).not.toHaveBeenCalled();
      expect(first.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
      const next = await boot({ host, data, query: "", stored: first.savedEnvironment });
      expect(next.fetchMock).not.toHaveBeenCalled();
      expect(next.panel).toBe(false);
      expect(next.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
    });

    it("does not persist an invalid environment", async () => {
      const result = await boot({ host, data, query: "?env=invalid" });
      expect(result.savedEnvironment).toBeNull();
      expect(result.fetchMock).not.toHaveBeenCalled();
    });
  });

  it.each(["example.com", "example.webflow.io", "localhost"])(
    "ignores all commit query values on %s", async (host) => {
      for (const ref of ["abcdef1234567", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "../../other/repo@main", "main/../../evil", "refs/heads/fork"] ) {
        const result = await boot({ host, query: `?dev=1&commit=${encodeURIComponent(ref)}` });
        expect(result.fetchMock).not.toHaveBeenCalled();
        expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
        expect(result.config.commit).toBe("1234567890abcdef");
      }
    }
  );

  it.each(["", "?env=auto", "?env=live", "?dev=1", "?mode=dev&env=auto"])(
    "does not probe without an explicit Local choice: %s", async (query) => {
      const result = await boot({ query });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
    }
  );

  it("preserves an explicit trusted Local default", async () => {
    const result = await boot({ query: "", defaultsEnvironment: "local" });
    expect(result.fetchMock).toHaveBeenCalledOnce();
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it("still probes after a tab's explicit panel Local selection", async () => {
    const result = await boot({ query: "", stored: "local" });
    expect(result.fetchMock).toHaveBeenCalledOnce();
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it("does not accept a lookalike of a configured tunnel", async () => {
    const result = await boot({ data: { localBase: "https://trusted-tunnel.example" }, query: "?env=local&local=https://trusted-tunnel.example.attacker.test" });
    expect(result.urls).toEqual(["https://trusted-tunnel.example/bundle.js"]);
  });

  it.each([
    "https://attacker.test", "javascript://localhost/alert(1)", "ftp://localhost:5500",
    "http://localhost.attacker.test:5500", "https://trusted-tunnel.example.attacker.test",
    "http://user:pass@localhost:5500", "http://localhost:5500?", "http://localhost:5500#", "//localhost:5500", "/local", "not a URL",
  ])("does not fetch or execute the untrusted base %s", async (base) => {
    const result = await boot({ query: `?env=local&local=${encodeURIComponent(base)}` });
    expect(result.fetchMock).toHaveBeenCalledWith("http://localhost:5500/bundle.js", expect.any(Object));
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it.each(["http://localhost:5501", "http://127.0.0.1:5501", "http://[::1]:5501"])(
    "ignores URL-selected loopback %s on staging", async (base) => {
      const result = await boot({ query: `?env=local&local=${encodeURIComponent(base)}` });
      expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
    }
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])("allows development on %s", async (host) => {
    const result = await boot({ host });
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it.each(["script", "defaults"])("allows an explicitly configured tunnel from %s", async (owner) => {
    const tunnel = "https://trusted-tunnel.example";
    const result = await boot(owner === "script" ? { data: { localBase: tunnel } } : { defaultsBase: tunnel });
    expect(result.urls).toEqual([`${tunnel}/bundle.js`]);
  });

  it("ignores a query path on the configured tunnel origin", async () => {
    const result = await boot({ data: { localBase: "https://trusted-tunnel.example" }, query: "?env=local&local=https://trusted-tunnel.example/dev" });
    expect(result.urls).toEqual(["https://trusted-tunnel.example/bundle.js"]);
  });

  it.each(["javascript://localhost/evil", "https://user:pass@trusted-tunnel.example", "ftp://localhost", "https://trusted-tunnel.example?", "https://trusted-tunnel.example#"])(
    "rejects invalid configured bases without a local request: %s", async (base) => {
      const result = await boot({ data: { localBase: base }, defaultsBase: base });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
    }
  );
});
