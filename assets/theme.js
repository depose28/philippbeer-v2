(() => {
  "use strict";

  const root = document.documentElement;
  const button = document.querySelector(".theme-toggle");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const calendar = document.querySelector("[data-dark-src]");
  const system = matchMedia("(prefers-color-scheme: dark)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "philipp-theme";
  let preference = readPreference();
  let activeTransition = null;
  let busy = false;

  function readPreference() {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    if (calendar) calendar.src = theme === "dark" ? calendar.dataset.darkSrc : calendar.dataset.lightSrc;
    themeColor.content = theme === "dark" ? "#191c18" : "#faf9f6";
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.title = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  }

  // One fixed stipple field, never frame-by-frame randomness or a live canvas.
  // Its density increases towards the opaque edge, with a gentle diagonal drift.
  function makeMask(width, height) {
    const cell = Math.max(5, Math.ceil(height / 220));
    const band = cell * 22;
    const drift = cell * 10;
    const travel = width + band + drift;
    const maskWidth = travel + width;
    const paths = [];
    const glyphs = [];
    let seed = 1729;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let y = 0; y < height; y += cell) {
      const start = width + Math.floor((y / height) * drift / cell) * cell;
      paths.push(`M${start + band} ${y}h${maskWidth - start - band}v${cell}H${start + band}Z`);
      for (let column = 0; column < 22; column++) {
        const density = column / 21;
        if (random() > density * density * (3 - 2 * density)) continue;
        const x = start + column * cell;
        if (column > 3 && column < 17 && random() < .045) {
          glyphs.push(`<text x="${x}" y="${y + cell - 1}">${column % 2 ? "+" : ":"}</text>`);
        } else {
          paths.push(`M${x} ${y}h${cell}v${cell}h-${cell}Z`);
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maskWidth}" height="${height}"><path fill="white" d="${paths.join("")}"/><g fill="white" font-family="monospace" font-size="${cell}">${glyphs.join("")}</g></svg>`;
    return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: maskWidth, height, travel };
  }

  function clearMask() {
    root.classList.remove("theme-shift");
    for (const name of ["--theme-mask", "--theme-mask-size", "--theme-mask-end"]) {
      root.style.removeProperty(name);
    }
  }

  async function toggle() {
    if (busy) return;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    preference = theme;
    try { localStorage.setItem(storageKey, theme); } catch {}
    if (document.visibilityState !== "visible" || reducedMotion.matches || !document.startViewTransition ||
        !CSS.supports("mask-image", 'url("data:image/svg+xml,<svg/>")')) {
      apply(theme);
      return;
    }

    busy = true;
    let transition;
    let animation;
    const stop = () => { animation?.cancel(); transition?.skipTransition(); };
    const visibilityChanged = () => { if (document.visibilityState !== "visible") stop(); };
    let timeout;
    try {
      const mask = makeMask(innerWidth, innerHeight);
      // Decode the SVG before capture to reduce work on the first frame.
      const image = new Image();
      image.src = mask.url;
      const assets = [image.decode()];
      if (calendar) {
        const chart = new Image();
        chart.src = theme === "dark" ? calendar.dataset.darkSrc : calendar.dataset.lightSrc;
        assets.push(chart.decode());
      }
      await Promise.race([
        Promise.all(assets),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Mask decode timeout")), 600); }),
      ]);
      clearTimeout(timeout);
      if (preference !== theme) return;
      if (document.visibilityState !== "visible" || reducedMotion.matches) { apply(theme); return; }
      root.style.setProperty("--theme-mask", `url("${mask.url}")`);
      root.style.setProperty("--theme-mask-size", `${mask.width}px 100%`);
      root.style.setProperty("--theme-mask-end", `-${mask.travel}px 0px`);
      root.classList.add("theme-shift");
      transition = document.startViewTransition(async () => {
        apply(preference || (system.matches ? "dark" : "light"));
        if (calendar) {
          let chartTimeout;
          try {
            await Promise.race([
              calendar.decode().catch(() => {}),
              new Promise(resolve => { chartTimeout = setTimeout(resolve, 300); }),
            ]);
          } finally { clearTimeout(chartTimeout); }
        }
      });
      activeTransition = { skipTransition: stop };
      // Resizing or requesting reduced motion cancels the effect, never the choice.
      window.addEventListener("resize", stop);
      window.addEventListener("scroll", stop, { passive: true });
      document.addEventListener("visibilitychange", visibilityChanged);
      reducedMotion.addEventListener("change", stop);
      await transition.ready;
      animation = root.animate(
        { maskPosition: ["0px 0px", `-${mask.travel}px 0px`] },
        { duration: 620, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
      await animation.finished;
      await transition.finished;
    } catch {
      transition?.skipTransition();
      apply(preference || (system.matches ? "dark" : "light"));
    } finally {
      clearTimeout(timeout);
      window.removeEventListener("resize", stop);
      window.removeEventListener("scroll", stop);
      document.removeEventListener("visibilitychange", visibilityChanged);
      reducedMotion.removeEventListener("change", stop);
      activeTransition = null;
      clearMask();
      busy = false;
    }
  }

  apply(preference || (system.matches ? "dark" : "light"));
  button.hidden = false;
  button.addEventListener("click", toggle);
  system.addEventListener("change", () => {
    if (!preference) apply(system.matches ? "dark" : "light");
  });
  window.addEventListener("storage", event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = readPreference();
    activeTransition?.skipTransition();
    apply(preference || (system.matches ? "dark" : "light"));
  });
})();
