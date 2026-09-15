const assert = require("node:assert/strict");
const { Game } = require("./engine.js");
function paths(g, cap = 10) {
  let best = [];
  function walk(p) {
    if (p.length > best.length) best = [...p];
    if (p.length >= cap) return;
    const a = p.at(-1);
    for (let b = 0; b < 48; b++)
      if (
        g.board[b]?.color === g.board[a].color &&
        g.adjacent(a, b) &&
        !p.includes(b)
      )
        walk([...p, b]);
  }
  for (let i = 0; i < 48; i++)
    if (g.board[i] && g.board[i].color >= 0) walk([i]);
  return best;
}
let checks = 0;
function check(v, msg) {
  assert.ok(v, msg);
  checks++;
}
let g = new Game(1),
  before = JSON.stringify(g);
for (const p of [[], [1], [48, 49, 50], [42, 42, 42], [-1, 0, 1], [0, 6, 12]]) {
  check(g.commit(p) === null, "invalid rejected");
  check(JSON.stringify(g) === before, "invalid immutable");
}
for (let seed = 1; seed <= 120; seed++) {
  g = new Game(seed);
  for (let turn = 0; turn < 150 && !g.over; turn++) {
    const p = turn % 2 ? g.findMove() : paths(g, 8);
    check(p && g.valid(p), "legal move available");
    const score = g.score;
    check(!!g.commit(p), "commit");
    check(g.score > score && Number.isSafeInteger(g.score), "monotonic score");
    check(g.board.length === 48, "size");
    check(g.charge >= 0 && g.charge <= 18, "charge");
    check(
      new Set(g.board.filter(Boolean).map((c) => c.id)).size ===
        g.board.filter(Boolean).length,
      "unique gems",
    );
    if (g.charge === 18 && turn % 3 === 0 && !g.over) {
      check(!!g.pulse(), "pulse");
      check(g.charge === 0, "pulse consumes charge");
    }
    for (let x = 0; x < 6; x++) {
      let occupied = false;
      for (let y = 0; y < 8; y++) {
        if (g.board[y * 6 + x]) occupied = true;
        else check(!occupied, "gravity no holes");
      }
    }
  }
  if (g.over) {
    before = JSON.stringify(g);
    check(g.commit(g.findMove() || []) === null, "no play after loss");
    check(g.pulse() === null, "no pulse after loss");
    check(before === JSON.stringify(g), "loss immutable");
  }
}
g = new Game(2);
g.board = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  color: i % 3,
  star: false,
}));
g.id = 48;
g.commit([0, 6, 12]);
check(g.over, "occupied ceiling loses on rise");

g = new Game(50);
g.board = Array(48).fill(null);
for (let i = 42; i < 48; i++)
  g.board[i] = { id: ++g.id, color: -1, star: false };
check(g.ensureMove(), "seeds around rocks");
check(g.findMove(), "seeded move exists");
check(
  g.board.slice(42).every((x) => x?.color === -1),
  "rocks preserved by rescue",
);
g = new Game(51);
g.board = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  color: -1,
  star: false,
}));
g.id = 48;
check(g.ensureMove() === false && g.over, "fully blocked board terminates");
g = new Game(77);
g.board = Array(48).fill(null);
for (let i = 42; i < 48; i++) g.board[i] = { id: i, color: 0, star: i === 42 };
g.id = 48;
let r = g.commit([42, 43, 44, 45, 46, 47]);
check(r.held && !r.rose, "six holds tide");
check(r.points === 360, "six-chain bonus, flow and star exact");
check(g.findMove(), "empty-board replenishment");
g = new Game(50);
g.board = Array(48).fill(null);
for (let i = 42; i < 48; i++)
  g.board[i] = { id: ++g.id, color: -1, star: false };
check(g.ensureMove(), "seeds around rocks");
check(g.findMove(), "seeded move exists");
check(
  g.board.slice(42).every((x) => x?.color === -1),
  "rocks preserved by rescue",
);
g = new Game(51);
g.board = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  color: -1,
  star: false,
}));
g.id = 48;
check(g.ensureMove() === false && g.over, "fully blocked board terminates");
g = new Game(77);
g.board = Array(48).fill(null);
for (let i = 42; i < 45; i++) g.board[i] = { id: i, color: 0, star: false };
g.board[45] = { id: 45, color: -1, star: false };
g.id = 48;
r = g.commit([42, 43, 44]);
check(r.rocks === 1 && r.points === 100, "neighbor rock and score");
g = new Game(81);
g.board = Array(48).fill(null);
for (const i of [36, 37, 43, 42, 40, 41, 47])
  g.board[i] = { id: i + 1, color: 0, star: false };
