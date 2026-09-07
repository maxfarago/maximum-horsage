export function makeInput() {
  let action = false;
  let overlay = false;

  const down = (e: Event) => {
    if (e instanceof KeyboardEvent) {
      if (e.repeat) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        action = true;
      }
      if (e.key === "d" || e.key === "D") overlay = true;
    } else {
      if ((e.target as HTMLElement | null)?.closest?.("nav")) return;
      action = true;
    }
  };

  window.addEventListener("keydown", down);
  window.addEventListener("pointerdown", down);

  return {
    consumeAction() {
      const v = action;
      action = false;
      return v;
    },
    consumeOverlay() {
      const v = overlay;
      overlay = false;
      return v;
    },
  };
}
