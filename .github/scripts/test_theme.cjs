// Behavior tests for the standalone theme script, without a browser dependency.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const source = readFileSync(resolve(__dirname, "../../assets/theme.js"), "utf8");

function setup(options = {}) {
  const events = {};
  const attrs = {};
  const properties = new Map();
  const classes = new Set();
  const storage = new Map([["philipp-theme", options.saved]]);
  const system = { matches: !!options.dark, addEventListener: (_, fn) => events.system = fn };
  const motion = { matches: !!options.reduced, addEventListener: (_, fn) => events.motion = fn, removeEventListener: () => delete events.motion };
  const root = {
    dataset: {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) },
    animate: (_, settings) => {
      assert.equal(settings.pseudoElement, "::view-transition-new(root)");
      assert.equal(settings.duration, 620);
      let rejectAnimation;
      const finished = options.interrupt ? new Promise((_, reject) => { rejectAnimation = reject; }) : Promise.resolve();
      if (options.interrupt) queueMicrotask(() => events[options.interrupt]());
      return { finished, cancel() { rejectAnimation?.(Error("Animation cancelled")); } };
    },
  };
  const button = { hidden: true, setAttribute: (key, value) => attrs[key] = value, addEventListener: (_, fn) => events.click = fn };
  const calendar = { decode: () => Promise.resolve(), dataset: { lightSrc: "light.svg", darkSrc: "dark.svg" } };
  let transitions = 0;
  let imageCount = 0;
  const context = {
    document: {
      visibilityState: options.hidden ? "hidden" : "visible",
      addEventListener: (key, fn) => events[key] = fn,
      removeEventListener: key => delete events[key],
      documentElement: root,
      querySelector: selector => selector === ".theme-toggle" ? button : selector === "[data-dark-src]" ? calendar : {},
    },
    window: { addEventListener: (key, fn) => events[key] = fn, removeEventListener: key => delete events[key] },
    localStorage: {
      getItem: key => { if (options.blocked) throw Error("Storage blocked"); return storage.get(key); },
      setItem: (key, value) => { if (options.blocked) throw Error("Storage blocked"); storage.set(key, value); },
    },
    matchMedia: query => query.includes("reduced") ? motion : system,
    CSS: { supports: () => !options.unsupported },
    Image: class {
      constructor() { imageCount++; }
      decode() { return options.decodeFails ? Promise.reject(Error("Decode failed")) : Promise.resolve(); }
    },
    innerWidth: 390,
    innerHeight: 844,
    setTimeout,
    clearTimeout,
  };
  if (options.transitions) context.document.startViewTransition = update => {
    transitions++;
    const updated = update();
    return { ready: options.readyFails ? Promise.reject(Error("Capture skipped")) : updated, finished: Promise.resolve(), skipTransition() {} };
  };
  vm.runInNewContext(source, context);
  return { events, attrs, root, button, calendar, storage, system, classes, properties, get transitions() { return transitions; }, get images() { return imageCount; } };
}

(async () => {
  const saved = setup({ saved: "light", dark: true });
  assert.equal(saved.root.dataset.theme, "light");
  assert.equal(saved.button.hidden, false);
  await saved.events.click();
  assert.equal(saved.root.dataset.theme, "dark");
  assert.equal(saved.calendar.src, "dark.svg");
  assert.equal(saved.attrs["aria-pressed"], "true");
  assert.equal(saved.storage.get("philipp-theme"), "dark");
  await saved.events.click();
  assert.equal(saved.root.dataset.theme, "light");

  const blocked = setup({ blocked: true, dark: true });
  await blocked.events.click();
  blocked.events.system();
  assert.equal(blocked.root.dataset.theme, "light");

  const reduced = setup({ reduced: true, transitions: true });
  await reduced.events.click();
  assert.equal(reduced.images, 0);
  assert.equal(reduced.transitions, 0);
  assert.equal(reduced.root.dataset.theme, "dark");

  const hidden = setup({ hidden: true, transitions: true });
  await hidden.events.click();
  assert.equal(hidden.images, 0);
  assert.equal(hidden.transitions, 0);
  assert.equal(hidden.root.dataset.theme, "dark");

  const animated = setup({ transitions: true });
  await Promise.all([animated.events.click(), animated.events.click()]);
  assert.equal(animated.transitions, 1);
  assert.equal(animated.root.dataset.theme, "dark");
  assert.equal(animated.classes.size, 0);
  assert.equal(animated.properties.size, 0);
  await animated.events.click();
  assert.equal(animated.transitions, 2);
  assert.equal(animated.root.dataset.theme, "light");

  for (const failure of [{ decodeFails: true }, { readyFails: true }]) {
    const fallback = setup({ transitions: true, ...failure });
    await fallback.events.click();
    assert.equal(fallback.root.dataset.theme, "dark");
    assert.equal(fallback.classes.size, 0);
    assert.equal(fallback.properties.size, 0);
    await fallback.events.click();
    assert.equal(fallback.root.dataset.theme, "light");
  }

  for (const interrupt of ["resize", "scroll", "motion"]) {
    const interrupted = setup({ transitions: true, interrupt });
    await interrupted.events.click();
    assert.equal(interrupted.root.dataset.theme, "dark");
    assert.equal(interrupted.classes.size, 0);
    assert.equal(interrupted.properties.size, 0);
    await interrupted.events.click();
    assert.equal(interrupted.root.dataset.theme, "light");
  }

  const unsupported = setup({ transitions: true, unsupported: true });
  await unsupported.events.click();
  assert.equal(unsupported.transitions, 0);
  assert.equal(unsupported.root.dataset.theme, "dark");

  const automatic = setup({ saved: "invalid", dark: true });
  assert.equal(automatic.root.dataset.theme, "dark");
  automatic.system.matches = false;
  automatic.events.system();
  assert.equal(automatic.root.dataset.theme, "light");
  automatic.storage.set("philipp-theme", "dark");
  automatic.events.storage({ key: "philipp-theme" });
  assert.equal(automatic.root.dataset.theme, "dark");
  automatic.storage.clear();
  automatic.events.storage({ key: null });
  assert.equal(automatic.root.dataset.theme, "light");
  console.log("Theme checks passed: preference, storage failure/sync, reduced motion, fallback, repeated clicks, and cleanup.");
})().catch(error => { console.error(error); process.exitCode = 1; });
