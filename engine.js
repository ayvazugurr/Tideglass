/* Pure, deterministic game rules. No browser dependencies. */
(function (root) {
  "use strict";
  const COLS = 6,
    ROWS = 8;
  function rng(seed) {
    const next = function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.state = () => seed | 0;
    return next;
  }
  class Game {
    constructor(seed = Date.now()) {
      this.random = rng(seed);
      this.board = Array(48).fill(null);
      this.score = 0;
      this.turn = 0;
      this.total = 0;
      this.longest = 0;
      this.charge = 0;
      this.flow = 0;
      this.bestFlow = 0;
      this.loops = 0;
      this.rocksBroken = 0;
      this.holds = 0;
      this.over = false;
      this.last = null;
      this.id = 0;
      for (let y = 5; y < 8; y++)
        for (let x = 0; x < 6; x++) this.board[y * 6 + x] = this.gem();
      this.ensureMove();
    }
    serialize() {
      const data = {
        version: 1,
        randomState: this.random.state(),
        board: this.board.map((g) => (g ? { ...g } : null)),
      };
      for (const key of Game.fields) data[key] = this[key];
      return data;
    }
    static get fields() {
      return [
        "score",
        "turn",
        "total",
        "longest",
        "charge",
        "flow",
        "bestFlow",
        "loops",
        "rocksBroken",
        "holds",
        "id",
        "over",
      ];
    }
    static restore(data) {
      if (
        !data ||
        data.version !== 1 ||
        !Array.isArray(data.board) ||
        data.board.length !== 48 ||
        typeof data.over !== "boolean" ||
        !Number.isInteger(data.randomState) ||
        Math.abs(data.randomState) > 2147483648
      )
        return null;
      for (const key of Game.fields)
        if (
          key !== "over" &&
          (!Number.isSafeInteger(data[key]) ||
            data[key] < 0 ||
            data[key] > 1e12)
        )
          return null;
      if (
        data.charge > 18 ||
        data.flow > 4 ||
        data.bestFlow > 4 ||
        data.bestFlow < data.flow ||
        data.longest > 48 ||
        data.loops > data.turn ||
        data.holds > data.turn
      )
        return null;
      const ids = new Set();
      for (const g of data.board) {
        if (g === null) continue;
        if (
          !g ||
          !Number.isSafeInteger(g.id) ||
          g.id < 1 ||
          g.id > data.id ||
          ids.has(g.id) ||
          !Number.isInteger(g.color) ||
          g.color < -1 ||
          g.color > 3 ||
          typeof g.star !== "boolean"
        )
          return null;
        ids.add(g.id);
      }
      for (let x = 0; x < 6; x++) {
        let occupied = false;
        for (let y = 0; y < 8; y++) {
          if (data.board[y * 6 + x]) occupied = true;
          else if (occupied) return null;
        }
      }
      const game = new Game(1);
      for (const key of Game.fields) game[key] = data[key];
      game.board = data.board.map((g) =>
        g ? { id: g.id, color: g.color, star: g.star } : null,
      );
      game.random = rng(data.randomState);
      if (!game.over && !game.findMove()) return null;
      return game;
    }
    get level() {
      return 1 + Math.floor(this.turn / 7);
    }
    gem() {
      const color = Math.floor(this.random() * (this.level < 3 ? 3 : 4));
      return { id: ++this.id, color, star: this.random() < 0.09 };
    }
    adjacent(a, b) {
      return (
        a !== b &&
        Math.abs((a % 6) - (b % 6)) <= 1 &&
        Math.abs(Math.floor(a / 6) - Math.floor(b / 6)) <= 1
      );
    }
    valid(path) {
      return (
        path.length >= 3 &&
        new Set(path).size === path.length &&
        path.every(
          (i, n) =>
            Number.isInteger(i) &&
            i >= 0 &&
            i < 48 &&
            this.board[i] &&
            this.board[i].color >= 0 &&
            this.board[i].color === this.board[path[0]]?.color &&
            (!n || this.adjacent(i, path[n - 1])),
        )
      );
    }
    gravity() {
      for (let x = 0; x < 6; x++) {
        let ys = [];
        for (let y = 7; y >= 0; y--)
          if (this.board[y * 6 + x]) ys.push(this.board[y * 6 + x]);
        for (let y = 7; y >= 0; y--) this.board[y * 6 + x] = ys[7 - y] || null;
      }
    }
    findMove() {
      for (let a = 0; a < 48; a++) {
        if (!this.board[a] || this.board[a].color < 0) continue;
        for (let b = 0; b < 48; b++) {
          if (
            !this.adjacent(a, b) ||
            this.board[b]?.color !== this.board[a].color
          )
            continue;
          for (let c = 0; c < 48; c++)
            if (
              c !== a &&
              this.adjacent(b, c) &&
              this.board[c]?.color === this.board[a].color
            )
              return [a, b, c];
        }
      }
      return null;
    }
    findLoop(limit = 12) {
      let budget = 6000;
      for (let start = 0; start < 48; start++) {
        const gem = this.board[start];
        if (!gem || gem.color < 0) continue;
        const walk = (path) => {
          if (--budget < 0) return null;
          const last = path[path.length - 1];
          if (path.length >= 5 && this.adjacent(last, start)) return path;
          if (path.length >= limit) return null;
          for (let next = 0; next < 48; next++)
            if (
              !path.includes(next) &&
              this.board[next]?.color === gem.color &&
              this.adjacent(last, next)
            ) {
              const found = walk([...path, next]);
              if (found) return found;
            }
          return null;
        };
        const found = walk([start]);
        if (found) return found;
      }
      return null;
    }
    ensureMove() {
      if (this.findMove()) return false;
      let group = null;
      // Prefer existing crystals so a reshuffle does not change board density.
      for (let a = 0; a < 48 && !group; a++)
        if (this.board[a]?.color >= 0)
          for (let b = 0; b < 48 && !group; b++)
            if (this.board[b]?.color >= 0 && this.adjacent(a, b))
              for (let c = 0; c < 48; c++)
                if (
                  c !== a &&
                  this.board[c]?.color >= 0 &&
                  this.adjacent(b, c)
                ) {
                  group = [a, b, c];
                  break;
                }
      // If a huge clear left fewer than three usable crystals, seed a vertical
      // trio directly above a column's packed stack. It stays connected and never
      // creates floating pieces.
      if (!group) {
        this.gravity();
        for (let x = 0; x < 6 && !group; x++) {
          let first = 0;
          while (first < 8 && !this.board[first * 6 + x]) first++;
          if (first >= 3)
            group = [
              (first - 3) * 6 + x,
              (first - 2) * 6 + x,
              (first - 1) * 6 + x,
            ];
        }
      }
      if (!group) {
        this.over = true;
        return false;
      }
      const color = Math.floor(this.random() * 3);
      group.forEach((i) => {
        if (!this.board[i]) this.board[i] = this.gem();
        this.board[i].color = color;
      });
      return true;
    }
    loopValid(path) {
      return (
        this.valid(path) &&
        path.length >= 5 &&
        this.adjacent(path[0], path[path.length - 1])
      );
    }
    preview(path, loop = false) {
      if (!this.valid(path)) return 0;
      const indices =
        loop && this.loopValid(path)
          ? this.board
              .map((g, i) => (g?.color === this.board[path[0]].color ? i : -1))
              .filter((i) => i >= 0)
          : path;
      const count = indices.length;
      const base =
        count * 20 +
        Math.max(0, count - 3) ** 2 * 12 +
        indices.filter((i) => this.board[i].star).length * 60;
      const nextFlow = path.length >= 5 ? Math.min(4, this.flow + 1) : 0;
      const rocks = this.board.filter(
        (g, i) => g?.color === -1 && indices.some((j) => this.adjacent(i, j)),
      ).length;
      return Math.round(base * (1 + nextFlow * 0.25)) + rocks * 40;
    }
    willOverflow(path, loop = false) {
      if (
        !this.valid(path) ||
        path.length >= 6 ||
        (loop && this.loopValid(path))
      )
        return false;
      const removed = new Set(path);
      for (let i = 0; i < 48; i++)
        if (
          this.board[i]?.color === -1 &&
          path.some((j) => this.adjacent(i, j))
        )
          removed.add(i);
      for (let x = 0; x < 6; x++) {
        let count = 0;
        for (let y = 0; y < 8; y++)
          if (this.board[y * 6 + x] && !removed.has(y * 6 + x)) count++;
        if (count === 8) return true;
      }
      return false;
    }
    rise() {
      if (this.board.slice(0, 6).some(Boolean)) {
        this.over = true;
        return false;
      }
      for (let i = 0; i < 42; i++) this.board[i] = this.board[i + 6];
      for (let i = 42; i < 48; i++) this.board[i] = this.gem();
      if (this.level >= 4 && this.turn % 3 === 0)
        this.board[42 + Math.floor(this.random() * 6)] = {
          id: ++this.id,
          color: -1,
          star: false,
        };
      return true;
    }
    commit(path, loop = false) {
      if (this.over || !this.valid(path)) return null;
      loop = !!loop && this.loopValid(path);
      const color = this.board[path[0]].color;
      const targets = loop
        ? this.board
            .map((g, i) => (g?.color === color ? i : -1))
            .filter((i) => i >= 0)
        : path;
      const points = this.preview(path, loop);
      this.flow = path.length >= 5 ? Math.min(4, this.flow + 1) : 0;
      this.bestFlow = Math.max(this.bestFlow, this.flow);
      if (loop) this.loops++;
      const removed = targets.map((i) => ({ i, ...this.board[i] }));
      const rocks = [];
      targets.forEach((i) => {
        for (let j = 0; j < 48; j++)
          if (
            this.board[j]?.color === -1 &&
            this.adjacent(i, j) &&
            !rocks.includes(j)
          )
            rocks.push(j);
      });
      this.rocksBroken += rocks.length;
      rocks.forEach((i) => removed.push({ i, ...this.board[i] }));
      removed.forEach((g) => (this.board[g.i] = null));
      this.turn++;
      this.total += targets.length;
      this.longest = Math.max(this.longest, path.length);
      this.charge = Math.min(18, this.charge + targets.length);
      this.score += points;
      this.gravity();
      const held = path.length >= 6 || loop;
      if (held) this.holds++;
      let rose = false;
      if (!held) rose = this.rise();
      if (!this.board.some(Boolean)) {
        for (let i = 36; i < 48; i++) this.board[i] = this.gem();
      }
      const rescued = this.ensureMove();
      this.last = {
        removed,
        points,
        held,
        rose,
        rescued,
        rocks: rocks.length,
        loop,
        flow: this.flow,
      };
      return this.last;
    }
    award(points) {
      if (
        !Number.isSafeInteger(points) ||
        points <= 0 ||
        !Number.isSafeInteger(this.score + points)
      )
        return false;
      this.score += points;
      return true;
    }
    pulse() {
      if (this.over || this.charge < 18) return null;
      const removed = [];
      for (let y = 7; y >= 0; y--) {
        for (let x = 0; x < 6; x++) {
          let i = y * 6 + x;
          if (this.board[i]) {
            removed.push({ i, ...this.board[i] });
            this.board[i] = null;
          }
        }
        if (removed.length >= 10) break;
      }
      this.charge = 0;
      this.score += removed.length * 15;
      this.gravity();
      if (this.board.filter(Boolean).length < 6)
        for (let i = 42; i < 48; i++) this.board[i] = this.gem();
      this.ensureMove();
      return { removed, points: removed.length * 15 };
    }
  }
  root.TideEngine = { Game, rng, COLS, ROWS };
  if (typeof module !== "undefined") module.exports = root.TideEngine;
})(typeof window !== "undefined" ? window : globalThis);
