import { describe, expect, it } from "bun:test";
import {
  TURNSTILE_TEST_SITE_KEY,
  resolveTurnstileSiteKey,
  resetTurnstileWidget,
} from "../../client/src/config";
import * as clientConfig from "../../client/src/config";
import { parseApiError, t } from "../../client/src/i18n";

describe("client production configuration", () => {
  it("accepts only a non-test Turnstile site key in production", () => {
    expect(resolveTurnstileSiteKey({
      buildKey: "real-site-key",
      runtimeKey: undefined,
      production: true,
    })).toBe("real-site-key");
    expect(resolveTurnstileSiteKey({
      buildKey: TURNSTILE_TEST_SITE_KEY,
      runtimeKey: undefined,
      production: true,
    })).toBeNull();
    expect(resolveTurnstileSiteKey({
      buildKey: undefined,
      runtimeKey: undefined,
      production: true,
    })).toBeNull();
  });

  it("keeps the official test key available for local development", () => {
    expect(resolveTurnstileSiteKey({
      buildKey: undefined,
      runtimeKey: undefined,
      production: false,
    })).toBe(TURNSTILE_TEST_SITE_KEY);
  });

  it("does not reset Turnstile when sign-in created no widget", () => {
    const resets: string[] = [];
    const turnstile = { reset: (id?: string) => resets.push(id ?? "all") };
    resetTurnstileWidget(turnstile, undefined);
    expect(resets).toEqual([]);
    resetTurnstileWidget(turnstile, "widget-1");
    expect(resets).toEqual(["widget-1"]);
  });

  it("renders after the async Turnstile script loads and removes the widget on cleanup", () => {
    const mountTurnstileWidget = Reflect.get(
      clientConfig,
      "mountTurnstileWidget",
    ) as undefined | ((options: {
      script: EventTarget | null;
      getTurnstile: () => {
        render: (container: HTMLElement, options: { sitekey: string }) => string;
        remove: (id: string) => void;
      } | undefined;
      container: HTMLElement;
      siteKey: string;
      onWidgetId: (id: string | undefined) => void;
    }) => () => void);
    expect(typeof mountTurnstileWidget).toBe("function");

    const script = new EventTarget();
    const renders: string[] = [];
    const removals: string[] = [];
    const widgetIds: Array<string | undefined> = [];
    let turnstile: {
      render: (container: HTMLElement, options: { sitekey: string }) => string;
      remove: (id: string) => void;
    } | undefined;
    const cleanup = mountTurnstileWidget!({
      script,
      getTurnstile: () => turnstile,
      container: {} as HTMLElement,
      siteKey: "real-site-key",
      onWidgetId: (id) => widgetIds.push(id),
    });

    expect(renders).toEqual([]);
    turnstile = {
      render: (_container, options) => {
        renders.push(options.sitekey);
        return "widget-late";
      },
      remove: (id) => removals.push(id),
    };
    script.dispatchEvent(new Event("load"));
    expect(renders).toEqual(["real-site-key"]);
    expect(widgetIds).toEqual(["widget-late"]);

    cleanup();
    expect(removals).toEqual(["widget-late"]);
    expect(widgetIds).toEqual(["widget-late", undefined]);
    script.dispatchEvent(new Event("load"));
    expect(renders).toEqual(["real-site-key"]);
  });
});

describe("localized API errors", () => {
  it("maps known API codes and hides unknown machine errors", () => {
    expect(parseApiError("zh", "[HTTP_401] AUTH_REQUIRED", "auth.network"))
      .toBe(t("zh", "error.AUTH_REQUIRED"));
    expect(parseApiError("zh", "[HTTP_502] UPSTREAM_BROKEN", "auth.network"))
      .toBe(t("zh", "auth.network"));
    expect(parseApiError("ja", "Failed to fetch", "list.loadFail"))
      .toBe(t("ja", "list.loadFail"));
  });
});
