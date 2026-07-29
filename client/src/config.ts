export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_SCRIPT_ID = "turnstile-script";

interface TurnstileSiteKeyOptions {
  buildKey?: string;
  runtimeKey?: string;
  production: boolean;
}

export function resolveTurnstileSiteKey({
  buildKey,
  runtimeKey,
  production,
}: TurnstileSiteKeyOptions): string | null {
  const key = buildKey?.trim() || runtimeKey?.trim() || "";
  if (!key) return production ? null : TURNSTILE_TEST_SITE_KEY;
  if (production && key === TURNSTILE_TEST_SITE_KEY) return null;
  return key;
}

interface TurnstileResetter {
  reset: (id?: string) => void;
}

interface TurnstileWidgetApi {
  render: (container: HTMLElement, options: { sitekey: string }) => string;
  remove: (id: string) => void;
}

interface TurnstileMountOptions {
  script: EventTarget | null;
  getTurnstile: () => TurnstileWidgetApi | undefined;
  container: HTMLElement;
  siteKey: string;
  onWidgetId: (id: string | undefined) => void;
}

export function resetTurnstileWidget(
  turnstile: TurnstileResetter | undefined,
  widgetId: string | undefined,
) {
  if (!turnstile || widgetId === undefined) return;
  turnstile.reset(widgetId);
}

export function mountTurnstileWidget({
  script,
  getTurnstile,
  container,
  siteKey,
  onWidgetId,
}: TurnstileMountOptions) {
  let disposed = false;
  let widgetId: string | undefined;
  let renderedBy: TurnstileWidgetApi | undefined;
  const render = () => {
    if (disposed || widgetId !== undefined) return;
    const turnstile = getTurnstile();
    if (!turnstile) return;
    renderedBy = turnstile;
    widgetId = turnstile.render(container, { sitekey: siteKey });
    onWidgetId(widgetId);
  };

  script?.addEventListener("load", render);
  render();

  return () => {
    disposed = true;
    script?.removeEventListener("load", render);
    if (widgetId !== undefined) renderedBy?.remove(widgetId);
    onWidgetId(undefined);
  };
}
