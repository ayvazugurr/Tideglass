(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    canvas = $("board"),
    ctx = canvas.getContext("2d");
  const themes = [
    {
      name: "Lagün",
      at: 0,
      colors: ["#a7dfbf", "#efba79", "#aca7e0", "#79bddd"],
    },
    {
      name: "Günbatımı",
      at: 1800,
      colors: ["#f2a097", "#f2d291", "#c0a6e9", "#89cad1"],
    },
    {
      name: "Kutup",
      at: 4500,
      colors: ["#a7e8db", "#e3deba", "#b8b4ee", "#7eaed8"],
    },
  ];
  const blank = {
    best: 0,
    runs: 0,
    total: 0,
    longest: 0,
    loops: 0,
    bestFlow: 0,
    missions: 0,
    theme: 0,
    mute: true,
  };
  let saved = { ...blank },
    activeRun = null;
  try {
    const data = JSON.parse(localStorage.getItem("tideglass-v1"));
    if (data && typeof data === "object")
      for (const k of [
        "best",
        "runs",
        "total",
        "longest",
        "loops",
        "bestFlow",
        "missions",
        "theme",
      ])
        if (Number.isSafeInteger(data[k]) && data[k] >= 0)
          saved[k] = Math.min(data[k], 1e9);
    if (typeof data?.mute === "boolean") saved.mute = data.mute;
    if (data?.active) activeRun = data.active;
  } catch {}
  if (!themes[saved.theme] || saved.best < themes[saved.theme].at)
    saved.theme = 0;
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
  let storageOK = true;
  function save() {
    try {
      localStorage.setItem(
        "tideglass-v1",
        JSON.stringify({ ...saved, active: activeRun }),
      );
    } catch {
      storageOK = false;
    }
  }
  const missions = [
    { text: "Tek zincirde 8 kristal", done: (g) => g.longest >= 8 },
    { text: "Bir halka kapat", done: (g) => g.loops >= 1 },
    { text: "Akıntıyı 3’e çıkar", done: (g) => g.bestFlow >= 3 },
    { text: "Dalgayı 3 kez durdur", done: (g) => g.holds >= 3 },
  ];
  let mission = missions[0],
    missionDone = false,
    baselineBest = saved.best;
  let game = new TideEngine.Game(),
    mode = "menu",
    path = [],
    looped = false,
    pointer = null,
    hover = 42,
    locked = 0,
    particles = [],
    positions = new Map(),
    hint = null,
    hintAt = 0,
    lastInput = performance.now(),
    animTime = 0,
    shake = 0,
    ac = null,
    started = false,
    runRecorded = false;
  if (
    activeRun &&
    (!Number.isInteger(activeRun.missionIndex) ||
      activeRun.missionIndex < 0 ||
      activeRun.missionIndex >= missions.length ||
      typeof activeRun.missionDone !== "boolean" ||
      !TideEngine.Game.restore(activeRun.game) ||
      activeRun.game.over)
  )
    activeRun = null;
  function checkpoint() {
    if (started && game.over) {
      record();
      return;
    }
    if (started && !runRecorded && !game.over)
      activeRun = {
        game: game.serialize(),
        missionIndex: missions.indexOf(mission),
        missionDone,
      };
    else if (started) activeRun = null;
    save();
  }
  function continueRun() {
    baselineBest = saved.best;
    const restored = TideEngine.Game.restore(activeRun?.game);
    if (!restored) {
      activeRun = null;
      menu();
      return;
    }
    game = restored;
    mission = missions[activeRun.missionIndex];
    missionDone = activeRun.missionDone;
    started = true;
    runRecorded = false;
    path = [];
    looped = false;
    pointer = null;
    particles = [];
    positions.clear();
    locked = 0;
    hint = null;
    close();
  }
  let lastDraw = 0,
    dirty = true;
  let lastPointer = null;
  let width = 360,
    height = 480,
    cell = 60,
    dpr = 1;
  function resize() {
    dirty = true;
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    cell = width / 6;
    if (!Number.isFinite(cell) || cell <= 0) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    positions.clear();
  }
  new ResizeObserver(resize).observe(canvas);
  function haptic(kind) {
    if (!navigator.vibrate || reducedMotion) return;
    const pattern = kind === "loop" ? [8, 35, 18] : kind === "pulse" ? [16, 35, 28] : kind === "bad" ? [25, 40, 25] : [6];
    try { navigator.vibrate(pattern); } catch {}
  }
  function sound(type, n = 0) {
    if (saved.mute) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const notes =
        type === "clear"
          ? [0, 4, 7, 12]
          : type === "pulse"
            ? [0, 7, 12, 19]
            : [0];
      notes.forEach((note, i) => {
        let t = ac.currentTime + i * 0.065,
          o = ac.createOscillator(),
          g = ac.createGain();
        o.type = type === "bad" ? "triangle" : "sine";
        o.frequency.value =
          (type === "bad" ? 130 : 260) * 2 ** ((note + n) / 12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + 0.21);
      });
    } catch {}
  }
  function toast(text) {
    $("float").textContent = text;
    $("float").classList.remove("show");
    void $("float").offsetWidth;
    $("float").classList.add("show");
  }
  function hud() {
    dirty = true;
    $("gain").classList.toggle("risk", game.willOverflow(path, looped));
    $("score").textContent = game.score.toLocaleString("tr-TR");
    $("best").textContent = Math.max(saved.best, game.score).toLocaleString(
      "tr-TR",
    );
    $("level").textContent = String(game.level).padStart(2, "0");
    $("turn").textContent = game.turn + " HAMLE";
    $("charge").textContent =
      game.charge >= 18 ? "HAZIR · E" : game.charge + " / 18";
    $("pulse").disabled = game.charge < 18 || mode !== "play";
    $("pulse").classList.toggle("ready", game.charge >= 18);
    document.querySelector(".pulse-fill").style.width =
      (game.charge / 18) * 100 + "%";
    $("sound").style.opacity = saved.mute ? 0.5 : 1;
    $("sound").setAttribute(
      "aria-label",
      saved.mute ? "Sesi aç" : "Sesi kapat",
    );
    $("sound").setAttribute("aria-pressed", String(!saved.mute));
    const danger = game.board.slice(0, 6).some(Boolean),
      shell = document.querySelector(".shell");
    shell.classList.toggle("danger", danger);
    shell.classList.toggle("flowing", game.flow >= 2);
    $("sea-level").textContent =
      "DALGA " +
      (8 - Math.min(...game.board.map((g, i) => (g ? Math.floor(i / 6) : 8)))) +
      " / 8";
    $("status").textContent = danger
      ? "TAVAN DOLU · Önce yer aç veya dalgayı durdur."
      : game.turn >= 2 &&
          game.turn <= 6 &&
          saved.loops === 0 &&
          game.loops === 0
        ? "İPUCU · 5+ zincirle başlangıca dön, halkayı kapat."
        : game.level >= 4
          ? "Kayaları yanlarından zincir yaparak kır."
          : game.level >= 3
            ? "Yeni renk geldi. Sembollere de bakabilirsin."
            : "Aynı renkten en az 3 kristali birleştir.";
    $("mission").textContent = missionDone
      ? "HEDEF TAMAMLANDI · +300 ✓"
      : "SEFER HEDEFİ · " + mission.text;
    $("chain").textContent = looped
      ? "HALKA KAPANDI · BU RENGİN TAMAMI"
      : path.length
        ? path.length +
          " kristal" +
          (path.length < 3 ? " · en az 3 gerekli" : " · bırak ve topla")
        : game.flow
          ? "AKINTI x" +
            (1 + game.flow * 0.25).toFixed(2) +
            " · uzun zincirle sürdür"
          : "Çapraz da birleştirebilirsin.";
    $("gain").textContent =
      path.length >= 3
        ? "+" +
          game.preview(path, looped) +
          (game.willOverflow(path, looped)
            ? " · TAŞAR!"
            : looped
              ? " · TAM TEMİZLİK"
              : path.length >= 6
                ? " · DALGA DURUR"
                : " · DALGA +1")
        : "6+ = DALGA DURUR";
  }
  function show(html) {
    document.querySelector(".shell").inert = true;
    $("panel").innerHTML = html;
    $("overlay").classList.remove("hidden");
    setTimeout(() => $("panel").querySelector(".primary")?.focus(), 20);
    hud();
  }
  function close() {
    if (game.over) {
      end();
      return;
    }
    document.querySelector(".shell").inert = false;
    $("overlay").classList.add("hidden");
    mode = "play";
    lastInput = performance.now();
    hud();
    canvas.focus({ preventScroll: true });
  }
  function rank() {
    return saved.total >= 1500
      ? "DALGA MUHAFIZI"
      : saved.total >= 500
        ? "ROTA USTASI"
        : saved.total >= 150
          ? "AKINTI AVCISI"
          : "KIYI GEZGİNİ";
  }
  function menu() {
    mode = "menu";
    path = [];
    looped = false;
    pointer = null;
    show(
      `<p class="eyebrow">KÜÇÜK BİR OKYANUS. BÜYÜK BİR ZİNCİR.</p><h1 id="panel-title">Akışını bul.<br><b>Dalgayı durdur.</b></h1><div class="hero-gems" aria-hidden="true"><i></i><i></i><i></i></div><p>Aynı renk kristalleri birleştir.<br>Her kısa zincirde su bir sıra yükselir.<br><strong>Uzun zincir yap, kendine alan aç.</strong></p><div class="tip-grid"><div><b>3+</b>birleştir ve topla</div><div><b>6+</b>dalgayı durdur</div><div><b>18</b>dalgakıranı doldur</div></div>${activeRun ? '<button class="primary" id="continue-run">KALDIĞIN YERDEN DEVAM ↗</button>' : ""}<button class="${activeRun ? "secondary" : "primary"}" id="start">${started ? "YENİ SEFERE ÇIK" : "AKIŞA KATIL"} &nbsp; ↗</button><div class="palette-row">${themes.map((t, i) => `<button class="palette ${saved.theme === i ? "selected" : ""}" data-theme="${i}" ${saved.best < t.at ? "disabled" : ""}><span class="swatches" aria-hidden="true">${t.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span>${t.name}<br>${saved.best < t.at ? t.at + " puan" : "◈"}</button>`).join("")}</div><button class="secondary" id="journal">KAPTAN GÜNLÜĞÜ · İLERLEME</button><p class="fine">${rank()} · ${saved.runs} SEFER · ${saved.loops} HALKA<br>${saved.best ? "REKOR " + saved.best.toLocaleString("tr-TR") + " · " : ""}Reklamsız. Çevrimdışı. Tamamen sana ait.</p>`,
    );
    $("start").onclick = () => {
      if (activeRun) {
        continueRun();
        record();
      }
      start();
    };
    if ($("continue-run")) $("continue-run").onclick = continueRun;
    $("journal").onclick = journal;
    document.querySelectorAll("[data-theme]").forEach(
      (b) =>
        (b.onclick = () => {
          saved.theme = Number(b.dataset.theme);
          save();
          menu();
        }),
    );
  }
  function journal() {
    mode = "journal";
    const badges = [
      ["İlk Fener", "1.000 rekor puanı", saved.best >= 1000],
      ["Halka Ustası", "Bir halka kapat", saved.loops >= 1],
      ["Kesintisiz Akıntı", "Akıntıyı 4’e çıkar", saved.bestFlow >= 4],
      ["Kristal Kervanı", "10 kristallik zincir", saved.longest >= 10],
      ["Açık Deniz", "10.000 rekor puanı", saved.best >= 10000],
    ];
    const next =
      saved.total < 150
        ? 150
        : saved.total < 500
          ? 500
          : saved.total < 1500
            ? 1500
            : null;
    show(
      `<p class="eyebrow">KAPTAN GÜNLÜĞÜ</p><h2 id="panel-title">${rank()}</h2><div class="log-stats"><div><b>${saved.best.toLocaleString("tr-TR")}</b>rekor</div><div><b>${saved.total.toLocaleString("tr-TR")}</b>kristal</div><div><b>${saved.loops}</b>halka</div><div><b>${saved.missions}</b>hedef</div></div>${next ? `<p class="rank-progress">Sonraki rütbe · ${saved.total} / ${next}</p>` : '<p class="rank-progress">En yüksek rütbe tamamlandı ✦</p>'}<div class="badges">${badges.map(([name, desc, ok]) => `<div class="badge ${ok ? "earned" : ""}"><i>${ok ? "✦" : "◇"}</i><span><b>${name}</b><small>${desc}</small></span></div>`).join("")}</div><button class="primary" id="journal-back">ANA MENÜYE DÖN</button>`,
    );
    $("journal-back").onclick = menu;
  }
  function start() {
    baselineBest = saved.best;
    game = new TideEngine.Game();
    mission = missions[saved.runs % missions.length];
    missionDone = false;
    started = true;
    runRecorded = false;
    particles = [];
    positions.clear();
    path = [];
    looped = false;
    pointer = null;
    locked = 0;
    hint = null;
    shake = 0;
    close();
    checkpoint();
    sound("clear");
    toast("3 kristali birleştir");
  }
  function pause() {
    if (mode !== "play") return;
    mode = "pause";
    path = [];
    looped = false;
    pointer = null;
    checkpoint();
    show(
      `<p class="eyebrow">DALGALAR BEKLEYEBİLİR</p><h2 id="panel-title">Bir nefes al.</h2><p>Bu oyunda süre yok.<br>Bir sonraki zincirini rahatça düşün.</p><button class="primary" id="resume">DEVAM ET</button><button class="secondary" id="restart">SEFERİ BIRAK · YENİDEN BAŞLA</button><button class="secondary" id="home">KAYDET · ANA MENÜ</button>`,
    );
    $("resume").onclick = close;
    $("restart").onclick = () => {
      record();
      start();
    };
    $("home").onclick = () => {
      checkpoint();
      menu();
    };
  }
  function help() {
    const previous = mode;
    mode = "help";
    path = [];
    looped = false;
    pointer = null;
    show(
      `<p class="eyebrow">İLK ZİNCİRİN YETER</p><h2 id="panel-title">Akıntının kuralları</h2><ol class="rules"><li><b>Sürükle:</b> aynı renkli 3 veya daha fazla komşu kristali birleştir. Çapraz geçebilirsin. Son kristale geri dönerek zinciri kısalt.</li><li><b>Dalgayı yönet:</b> 3–5 kristalde alttan bir sıra gelir. 6+ kristalde dalga durur. Dolu tavanın üstüne yeni dalga gelirse sefer biter.</li><li><b>Dalgakıran:</b> 18 kristal toplayınca düğmeye bas; en alttaki dolu sıraları temizle. Kayalara komşu zincirler kayaları kırar.</li><li><b>Halka:</b> En az 5 kristalle başladığın noktaya dön; o rengin alandaki tamamını temizle.</li><li><b>Akıntı:</b> Arka arkaya 5+ kristallik zincirler puan çarpanını yükseltir. Kısa zincir akıntıyı sıfırlar.</li><li><b>Yıldızlar:</b> zincirdeki her yıldız +60 puan. Uzun zincirlerin bonusu hızla artar.</li></ol><p class="fine">Fare / dokunmatik: basılı tut ve sürükle.<br>Klavye: oklarla gez, Boşluk ile ekle, Enter ile topla.<br>Esc: zinciri iptal et / duraklat. E: dalgakıran.</p><button class="primary" id="back">ANLADIM</button>`,
    );
    $("back").onclick = () => {
      if (previous === "play") close();
      else menu();
    };
  }
  function record() {
    if (!started) return;
    saved.best = Math.max(saved.best, game.score);
    saved.longest = Math.max(saved.longest, game.longest);
    if (runRecorded) {
      save();
      return;
    }
    runRecorded = true;
    activeRun = null;
    if (game.turn > 0) saved.runs++;
    saved.total = Math.min(1e9, saved.total + game.total);
    saved.loops = Math.min(1e9, saved.loops + game.loops);
    saved.bestFlow = Math.max(saved.bestFlow, game.bestFlow);
    if (missionDone) saved.missions++;
    saved.longest = Math.max(saved.longest, game.longest);
    save();
  }
  function end() {
    mode = "over";
    const oldBest = baselineBest;
    record();
    const unlock = themes.filter((t) => t.at > oldBest && t.at <= saved.best);
    show(
      `<p class="eyebrow">${game.score > oldBest ? "YENİ REKOR · HARİKA AKIŞ" : "DALGA KIYIYA ULAŞTI"}</p><h2 id="panel-title">Bir dalga daha?</h2><div class="result-score">${game.score.toLocaleString("tr-TR")}</div><div class="result-grid"><div><b>${game.turn}</b>hamle</div><div><b>${game.longest}</b>en uzun zincir</div><div><b>${game.level}</b>bölge</div><div><b>${game.bestFlow}</b>akıntı</div></div><p>${game.longest < 6 ? "6 kristallik zincirler yeni dalgayı durdurur. Bir sonraki sefer bunu dene." : "Dalgakıranı tavan dolmadan kullan; büyük zincirlere alan aç."}</p>${unlock.length ? `<p class="unlock">✦ ${unlock.map((t) => t.name).join(", ")} paleti açıldı!</p>` : ""}<button class="primary" id="again">TEKRAR OYNA &nbsp; ↗</button><button class="secondary" id="home">PALETLER & ANA MENÜ</button>${!storageOK ? '<p class="fine">Tarayıcı kayda izin vermedi; rekor bu oturumda tutuluyor.</p>' : ""}`,
    );
    $("again").onclick = start;
    $("home").onclick = menu;
    sound("bad");
    haptic("bad");
  }
  function burst(removed) {
    if (reducedMotion) return;
    for (const g of removed) {
      const pos = positions.get(g.id) || {
        x: ((g.i % 6) + 0.5) * cell,
        y: (Math.floor(g.i / 6) + 0.5) * cell,
      };
      for (let j = 0; j < 8; j++)
        particles.push({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 170,
          vy: (Math.random() - 0.6) * 170,
          life: 0.55 + Math.random() * 0.2,
          color: g.color < 0 ? "#809094" : themes[saved.theme].colors[g.color],
          r: 2 + Math.random() * 2,
        });
    }
    if (particles.length > 400) particles = particles.slice(-400);
  }
  function commit() {
    if (mode !== "play" || performance.now() < locked) return;
    const previous = game.level;
    const result = game.commit(path, looped);
    path = [];
    looped = false;
    hint = null;
    if (!result) {
      hud();
      return;
    }
    burst(result.removed);
    locked = performance.now() + 290;
    lastInput = performance.now();
    sound(result.loop ? "pulse" : "clear", result.held ? 5 : 0);
    if (result.loop) {
      haptic("loop");
      shake = reducedMotion ? 0 : 8;
      toast("HALKA! +" + result.points);
    } else if (result.flow >= 2)
      toast(
        "AKINTI x" +
          (1 + result.flow * 0.25).toFixed(2) +
          " · +" +
          result.points,
      );
    else if (result.held) { haptic("hold"); toast("AKIŞ! +" + result.points); }
    else if (result.rocks) toast("KAYA KIRILDI +" + result.points);
    else if (game.level !== previous)
      toast(
        game.level === 3
          ? "YENİ RENK"
          : game.level === 4
            ? "KAYALIK SULAR"
            : "BÖLGE " + game.level,
      );
    else toast("+" + result.points);
    if (result.rescued) toast("YENİ AKINTI · +" + result.points);
    if (!missionDone && mission.done(game)) {
      missionDone = true;
      game.award(300);
      sound("pulse", 7);
      toast("HEDEF TAMAM · +300");
    }
    checkpoint();
    hud();
    if (game.over) {
      locked = performance.now() + 700;
      setTimeout(() => {
        if (game.over && mode === "play") end();
      }, 650);
    }
  }
  function pulse() {
    if (mode !== "play" || performance.now() < locked) return;
    const r = game.pulse();
    if (!r) return;
    path = [];
    looped = false;
    pointer = null;
    hint = null;
    burst(r.removed);
    locked = performance.now() + 350;
    shake = reducedMotion ? 0 : 7;
    lastInput = performance.now();
    sound("pulse");
    haptic("pulse");
    toast("DALGAKIRAN!");
    checkpoint();
    hud();
  }
  function indexAt(e) {
    const r = canvas.getBoundingClientRect(),
      x = (e.clientX - r.left) / cell,
      y = (e.clientY - r.top) / cell;
    if (x < 0 || x >= 6 || y < 0 || y >= 8) return -1;
    return Math.floor(y) * 6 + Math.floor(x);
  }
  function add(i) {
    if (mode !== "play" || performance.now() < locked || game.over) return;
    if (i < 0 || !game.board[i] || game.board[i].color < 0) return;
    if (looped) return;
    if (path.length >= 5 && i === path[0] && game.adjacent(path.at(-1), i)) {
      looped = true;
      sound("pulse");
      hud();
      return;
    }
    if (path.length > 1 && i === path[path.length - 2]) {
      path.pop();
      hud();
      return;
    }
    if (path.includes(i)) return;
    if (
      path.length &&
      (!game.adjacent(i, path.at(-1)) ||
        game.board[i].color !== game.board[path[0]].color)
    )
      return;
    path.push(i);
    hint = null;
    lastInput = performance.now();
    sound("note", Math.min(20, path.length * 2));
    hud();
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (
      mode !== "play" ||
      performance.now() < locked ||
      game.over ||
      pointer !== null ||
      e.button > 0
    )
      return;
    e.preventDefault();
    pointer = e.pointerId;
    canvas.setPointerCapture(pointer);
    path = [];
    looped = false;
    lastPointer = { clientX: e.clientX, clientY: e.clientY };
    add(indexAt(e));
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointer !== e.pointerId) return;
    e.preventDefault();
    const old = lastPointer || e;
    const steps = Math.min(
      120,
      Math.max(
        1,
        Math.ceil(
          Math.hypot(e.clientX - old.clientX, e.clientY - old.clientY) /
            (cell * 0.3),
        ),
      ),
    );
    for (let n = 1; n <= steps; n++)
      add(
        indexAt({
          clientX: old.clientX + ((e.clientX - old.clientX) * n) / steps,
          clientY: old.clientY + ((e.clientY - old.clientY) * n) / steps,
        }),
      );
    lastPointer = { clientX: e.clientX, clientY: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (pointer !== e.pointerId) return;
    pointer = null;
    commit();
  });
  canvas.addEventListener("pointercancel", (e) => {
    if (pointer !== e.pointerId) return;
    pointer = null;
    path = [];
    looped = false;
    hud();
  });
  canvas.addEventListener("lostpointercapture", () => {
    if (pointer !== null) {
      pointer = null;
      path = [];
      looped = false;
      hud();
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (mode === "play") {
        if (path.length) {
          path = [];
          looped = false;
          hud();
        } else pause();
      } else if (mode === "pause") close();
      return;
    }
    if (mode !== "play" || e.repeat || performance.now() < locked || game.over)
      return;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        " ",
        "Enter",
        "e",
        "E",
      ].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key.startsWith("Arrow")) {
        let x = hover % 6,
          y = Math.floor(hover / 6);
        if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
        if (e.key === "ArrowRight") x = Math.min(5, x + 1);
        if (e.key === "ArrowUp") y = Math.max(0, y - 1);
        if (e.key === "ArrowDown") y = Math.min(7, y + 1);
        hover = y * 6 + x;
        canvas.focus({ preventScroll: true });
        hintAt = performance.now() + 3000;
      }
      if (pointer !== null && [" ", "Enter", "e", "E"].includes(e.key)) return;
      if (e.key === " ") add(hover);
      if (e.key === "Enter") commit();
      if (e.key.toLowerCase() === "e") pulse();
    }
  });
  $("pulse").onclick = pulse;
  $("pause").onclick = pause;
  $("help").onclick = help;
  $("sound").onclick = () => {
    saved.mute = !saved.mute;
    save();
    hud();
    sound("note", 5);
  };
  document.querySelector(".brand").onclick = (e) => {
    e.preventDefault();
    if (mode === "play") pause();
    else if (mode === "menu") menu();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "play") pause();
  });
  window.addEventListener("pagehide", () => {
    if (game.over) record();
    else checkpoint();
  });
  function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function symbol(color, x, y, r) {
    ctx.beginPath();
    if (color === 0) {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else if (color === 1) {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.75);
      ctx.lineTo(x - r, y + r * 0.75);
      ctx.closePath();
    } else if (color === 2) {
      ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
    } else {
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
    }
    ctx.stroke();
  }
  function render(now) {
    requestAnimationFrame(render);
    if (document.hidden || width <= 0 || height <= 0) return;
    if (mode !== "play" && !dirty) return;
    if (now - lastDraw < 1000 / (reducedMotion ? 30 : 60)) return;
    lastDraw = now;
    dirty = false;
    const motionNow = reducedMotion ? 0 : now;
    const dt = Math.min(0.035, (now - animTime) / 1000 || 0.016);
    animTime = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (shake > 0.1) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
      shake *= 0.85;
    }
    const occupiedRows = game.board
        .map((g, i) => (g ? Math.floor(i / 6) : 9))
        .filter((y) => y < 9),
      waterRow = occupiedRows.length ? Math.min(...occupiedRows) : 8,
      waveY = Math.max(cell * 0.55, waterRow * cell + cell * 0.08);
    const water = ctx.createLinearGradient(0, waveY, 0, height);
    water.addColorStop(0, "#68bac124");
    water.addColorStop(1, "#2c768c48");
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.moveTo(0, waveY);
    for (let x = 0; x <= width; x += cell / 2)
      ctx.lineTo(
        x,
        waveY +
          Math.sin(motionNow * 0.002 + x * 0.035) * (reducedMotion ? 0 : 3),
      );
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = game.board.slice(0, 6).some(Boolean)
      ? "#ffb08a99"
      : "#8ed8d866";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= width; x += cell / 3) {
      const y =
        waveY +
        Math.sin(motionNow * 0.002 + x * 0.035) * (reducedMotion ? 0 : 3);
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 6; x++) {
        ctx.fillStyle = y === 0 ? "#bb7e5b0b" : "#b7d5d505";
        rounded(x * cell + 3, y * cell + 3, cell - 6, cell - 6, 8);
        ctx.fill();
        ctx.fillStyle = "#769a9f22";
        ctx.beginPath();
        ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, 1.3, 0, 7);
        ctx.fill();
      }
    ctx.strokeStyle = game.board.slice(0, 6).some(Boolean)
      ? "#f4aa87aa"
      : "#92aea733";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(4, cell);
    ctx.lineTo(width - 4, cell);
    ctx.stroke();
    ctx.setLineDash([]);
    const live = new Set();
    game.board.forEach((g, i) => {
      if (!g) return;
      live.add(g.id);
      const target = {
        x: ((i % 6) + 0.5) * cell,
        y: (Math.floor(i / 6) + 0.5) * cell,
      };
      let p = positions.get(g.id);
      if (!p) {
        p = { x: target.x, y: target.y + (reducedMotion ? 0 : cell * 0.3) };
        positions.set(g.id, p);
      }
      p.x += (target.x - p.x) * (reducedMotion ? 1 : Math.min(1, dt * 20));
      p.y += (target.y - p.y) * (reducedMotion ? 1 : Math.min(1, dt * 20));
      const selected = path.includes(i),
        loopTarget = looped && g.color === game.board[path[0]]?.color,
        hinted = hint?.includes(i) && path.length === 0;
      const scale = selected
        ? 1.08
        : loopTarget
          ? 1 + Math.sin(motionNow * 0.012) * (reducedMotion ? 0 : 0.065)
          : hinted
            ? 1 + Math.sin(motionNow * 0.005) * (reducedMotion ? 0 : 0.05)
            : 1;
      const s = cell * 0.69 * scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (g.color < 0) {
        ctx.fillStyle = "#42606a";
        rounded(-s / 2, -s / 2, s, s, 8);
        ctx.fill();
        ctx.strokeStyle = "#8ea0a6";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-s * 0.15, -s * 0.3);
        ctx.lineTo(s * 0.1, 0);
        ctx.lineTo(-s * 0.1, s * 0.3);
        ctx.stroke();
      } else {
        const c = themes[saved.theme].colors[g.color];
        ctx.fillStyle = "#031a2688";
        rounded(-s / 2, -s / 2 + 5, s, s, 12);
        ctx.fill();
        let gr = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
        gr.addColorStop(0, c);
        gr.addColorStop(1, c + "bc");
        ctx.fillStyle = gr;
        rounded(-s / 2, -s / 2, s, s, 12);
        ctx.fill();
        ctx.strokeStyle = selected || loopTarget ? "#f6ffeb" : "#ffffff55";
        ctx.lineWidth = selected || loopTarget ? 2.5 : 1;
        ctx.stroke();
        ctx.strokeStyle = "#163e48cc";
        ctx.lineWidth = 2;
        symbol(g.color, 0, 0, s * 0.19);
        if (g.star) {
          ctx.fillStyle = "#fff8d3";
          ctx.font = `bold ${cell * 0.22}px system-ui`;
          ctx.textAlign = "center";
          ctx.fillText("✦", s * 0.28, -s * 0.2);
        }
        if (hinted) {
          ctx.strokeStyle = "#fff9";
          ctx.lineWidth = 1;
          rounded(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6, 14);
          ctx.stroke();
        }
      }
      ctx.restore();
    });
    for (const id of positions.keys()) if (!live.has(id)) positions.delete(id);
    if (path.length) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#f3ffdfd9";
      ctx.beginPath();
      path.forEach((i, n) => {
        const p = positions.get(game.board[i]?.id);
        if (p) n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      if (looped) {
        const p = positions.get(game.board[path[0]]?.id);
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      const p = positions.get(game.board[path.at(-1)]?.id);
      if (p) {
        ctx.fillStyle = "#fffde2";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 7);
        ctx.fill();
      }
    }
    if (now < hintAt && mode === "play") {
      ctx.strokeStyle = "#fff8ca";
      ctx.lineWidth = 2;
      rounded(
        (hover % 6) * cell + 2,
        Math.floor(hover / 6) * cell + 2,
        cell - 4,
        cell - 4,
        12,
      );
      ctx.stroke();
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (mode === "play" && !path.length && now - lastInput > 6500 && !hint)
      hint = (game.turn >= 2 ? game.findLoop(9) : null) || game.findMove();
  }
  resize();
  hud();
  menu();
  requestAnimationFrame(render);
  // Deliberately expose read-only snapshots for debugging, never mutation hooks.
  window.tideglass = {
    snapshot: () => ({
      mode,
      score: game.score,
      turn: game.turn,
      level: game.level,
      charge: game.charge,
      flow: game.flow,
      bestFlow: game.bestFlow,
      loops: game.loops,
      rocksBroken: game.rocksBroken,
      holds: game.holds,
      mission: mission.text,
      missionDone,
      looped,
      over: game.over,
      board: game.board.map((g) => (g ? { ...g } : null)),
      path: [...path],
      saved: { ...saved },
    }),
  };
})();
