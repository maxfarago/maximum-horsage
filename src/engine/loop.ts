export function startLoop(update: (dt: number) => void, render: (alpha: number) => void, dt: number) {
  let acc = 0;
  let last = performance.now();
  const tick = (now: number) => {
    acc += (now - last) / 1000;
    last = now;
    if (acc > 0.25) acc = 0.25;
    while (acc >= dt) {
      update(dt);
      acc -= dt;
    }
    render(acc / dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
