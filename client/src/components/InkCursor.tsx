import { useEffect, useRef, useState } from "react";

// ponytail: 12-dot lerp chain ink trail — pure transforms, no motion lib needed for this
const TRAIL = 12;
const BASE_SIZE = 26;

export function InkCursor() {
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const dots = dotsRef.current.filter((d): d is HTMLDivElement => d !== null);
    if (dots.length === 0) return;

    const pts = Array.from({ length: TRAIL }, () => ({ x: -100, y: -100 }));
    let mx = -100;
    let my = -100;
    let raf = 0;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        pts.forEach((p) => { p.x = mx; p.y = my; });
        setActive(true);
      }
      if (raf === 0) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      visible = false;
      setActive(false);
      cancelAnimationFrame(raf);
      raf = 0;
    };

    function tick() {
      let movement = Math.abs(mx - pts[0].x) + Math.abs(my - pts[0].y);
      pts[0].x += (mx - pts[0].x) * 0.32;
      pts[0].y += (my - pts[0].y) * 0.32;
      for (let i = 1; i < TRAIL; i++) {
        movement = Math.max(
          movement,
          Math.abs(pts[i - 1].x - pts[i].x) + Math.abs(pts[i - 1].y - pts[i].y),
        );
        pts[i].x += (pts[i - 1].x - pts[i].x) * 0.32;
        pts[i].y += (pts[i - 1].y - pts[i].y) * 0.32;
      }
      for (let i = 0; i < dots.length; i++) {
        const scale = 1 - (i / TRAIL) * 0.82;
        dots[i].style.transform =
          `translate3d(${pts[i].x}px, ${pts[i].y}px, 0) scale(${scale})`;
      }
      raf = visible && movement > 0.05 ? requestAnimationFrame(tick) : 0;
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="ink-cursor" aria-hidden="true" style={{ opacity: active ? 1 : 0 }}>
      {Array.from({ length: TRAIL }, (_, i) => (
        <div
          key={i}
          ref={(el) => { dotsRef.current[i] = el; }}
          className="ink-cursor-dot"
          style={{ width: BASE_SIZE, height: BASE_SIZE, opacity: 0.6 - (i / TRAIL) * 0.5 }}
        />
      ))}
    </div>
  );
}
