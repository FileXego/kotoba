import { afterEach, describe, expect, test } from "bun:test";

await import("./mobile-web-lab-core.js");

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.names = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.names.has(name) : Boolean(force);
    if (shouldAdd) {
      this.names.add(name);
    } else {
      this.names.delete(name);
    }
    this.element.className = Array.from(this.names).join(" ");
    return shouldAdd;
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(options = {}) {
    this.id = options.id || "";
    this.type = options.type || "";
    this.className = options.className || "";
    this.classList = new FakeClassList(this);
    this.dataset = { ...(options.dataset || {}) };
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.files = [];
    this.listeners = {};
    this.style = {
      values: {},
      setProperty: (key, value) => {
        this.style.values[key] = value;
      },
    };
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
    children.forEach((child) => {
      child.parentNode = this;
    });
  }

  querySelector(selector) {
    if (selector === "[type='submit']") {
      return this.submitButton || null;
    }
    return null;
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  focus() {
    this.focused = true;
  }

  click() {
    this.clicked = true;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
  }
}

class FakeDocument {
  constructor() {
    this.shell = new FakeElement({ className: "lab-shell" });
    this.app = new FakeElement({ id: "app", className: "mobile-app" });
    this.disabledState = new FakeElement({ className: "disabled-state" });
    this.feedList = new FakeElement({ id: "feed-list" });
    this.bookmarkList = new FakeElement({ id: "bookmark-list" });
    this.threadContent = new FakeElement({ id: "thread-content" });
    this.composeInput = new FakeElement({ id: "compose-input" });
    this.replyInput = new FakeElement({ id: "reply-input" });
    this.imageInput = new FakeElement({ id: "image-input", type: "file" });
    this.uploadPreview = new FakeElement({ id: "upload-preview" });
    this.apiStatus = new FakeElement({ id: "api-status" });

    this.controls = {
      mobile: new FakeElement({ id: "flag-mobile", type: "checkbox" }),
      api: new FakeElement({ id: "flag-api", type: "checkbox" }),
      dust: new FakeElement({ id: "flag-dust", type: "checkbox" }),
      ink: new FakeElement({ id: "flag-ink", type: "checkbox" }),
      theme: new FakeElement({ id: "theme-select" }),
      platform: new FakeElement({ id: "platform-select" }),
    };

    this.screens = ["home", "thread", "bookmarks", "me"].map((screen) => new FakeElement({
      className: "mobile-screen",
      dataset: { screen },
    }));
    this.navButtons = ["home", "bookmarks", "write", "me"].map((nav) => new FakeElement({
      dataset: { nav },
    }));
    this.readonlyBanners = [
      new FakeElement({ dataset: { readonlyBanner: "" } }),
      new FakeElement({ dataset: { readonlyBanner: "" } }),
    ];

    this.composeForm = new FakeElement({ dataset: { action: "compose" } });
    this.composeForm.submitButton = new FakeElement({ type: "submit" });
    this.replyForm = new FakeElement({ dataset: { action: "reply" } });
    this.replyForm.submitButton = new FakeElement({ type: "submit" });

    this.selectorMap = new Map([
      [".lab-shell", this.shell],
      ["#app", this.app],
      [".disabled-state", this.disabledState],
      ["#feed-list", this.feedList],
      ["#bookmark-list", this.bookmarkList],
      ["#thread-content", this.threadContent],
      ["[data-action='compose']", this.composeForm],
      ["[data-action='reply']", this.replyForm],
      ["#compose-input", this.composeInput],
      ["#reply-input", this.replyInput],
      ["#image-input", this.imageInput],
      ["#upload-preview", this.uploadPreview],
      ["#api-status", this.apiStatus],
      ["#flag-mobile", this.controls.mobile],
      ["#flag-api", this.controls.api],
      ["#flag-dust", this.controls.dust],
      ["#flag-ink", this.controls.ink],
      ["#theme-select", this.controls.theme],
      ["#platform-select", this.controls.platform],
    ]);
    this.listeners = {};
  }

