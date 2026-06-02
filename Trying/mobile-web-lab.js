(function () {
  const Core = window.KotobaMobileLabCore;
  const params = new URLSearchParams(window.location.search);
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    flags: Core.parseLabFlags(params),
    route: Core.initialRouteFromLocation(window.location, params),
    theme: Core.normalizeThemeKey(params.get("theme")),
    selectedMessageId: 1,
    pendingImageToken: "",
    apiStatus: "",
    motion: Core.reducedMotionPolicy(media.matches),
    messages: Core.mockMessages(),
  };

  const shell = document.querySelector(".lab-shell");
  const app = document.querySelector("#app");
  const disabledState = document.querySelector(".disabled-state");
  const screens = Array.from(document.querySelectorAll(".mobile-screen"));
  const feedList = document.querySelector("#feed-list");
  const bookmarkList = document.querySelector("#bookmark-list");
  const threadContent = document.querySelector("#thread-content");
  const navButtons = Array.from(document.querySelectorAll("[data-nav]"));
  const composeForm = document.querySelector("[data-action='compose']");
  const replyForm = document.querySelector("[data-action='reply']");
  const composeInput = document.querySelector("#compose-input");
  const replyInput = document.querySelector("#reply-input");
  const imageInput = document.querySelector("#image-input");
  const uploadPreview = document.querySelector("#upload-preview");
  const apiStatus = document.querySelector("#api-status");
  const readonlyBanners = Array.from(document.querySelectorAll("[data-readonly-banner]"));

  const controls = {
    mobile: document.querySelector("#flag-mobile"),
    api: document.querySelector("#flag-api"),
    dust: document.querySelector("#flag-dust"),
    ink: document.querySelector("#flag-ink"),
    theme: document.querySelector("#theme-select"),
    platform: document.querySelector("#platform-select"),
  };

  function apiAdapter() {
    const base = "/api";

    async function requestJSON(path) {
      if (!state.flags.liveApiReadOnly) {
        return mockRequest(path);
      }

      const unavailable = Core.liveApiUnavailableReason(window.location);
      if (unavailable) {
        throw new Error(unavailable);
      }

      const res = await fetch(`${base}${path}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`[HTTP_${res.status}] ${data.error || ""}`);
      if (data.success === false) throw new Error(`[API] ${data.error || "unknown"}`);
      return data;
    }

    return {
      fetchMessages: () => requestJSON("/messages?limit=20"),
      submitMessage: async (content) => {
        if (!Core.canWriteToApi(state.flags)) {
          throw new Error("READ_ONLY_LIVE_API");
        }
        return mockCreateMessage(content);
      },
    };
  }

  function mockRequest(path) {
    if (path.startsWith("/messages")) {
      return Promise.resolve({
        success: true,
        data: state.messages,
        total: state.messages.length,
        offset: 0,
        limit: 20,
      });
    }

    return Promise.resolve({ success: true });
  }

  function mockCreateMessage(content) {
    const message = {
      id: Date.now(),
      name: "demo_user",
      content,
      likeCount: 0,
      bookmarked: false,
    };
    state.messages.unshift(message);
    return Promise.resolve({ success: true, id: message.id });
  }

  const api = apiAdapter();

  function render() {
    state.theme = Core.normalizeThemeKey(state.theme);
    state.route = Core.normalizeRoute(state.route);
    const apiUnavailable = Core.liveApiUnavailableReason(window.location);

    shell.dataset.theme = state.theme;
    shell.dataset.api = Core.apiMode(state.flags);
    shell.dataset.platform = state.flags.platform;
    shell.classList.toggle("dust-off", !state.flags.dust || !state.flags.mobileWebEnabled);
    app.dataset.route = state.route;
    app.classList.toggle("dust-off", !state.flags.dust || !state.flags.mobileWebEnabled);
    app.classList.toggle("platform-ios", state.flags.platform === "ios");
    app.classList.toggle("platform-android", state.flags.platform === "android");
    app.classList.toggle("reduced-motion", media.matches);

    disabledState.hidden = state.flags.mobileWebEnabled;
    screens.forEach((screen) => {
      screen.hidden = !state.flags.mobileWebEnabled || screen.dataset.screen !== state.route;
    });

    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.nav === state.route);
    });

    readonlyBanners.forEach((banner) => {
      banner.hidden = !state.flags.liveApiReadOnly;
    });

    composeForm.classList.toggle("is-readonly", state.flags.liveApiReadOnly);
    replyForm.classList.toggle("is-readonly", state.flags.liveApiReadOnly);
    composeForm.querySelector("[type='submit']").disabled = state.flags.liveApiReadOnly;
    replyForm.querySelector("[type='submit']").disabled = state.flags.liveApiReadOnly;

    controls.mobile.checked = state.flags.mobileWebEnabled;
    controls.api.checked = state.flags.liveApiReadOnly;
    controls.api.disabled = Boolean(apiUnavailable);
    controls.dust.checked = state.flags.dust;
    controls.ink.checked = state.flags.ink;
    controls.theme.value = state.theme;
    controls.platform.value = state.flags.platform;

    apiStatus.textContent = state.apiStatus || (apiUnavailable
      ? apiUnavailable
      : state.flags.liveApiReadOnly
        ? "Read-only live API: GET /api/messages only."
        : "Mock API: safe local data, no database writes.");

    renderMessages();
    renderBookmarks();
    renderThread();
    renderUploadPreview();
  }

  function renderMessages() {
    feedList.replaceChildren(...state.messages.map((message) => messageCard(message)));
  }

  function renderBookmarks() {
    const items = state.messages.filter((message) => message.bookmarked);
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "lab-note";
      empty.textContent = "No saved words yet.";
      bookmarkList.replaceChildren(empty);
      return;
    }
    bookmarkList.replaceChildren(...items.map((message) => messageCard(message)));
  }

  function renderThread() {
    const message = state.messages.find((item) => item.id === state.selectedMessageId) || state.messages[0];
    if (!message) return;

    const root = messageCard(message);
    const reply = document.createElement("article");
    reply.className = "message-card reply-preview";
    reply.innerHTML = `
      <div class="card-top">
        <span class="author"><span class="avatar">回</span>Demo reply</span>
        <span class="eyebrow">depth 1</span>
      </div>
      <p>Mobile detail keeps replies readable without deep inline nesting.</p>
      <div class="card-actions"><button type="button">Reply</button></div>
    `;
    threadContent.replaceChildren(root, reply);
  }

  function renderUploadPreview() {
    if (!state.pendingImageToken) {
      uploadPreview.hidden = true;
      uploadPreview.textContent = "";
      return;
    }
    uploadPreview.hidden = false;
    uploadPreview.textContent = `Prototype token inserted: ${state.pendingImageToken}`;
  }

  function messageCard(message) {
    const card = document.createElement("article");
    card.className = "message-card";
    card.innerHTML = `
      <div class="card-top">
        <span class="author"><span class="avatar">${escapeText(message.name.slice(0, 1))}</span>${escapeText(message.name)}</span>
        <span class="eyebrow">${Number(message.likeCount || 0)} likes</span>
      </div>
      <p>${escapeText(message.content)}</p>
      <div class="card-actions">
        <button type="button" data-open-thread="${Number(message.id)}">Reply</button>
        <button type="button">Like</button>
        <button type="button">${message.bookmarked ? "Saved" : "Save"}</button>
      </div>
    `;
    return card;
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function navigate(route, push = true) {
    if (route === "write") {
      state.route = "home";
      render();
      composeInput.focus();
      return;
    }

    if (route === "back") {
      const next = Core.routeAfterBack(state.route);
      if (next === "exit") {
        state.apiStatus = "Back from Home would leave the mobile surface on Android.";
      } else {
        state.route = next;
      }
      render();
      return;
    }

    state.route = route;
    if (push && window.history?.pushState) {
      window.history.pushState({ route }, "", `#${route}`);
    }
    render();
  }

  function transitionTheme(nextTheme, event) {
    const target = Core.normalizeThemeKey(nextTheme);
    const useInk = state.flags.ink && state.motion.inkTransition;
    if (!useInk) {
      state.theme = target;
      render();
      return;
    }

    const wash = document.createElement("div");
    wash.className = "ink-wash";
    wash.style.setProperty("--ink-x", `${event?.clientX || window.innerWidth / 2}px`);
    wash.style.setProperty("--ink-y", `${event?.clientY || window.innerHeight / 2}px`);
    app.appendChild(wash);
    state.theme = target;
    render();
    window.setTimeout(() => wash.remove(), 700);
  }

  async function refreshMessages() {
    const unavailable = state.flags.liveApiReadOnly ? Core.liveApiUnavailableReason(window.location) : "";
    if (unavailable) {
      state.flags.liveApiReadOnly = false;
      state.apiStatus = unavailable;
      render();
      return;
    }

    state.apiStatus = state.flags.liveApiReadOnly
      ? "Read-only live API: loading messages..."
      : "Mock API: safe local data, no database writes.";
    render();

    try {
      const res = await api.fetchMessages();
      if (Array.isArray(res.data) && state.flags.liveApiReadOnly) {
        state.messages = res.data.map(Core.mapApiMessage);
        state.apiStatus = `Read-only live API loaded ${state.messages.length} messages.`;
      }
    } catch (error) {
      state.apiStatus = `Live API read failed; staying isolated. ${error.message}`;
      state.flags.liveApiReadOnly = false;
    } finally {
      render();
    }
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      navigate(nav.dataset.nav);
      return;
    }

    const thread = event.target.closest("[data-open-thread]");
    if (thread) {
      state.selectedMessageId = Number(thread.dataset.openThread);
      navigate("thread");
      return;
    }

    const themeChoice = event.target.closest("[data-theme-choice]");
    if (themeChoice) {
      transitionTheme(themeChoice.dataset.themeChoice, event);
      return;
    }

    const themeButton = event.target.closest("[data-action='theme']");
    if (themeButton) {
      transitionTheme(Core.nextThemeKey(state.theme), event);
      return;
    }

    const attach = event.target.closest("[data-action='attach']");
    if (attach) {
      imageInput.click();
    }
  });

  composeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = composeInput.value.trim();
    if (!content) return;
    try {
      await api.submitMessage(content);
      composeInput.value = "";
      state.pendingImageToken = "";
      state.apiStatus = "Mock post added locally. No request was sent to /api.";
    } catch (error) {
      state.apiStatus = error.message === "READ_ONLY_LIVE_API"
        ? "Read-only live API blocks posting. Switch Live API off to use mock posting."
        : error.message;
    }
    render();
  });

  replyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.flags.liveApiReadOnly) {
      state.apiStatus = "Read-only live API blocks replies.";
    } else {
      replyInput.value = "";
      state.apiStatus = "Mock reply cleared locally. No request was sent to /api.";
    }
    render();
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    state.pendingImageToken = Core.imageTokenFromFileName(file.name);
    composeInput.value = Core.appendToken(composeInput.value, state.pendingImageToken);
    state.apiStatus = "Image upload prototype only: no file was uploaded.";
    render();
  });

  controls.mobile.addEventListener("change", () => {
    state.flags.mobileWebEnabled = controls.mobile.checked;
    render();
  });
  controls.api.addEventListener("change", () => {
    const unavailable = Core.liveApiUnavailableReason(window.location);
    if (unavailable) {
      state.flags.liveApiReadOnly = false;
      state.apiStatus = unavailable;
      render();
      return;
    }
    state.flags.liveApiReadOnly = controls.api.checked;
    state.apiStatus = "";
    refreshMessages();
  });
  controls.dust.addEventListener("change", () => {
    state.flags.dust = controls.dust.checked;
    render();
  });
  controls.ink.addEventListener("change", () => {
    state.flags.ink = controls.ink.checked;
    render();
  });
  controls.theme.addEventListener("change", (event) => {
    transitionTheme(event.target.value, event);
  });
  controls.platform.addEventListener("change", () => {
    state.flags.platform = Core.normalizePlatform(controls.platform.value);
    render();
  });

  window.addEventListener("popstate", (event) => {
    state.route = event.state?.route || Core.initialRouteFromLocation(window.location, params);
    render();
  });

  media.addEventListener?.("change", () => {
    state.motion = Core.reducedMotionPolicy(media.matches);
    render();
  });

  refreshMessages();
})();