g.board[44] = { id: 45, color: 1, star: false };
g.id = 48;
const ring = [36, 37, 43, 42];
check(!g.loopValid(ring), "four cannot loop");
const loop = [36, 37, 43, 42, 36].slice(0, -1); // unique path must contain five nodes; create a pentagon-like 8-neighbor ring
g.board[38] = { id: 39, color: 0, star: false };
const ring5 = [36, 37, 38, 43, 42];
check(g.loopValid(ring5), "five-node ring valid");
r = g.commit(ring5, true);
check(r.loop && r.held && !r.rose, "loop clears and holds tide");
check(
  r.removed.filter((x) => x.color === 0).length === 8,
  "loop clears entire color",
);
check(g.loops === 1, "loop counter");
g = new Game(15);
g.board = Array(48).fill(null);
for (let i = 42; i < 47; i++) g.board[i] = { id: i, color: 0, star: false };
g.id = 48;
r = g.commit([42, 43, 44, 45, 46]);
check(r.flow === 1, "flow starts");
for (let i = 42; i < 47; i++)
  g.board[i] = { id: 100 + i, color: 0, star: false };
r = g.commit([42, 43, 44, 45, 46]);
check(r.flow === 2 && g.bestFlow === 2, "flow chains");
g.board[42] = { id: 200, color: 0, star: false };
g.board[43] = { id: 201, color: 0, star: false };
g.board[44] = { id: 202, color: 0, star: false };
r = g.commit([42, 43, 44]);
check(r.flow === 0, "short chain breaks flow");
check(g.award(300) && g.score >= 300, "valid mission award");
check(!g.award(-1), "invalid award rejected");
g = new Game(9);
check(g.pulse() === null, "uncharged pulse rejected");
g.charge = 18;
let n = g.board.filter(Boolean).length;
let pulse = g.pulse();
check(pulse.removed.length >= 10 && g.charge === 0, "pulse clears rows");
check(g.score === pulse.removed.length * 15, "pulse points");
console.log("PASS", checks);

// Reloads retain the exact random stream, not just the visible board.
for (let seed = 0; seed < 80; seed++) {
  let live = new Game(seed);
  for (let n = 0; n < 4 && !live.over; n++) live.commit(live.findMove());
  const restored = Game.restore(JSON.parse(JSON.stringify(live.serialize())));
  assert.ok(restored);
  assert.deepEqual(restored.serialize(), live.serialize());
  for (let n = 0; n < 12 && !live.over; n++) {
    const p = live.findMove();
    live.commit(p);
    restored.commit(p);
    assert.deepEqual(restored.serialize(), live.serialize());
  }
}
const sample = new Game(68).serialize();
for (const corrupt of [
  null,
  {},
  { ...sample, charge: 99 },
  { ...sample, board: [] },
  { ...sample, randomState: "bad" },
  { ...sample, board: sample.board.map((g) => (g ? { ...g, id: 1 } : null)) },
])
  assert.equal(Game.restore(corrupt), null);
const invalidGap = JSON.parse(JSON.stringify(sample));
invalidGap.board[0] = invalidGap.board[47];
invalidGap.board[47] = null;
assert.equal(Game.restore(invalidGap), null);
console.log("PASS reload state, future randomness, invalid snapshot rejection");
// Preview warnings predict overflow after clearing and gravity, not before.
{
  const g = new Game(5);
  g.board = Array.from({ length: 48 }, (_, i) => ({
    id: i + 1,
    color: 0,
    star: false,
  }));
  g.id = 48;
  assert.equal(g.willOverflow([42, 43, 44]), true);
  assert.equal(g.willOverflow([42, 43, 44, 45, 46, 47]), false);
  const r = g.commit([42, 43, 44]);
  assert.equal(g.over, true);
}
console.log("PASS overflow preview");

// Balance regression: the opening uses four colors so diagonal chains do not
// make nearly every board an immediate six-clear. The deterministic sample
// keeps the opening accessible without returning to the previous 69% rate.
{
  let sixReady = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const g = new Game(seed);
    if (paths(g, 8).length >= 6) sixReady++;
  }
  assert.ok(sixReady >= 25 && sixReady <= 48, `opening six-rate ${sixReady}%`);
}
// The storm phase raises the hold target after the player has learned the loop.
{
  const six = new Game(501);
  six.turn = 28;
  six.board = Array(48).fill(null);
  for (let i = 42; i < 48; i++)
    six.board[i] = { id: ++six.id, color: 0, star: false };
  const sixResult = six.commit([42, 43, 44, 45, 46, 47]);
  assert.equal(six.holdTarget, 7);
  assert.equal(sixResult.held, false);
  assert.equal(sixResult.rose, true);

  const seven = new Game(502);
  seven.turn = 28;
  seven.board = Array(48).fill(null);
  for (const i of [41, 42, 43, 44, 45, 46, 47])
    seven.board[i] = { id: ++seven.id, color: 0, star: false };
  const sevenResult = seven.commit([42, 43, 44, 45, 46, 47, 41]);
  assert.equal(sevenResult.held, true);
  assert.equal(sevenResult.rose, false);
}
console.log("PASS opening variety and storm hold threshold");
