/* DOM/event regression tests. Requires jsdom; does not claim browser layout testing. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { JSDOM } = require("jsdom");
const { Game } = require("./engine.js");
let count = 0;
function check(v, m) {
  assert.ok(v, m);
  count++;
}
function setup(w = 390, h = 844, stored = null, blocked = false) {
  const dom = new JSDOM(fs.readFileSync(__dirname + "/index.html", "utf8"), {
    url: "https://tideglass.test",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  let win = dom.window,
    time = 1000,
    timers = [],
    frames = [];
  Object.defineProperty(win.performance, "now", { value: () => time });
  win.setTimeout = (fn, delay) => {
    timers.push({ fn, at: time + delay });
    return timers.length;
  };
  win.requestAnimationFrame = (fn) => frames.push(fn);
  win.Date.now = () => 123456789;
  win.matchMedia = () => ({ matches: false });
  const audio = { tones: 0, splashes: 0 };
  const param = () => ({value: 260, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}});
  const node = () => ({connect() {}, disconnect() {}, stop() {}});
  win.AudioContext = class {
    get currentTime() { return time / 1000; }
    state = "running";
    sampleRate = 44100;
    destination = {};
    createOscillator() { return {...node(), frequency: param(), start() {audio.tones++;}}; }
    createGain() { return {...node(), gain: param()}; }
    createBiquadFilter() { return {...node(), frequency: param()}; }
    createBuffer(channels, length) { return {getChannelData: () => new Float32Array(length)}; }
    createBufferSource() { return {...node(), start() {audio.splashes++;}}; }
  };
  const width = Math.min(w - 66, 384),
    rect = { left: 33, top: 180, width, height: (width * 8) / 6 };
  win.HTMLCanvasElement.prototype.getBoundingClientRect = () => rect;
  win.HTMLCanvasElement.prototype.setPointerCapture = () => {};
  let draws = 0;
  const noop = () => {};
  const context = new Proxy(
    {
      clearRect: () => {
        draws++;
      },
      createLinearGradient: () => ({ addColorStop: noop }),
    },
    {
      get: (obj, key) => obj[key] || noop,
      set: (obj, key, value) => ((obj[key] = value), true),
    },
  );
  win.HTMLCanvasElement.prototype.getContext = () => context;
  win.ResizeObserver = class {
    constructor(fn) {
      this.fn = fn;
    }
    observe() {
      this.fn();
    }
  };
  if (stored !== null) win.localStorage.setItem("tideglass-v1", stored);
  if (blocked)
    Object.defineProperty(win, "localStorage", {
      get() {
        throw Error("denied");
      },
    });
  win.eval(fs.readFileSync(__dirname + "/engine.js", "utf8"));
  win.eval(fs.readFileSync(__dirname + "/game.js", "utf8"));
  const doc = win.document;
  function advance(ms = 400) {
    time += ms;
    let due = timers.filter((t) => t.at <= time);
    timers = timers.filter((t) => t.at > time);
    due.forEach((t) => t.fn());
    let r = frames;
    frames = [];
    r.forEach((f) => f(time));
  }
  function click(id) {
    doc.getElementById(id).click();
    advance(30);
  }
  function pointer(type, i, id = 1) {
    const e = new win.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, {
      pointerId: id,
      button: 0,
      clientX: rect.left + (((i % 6) + 0.5) * width) / 6,
      clientY: rect.top + ((Math.floor(i / 6) + 0.5) * width) / 6,
    });
    doc.getElementById("board").dispatchEvent(e);
  }
  function play(p) {
    pointer("pointerdown", p[0]);
    p.slice(1).forEach((i) => pointer("pointermove", i));
    pointer("pointerup", p.at(-1));
    advance();
  }
  return {
    win,
    audio,
    doc,
    advance,
    click,
    pointer,
    play,
    draws: () => draws,
    snap: () => win.tideglass.snapshot(),
  };
}
for (const [width, height] of [
  [320, 568],
  [375, 667],
  [390, 844],
  [768, 1024],
  [1366, 768],
]) {
  const t = setup(width, height);
  check(t.snap().mode === "menu", "menu");
  t.click("start");
  t.advance();
  check(t.snap().mode === "play", "start");
  let g = new Game(1);
  g.board = t.snap().board;
  let p = g.findMove();
  t.play(p);
  check(t.snap().turn === 1, "pointer chain " + width);
  check(t.snap().score >= 60, "score");
  const before = t.snap().turn;
  t.pointer("pointerdown", p[0]);
  t.pointer("pointercancel", p[0]);
  check(t.snap().path.length === 0, "cancel");
  check(t.snap().turn === before, "cancel no turn");
  t.click("pause");
  check(t.snap().mode === "pause", "pause");
  t.click("resume");
  check(t.snap().mode === "play", "resume");
  t.click("help");
  check(t.snap().mode === "help", "help");
  t.click("back");
  check(t.snap().mode === "play", "back");
  t.click("sound");
  check(t.snap().saved.mute === true, "mute saved");
  t.click("pause");
  t.click("restart");
  check(
    t.snap().turn === 0 && t.snap().score === 0 && t.snap().charge === 0,
    "restart clean",
  );
  t.advance();
  g.board = t.snap().board;
  p = g.findMove();
  t.pointer("pointerdown", p[0], 1);
  t.pointer("pointerdown", p[1], 2);
  check(t.snap().path.length === 1, "ignore second pointer");
  t.pointer("pointercancel", p[0]);
  for (let step = 0; step < 100 && t.snap().mode === "play"; step++) {
    g.board = t.snap().board;
    p = g.findMove();
    check(p, "move exists");
    t.play(p);
    t.advance(700);
  }
  check(t.snap().mode === "over", "game over dialog");
  check(t.snap().saved.best > 0, "persist record");
  t.click("again");
  check(t.snap().score === 0 && t.snap().mode === "play", "retry after loss");
  t.win.close();
}
for (const stored of [
  "{bad json",
  "null",
  "[]",
  '{"best":-7,"theme":99,"mute":"yes"}',
  '{"best":999999999999999999999,"longest":null}',
]) {
  const t = setup(390, 844, stored);
  check(t.snap().saved.best === 0, "sanitize best");
  check(t.snap().saved.theme === 0, "sanitize theme");
  t.click("start");
  check(t.snap().mode === "play", "corrupt storage playable");
  t.win.close();
}
{
  const t = setup(390, 844, null, true);
  t.click("start");
  t.click("sound");
  t.click("pause");
  t.click("restart");
  check(t.snap().mode === "play", "blocked storage works");
  t.win.close();
}
// A naturally occurring loop can be drawn through the full pointer interaction.
{
  const t = setup();
  t.click("start");
  t.advance();
  let found = false;
  for (let step = 0; step < 45 && !t.snap().over; step++) {
    const mirror = new Game(123);
    mirror.board = t.snap().board;
    const ring = mirror.findLoop(9);
    if (ring) {
      t.pointer("pointerdown", ring[0]);
      ring.slice(1).forEach((i) => t.pointer("pointermove", i));
      t.pointer("pointermove", ring[0]);
      check(t.snap().looped, "loop closes in UI");
      t.pointer("pointerup", ring[0]);
      t.advance();
      check(t.snap().loops === 1, "loop commits in UI");
      found = true;
      break;
    }
    let longest = [];
    const walk = (path) => {
      if (path.length > longest.length) longest = [...path];
      if (path.length >= 9) return;
      const a = path.at(-1);
      for (let i = 0; i < 48; i++)
        if (
          mirror.board[i]?.color === mirror.board[a].color &&
          mirror.adjacent(a, i) &&
          !path.includes(i)
        )
          walk([...path, i]);
    };
    for (let i = 0; i < 48; i++)
      if (mirror.board[i] && mirror.board[i].color >= 0) walk([i]);
    t.play(longest.length >= 3 ? longest : mirror.findMove());
    t.advance();
  }
  check(found, "reachable loop found");
  t.win.close();
}
// Persistent journal is complete, navigable, and derived from sanitized progress.
{
  const t = setup(
    390,
    844,
    JSON.stringify({
      best: 12000,
      runs: 8,
      total: 1800,
      longest: 11,
      loops: 3,
      bestFlow: 4,
      missions: 5,
      theme: 2,
      mute: true,
    }),
  );
  t.click("journal");
  check(t.snap().mode === "journal", "journal opens");
  check(
    t.doc.querySelectorAll(".badge.earned").length === 5,
    "all earned badges shown",
  );
  check(
    t.doc.querySelector(".log-stats").textContent.includes("1.800"),
    "journal total",
  );
  t.click("journal-back");
  check(t.snap().mode === "menu", "journal back");
  t.win.close();
}
// Keyboard path and switching input method.
{
  const t = setup();
  t.click("start");
  t.advance();
  let g = new Game(1);
  g.board = t.snap().board;
  const p = g.findMove();
  let cursor = 42;
  const key = (k) =>
    t.doc.dispatchEvent(
      new t.win.KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
      }),
    );
  for (const i of p) {
    while (cursor % 6 < i % 6) {
      key("ArrowRight");
      cursor++;
    }
    while (cursor % 6 > i % 6) {
      key("ArrowLeft");
      cursor--;
    }
    while (Math.floor(cursor / 6) < Math.floor(i / 6)) {
      key("ArrowDown");
      cursor += 6;
    }
    while (Math.floor(cursor / 6) > Math.floor(i / 6)) {
      key("ArrowUp");
      cursor -= 6;
    }
    key(" ");
  }
  check(t.snap().path.length === 3, "keyboard selection");
  key("Enter");
  check(t.snap().turn === 1, "keyboard commit");
  key("Enter");
  check(t.snap().turn === 1, "rapid input ignored");
  t.advance();
  g.board = t.snap().board;
  t.play(g.findMove());
  check(t.snap().turn === 2, "switch to pointer");
  t.win.close();
}
// Pause during the loss animation must still reach the result screen.
{
  const t = setup();
  t.click("start");
  t.advance();
  let g = new Game(1);
  for (let n = 0; n < 30 && !t.snap().over; n++) {
    g.board = t.snap().board;
    t.play(g.findMove());
  }
  check(t.snap().over, "loss reached");
  t.click("pause");
  check(t.snap().mode === "pause", "pause during loss");
  t.click("resume");
  check(t.snap().mode === "over", "resume cannot strand finished run");
  t.win.close();
}
// A saved voyage resumes exactly and records progress once, after completion.
{
  const t = setup();
  t.click("start");
  t.advance();
  let mirror = new Game(1);
  mirror.board = t.snap().board;
  t.play(mirror.findMove());
  const expected = t.snap();
  const payload = t.win.localStorage.getItem("tideglass-v1");
  const u = setup(390, 844, payload);
  check(!!u.doc.getElementById("continue-run"), "continue offered");
  u.click("continue-run");
  check(
    u.snap().score === expected.score && u.snap().turn === expected.turn,
    "score and turn restored",
  );
  check(
    JSON.stringify(u.snap().board) === JSON.stringify(expected.board),
    "board restored",
  );
  check(u.snap().saved.runs === 0, "opening is not a completed run");
  u.click("pause");
  u.click("home");
  check(!!u.doc.getElementById("continue-run"), "menu keeps voyage");
  u.click("continue-run");
  u.advance();
  mirror.board = u.snap().board;
  u.play(mirror.findMove());
  u.win.dispatchEvent(new u.win.Event("pagehide"));
  check(u.snap().saved.runs === 0, "pagehide does not finalize");
  u.click("pause");
  u.click("restart");
  check(u.snap().saved.runs === 1, "abandoned voyage recorded once");
  check(u.snap().saved.total >= 6, "all voyage crystals counted");
  t.win.close();
  u.win.close();
}
// Corrupted active data preserves the profile and safely starts from the menu.
{
  const t = setup(
    390,
    844,
    JSON.stringify({
      best: 2300,
      active: { missionIndex: 0, missionDone: false, game: { version: 1 } },
    }),
  );
  check(
    t.snap().saved.best === 2300 && !t.doc.getElementById("continue-run"),
    "corrupt active preserves best",
  );
  t.win.close();
}
// Another finger cancelling does not cancel the active drag.
{
  const t = setup();
  t.click("start");
  t.advance();
  const mirror = new Game(1);
  mirror.board = t.snap().board;
  const p = mirror.findMove();
  t.pointer("pointerdown", p[0], 1);
  t.pointer("pointercancel", p[1], 2);
  check(t.snap().path.length === 1, "unrelated pointer cancellation ignored");
  t.pointer("pointermove", p[1], 1);
  t.pointer("pointermove", p[2], 1);
  t.pointer("pointerup", p[2], 1);
  check(t.snap().turn === 1, "active finger can finish");
  t.win.close();
}
// A mission earned on the losing move still awards its displayed 300 points.
{
  const g = new Game(1);
  g.board = Array.from({ length: 48 }, (_, i) => ({
    id: i + 1,
    color: 0,
    star: false,
  }));
  g.id = 48;
  g.flow = 2;
  g.bestFlow = 2;
  const t = setup(
    390,
    844,
    JSON.stringify({
      active: { game: g.serialize(), missionIndex: 2, missionDone: false },
    }),
  );
  t.click("continue-run");
  t.advance();
  const preview = g.preview([42, 43, 44, 45, 46]);
  t.play([42, 43, 44, 45, 46]);
  check(
    t.snap().over && t.snap().missionDone,
    "fatal move earns flow objective",
  );
  check(t.snap().score === preview + 300, "fatal mission award exact");
  check(
    t.snap().saved.best === preview + 300,
    "fatal score persisted before animation ends",
  );
  t.win.close();
}
// Menus must not repeatedly repaint the board behind the overlay.
{
  const t = setup();
  t.advance();
  const baseline = t.draws();
  for (let n = 0; n < 20; n++) t.advance(100);
  check(t.draws() === baseline, "idle menu repaint stopped");
  t.click("start");
  t.advance();
  const running = t.draws();
  t.advance();
  check(t.draws() > running, "playing animation resumes");
  t.click("pause");
  t.advance();
  const stopped = t.draws();
  for (let n = 0; n < 20; n++) t.advance(100);
  check(t.draws() === stopped, "paused repaint stopped");
  t.win.close();
}
{
  const t = setup();
  t.click("start");
  const tones = t.audio.tones, splashes = t.audio.splashes;
  const g = new Game();
  g.board = t.snap().board;
  const move = g.findMove();
  t.play(move);
  check(t.audio.tones > tones, "chain and clear synth voices");
  check(t.audio.splashes > splashes, "filtered splash audio produced");
  for (let i = 0; i < 40; i++) t.advance(20);
  check(t.draws() > 30, "particle lifetime and glossy render frames");
  t.click("sound");
  const muted = t.audio.tones;
  g.board = t.snap().board;
  t.play(g.findMove());
  check(t.audio.tones === muted, "muting suppresses synth voices");
  t.win.close();
  const old = setup(390, 844, JSON.stringify({best: 9000, theme: 3, mute: true}));
  check(old.snap().saved.best === 9000 && old.snap().saved.theme === 3, "old progress retained");
  old.click("start");
  check(old.audio.tones === 0, "existing mute preference retained");
  old.win.close();
}
console.log(
  "PASS DOM/event checks:",
  count,
  "— coordinate mapping at 5 sizes; no real layout/touch-device claim",
);