  querySelector(selector) {
    return this.selectorMap.get(selector) || null;
  }

  querySelectorAll(selector) {
    if (selector === ".mobile-screen") return this.screens;
    if (selector === "[data-nav]") return this.navButtons;
    if (selector === "[data-readonly-banner]") return this.readonlyBanners;
    return [];
  }

  createElement() {
    return new FakeElement();
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
}

async function runLab(url, fetchImpl) {
  const location = new URL(url);
  const document = new FakeDocument();
  let pushedUrl = "";
  let pushedState = null;

  globalThis.document = document;
  globalThis.fetch = fetchImpl;
  globalThis.window = {
    KotobaMobileLabCore: globalThis.KotobaMobileLabCore,
    location,
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
    }),
    history: {
      pushState(state, _title, nextUrl) {
        pushedState = state;
        pushedUrl = nextUrl;
        location.hash = nextUrl;
      },
    },
    addEventListener() {},
    setTimeout(callback) {
      callback();
      return 1;
    },
  };

  const script = await Bun.file("Trying/mobile-web-lab.js").text();
  new Function(script)();
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }

  return { document, pushedState, pushedUrl };
}

const _origFetch = globalThis.fetch;

afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
  // Restore original fetch — don't delete Bun's native fetch
  globalThis.fetch = _origFetch;
});

describe("mobile web lab DOM behavior", () => {
  test("file URL disables read-only API without fetching and honors hash route", async () => {
    let fetchCalls = 0;
    const { document } = await runLab("file:///D:/my-app/Trying/mobile-web-lab.html?api=live#bookmarks", async () => {
      fetchCalls += 1;
      throw new Error("fetch should not run for file URLs");
    });

    expect(fetchCalls).toBe(0);
    expect(document.controls.api.checked).toBe(false);
    expect(document.controls.api.disabled).toBe(true);
    expect(document.app.dataset.route).toBe("bookmarks");
    expect(document.screens.find((screen) => screen.dataset.screen === "bookmarks").hidden).toBe(false);
    expect(document.apiStatus.textContent).toContain("file:// stays in mock mode");
  });

  test("http read-only API fetches messages with GET only", async () => {
    const calls = [];
    const { document } = await runLab("http://localhost:5173/Trying/mobile-web-lab.html?api=live", async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: 9, name: "Live", content: "Loaded", likeCount: 2 }],
        }),
      };
    });

    expect(calls).toEqual([
      {
        url: "/api/messages?limit=20",
        init: {
          method: "GET",
          headers: { "Accept": "application/json" },
        },
      },
    ]);
    expect(document.controls.api.checked).toBe(true);
    expect(document.controls.api.disabled).toBe(false);
    expect(document.feedList.children.length).toBe(1);
    expect(document.apiStatus.textContent).toBe("Read-only live API loaded 1 messages.");
  });

  test("dust off cuts Sumi decorative layers on both shell and app", async () => {
    const { document } = await runLab("file:///D:/my-app/Trying/mobile-web-lab.html?theme=sumi&dust=off", async () => {
      throw new Error("fetch should not run in mock mode");
    });

    expect(document.shell.dataset.theme).toBe("sumi");
    expect(document.controls.dust.checked).toBe(false);
    expect(document.shell.classList.contains("dust-off")).toBe(true);
    expect(document.app.classList.contains("dust-off")).toBe(true);
  });

  test("Sumi star field keeps deterministic scatter and clean dust-off scene", async () => {
    const css = await Bun.file("Trying/mobile-web-lab.css").text();

    expect(css).toContain("Fixed pseudo-random coordinates mimic scatter");
    expect(css).toContain("[data-theme=\"sumi\"] .mobile-app::before");
    expect(css).toContain("[data-theme=\"sumi\"] .mobile-app::after");
    expect(css).toContain(".lab-shell.dust-off");
    expect(css).toContain("--lab-scene-clean");
  });
});
