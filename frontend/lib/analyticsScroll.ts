const SCROLL_STORAGE_KEY = "admin-student-analytics-scroll";

type ScrollSnapshot =
  | { type: "anchor"; anchorId: string; offsetTop: number }
  | { type: "y"; y: number };

function readSnapshot(): ScrollSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ScrollSnapshot;
    if (parsed.type === "anchor" && parsed.anchorId) return parsed;
    if (parsed.type === "y" && Number.isFinite(parsed.y)) return parsed;
  } catch {
    const y = Number(raw);
    if (Number.isFinite(y)) return { type: "y", y };
  }
  return null;
}

function getStickyOffset(): number {
  const headerHeight = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-header-height"),
  );
  const tabBar = document.querySelector(".student-sheet-bar");
  const tabBarHeight = tabBar?.getBoundingClientRect().height ?? 0;
  return (Number.isFinite(headerHeight) ? headerHeight : 72) + tabBarHeight + 8;
}

export function saveAnalyticsScrollPosition() {
  if (typeof window === "undefined") return;

  const anchors = [...document.querySelectorAll<HTMLElement>("[data-analytics-anchor]")];
  if (anchors.length > 0) {
    const stickyOffset = getStickyOffset();
    let chosen = anchors[0];
    let bestDistance = Infinity;

    for (const element of anchors) {
      const top = element.getBoundingClientRect().top;
      if (top > window.innerHeight) continue;
      const distance = Math.abs(top - stickyOffset);
      if (distance < bestDistance) {
        bestDistance = distance;
        chosen = element;
      }
    }

    const snapshot: ScrollSnapshot = {
      type: "anchor",
      anchorId: chosen.id,
      offsetTop: chosen.getBoundingClientRect().top,
    };
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(snapshot));
    return;
  }

  sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify({ type: "y", y: window.scrollY }));
}

function applySnapshot(snapshot: ScrollSnapshot): boolean {
  if (snapshot.type === "anchor") {
    const element = document.getElementById(snapshot.anchorId);
    if (!element) return false;
    const delta = element.getBoundingClientRect().top - snapshot.offsetTop;
    if (Math.abs(delta) > 0.5) {
      window.scrollBy(0, delta);
    }
    return true;
  }

  window.scrollTo({ top: snapshot.y, left: 0, behavior: "instant" });
  return true;
}

export function restoreAnalyticsScrollPosition() {
  if (typeof window === "undefined") return;
  const snapshot = readSnapshot();
  if (!snapshot) return;

  const run = () => applySnapshot(snapshot);

  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(() => {
      run();
      window.setTimeout(() => {
        run();
        sessionStorage.removeItem(SCROLL_STORAGE_KEY);
      }, 80);
      window.setTimeout(run, 200);
    });
  });
}

export function clearAnalyticsScrollPosition() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SCROLL_STORAGE_KEY);
}
