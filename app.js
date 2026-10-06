/* ============================================================
   Wellness Compass — interactive logic
   Flow: Landing → Multi-step assessment → Snapshot & results
   ============================================================ */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const views = {
    landing: $("#view-landing"),
    form: $("#view-form"),
    results: $("#view-results"),
  };

  const form = $("#wellnessForm");
  const steps = $$(".step", form);
  const totalSteps = steps.length;
  let current = 0;

  const els = {
    start: $("#startBtn"),
    resume: $("#resumeBtn"),
    restart: $("#restartBtn"),
    prev: $("#prevBtn"),
    next: $("#nextBtn"),
    submit: $("#submitBtn"),
    progressFill: $("#progressFill"),
    progressLabel: $("#progressLabel"),
    again: $("#againBtn"),
    print: $("#printBtn"),
  };

  const STORAGE_KEY = "wellness-compass-v1";

  // In-memory copy of the active result + session, so progress toggles
  // can be persisted without recomputing.
  let session = null; // { data, progress: boolean[7], savedAt }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;
      // normalise progress to exactly 7 booleans
      const prog = Array.isArray(parsed.progress) ? parsed.progress : [];
      parsed.progress = Array.from({ length: 7 }, (_, i) => !!prog[i]);
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveSession() {
    if (!session) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (_) {}
  }

  /* ---------------- View switching ---------------- */
  function showView(name) {
    Object.entries(views).forEach(([k, el]) => {
      const active = k === name;
      el.hidden = !active;
      el.classList.toggle("is-active", active);
    });
    els.restart.hidden = name === "landing";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- Live slider labels ---------------- */
  $$("input[data-live]", form).forEach((input) => {
    const target = $(`.val[data-for="${input.dataset.live}"]`);
    const sync = () => { if (target) target.textContent = input.value; };
    input.addEventListener("input", sync);
    sync();
  });

  /* ---------------- Chips (single + multi) ---------------- */
  $$(".chips").forEach((group) => {
    const single = group.dataset.single;
    const multi = group.dataset.multi;
    const hidden = single
      ? form.elements[single]
      : form.elements[multi];

    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;

      if (single) {
        $$(".chip", group).forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
        hidden.value = chip.dataset.value;
      } else {
        chip.classList.toggle("selected");
        const vals = $$(".chip.selected", group).map((c) => c.dataset.value);
        hidden.value = vals.join(",");
      }
    });
  });

  /* ---------------- Step navigation ---------------- */
  function updateStepUI() {
    steps.forEach((s, i) => s.classList.toggle("is-active", i === current));
    els.progressFill.style.width = `${((current + 1) / totalSteps) * 100}%`;
    els.progressLabel.textContent = `Langkah ${current + 1} dari ${totalSteps}`;
    els.prev.hidden = current === 0;
    els.next.hidden = current === totalSteps - 1;
    els.submit.hidden = current !== totalSteps - 1;
  }

  function validateStep(i) {
    const step = steps[i];
    const fields = $$("input[required], select[required]", step);
    for (const f of fields) {
      // hidden inputs (chips) validated separately
      if (f.type === "hidden") {
        if (!f.value) { flashChips(step); return false; }
        continue;
      }
      if (!f.checkValidity()) {
        f.reportValidity();
        return false;
      }
    }
    // goal chip is required and lives as hidden input in last step
    const goal = step.querySelector('input[name="goal"]');
    if (goal && !goal.value) { flashChips(step); return false; }
    return true;
  }

  function flashChips(step) {
    const group = step.querySelector(".chips[data-single]");
    if (!group) return;
    group.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 280 }
    );
  }

  els.next.addEventListener("click", () => {
    if (!validateStep(current)) return;
    current = clamp(current + 1, 0, totalSteps - 1);
    updateStepUI();
  });

  els.prev.addEventListener("click", () => {
    current = clamp(current - 1, 0, totalSteps - 1);
    updateStepUI();
  });

  /* ---------------- Start / restart ---------------- */
  els.start.addEventListener("click", () => { showView("form"); current = 0; updateStepUI(); });
  const restart = () => {
    form.reset();
    $$(".chip.selected").forEach((c) => c.classList.remove("selected"));
    $$("input[data-live]", form).forEach((i) => i.dispatchEvent(new Event("input")));
    current = 0;
    updateStepUI();
    showView("form");
  };
  els.restart.addEventListener("click", restart);
  els.again.addEventListener("click", restart);
  els.print.addEventListener("click", () => window.print());

  // Resume a saved session: recompute result from stored input and render,
  // restoring the saved 7-day progress.
  function openSavedResult() {
    const saved = loadSession();
    if (!saved) return false;
    session = saved;
    const result = analyze(session.data);
    render(result, session.data);
    showView("results");
    return true;
  }
  els.resume.addEventListener("click", openSavedResult);

  /* ---------------- Submit ---------------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateStep(current)) return;
    const data = collect();
    const result = analyze(data);
    // fresh assessment → reset 7-day progress
    session = { data, progress: Array(7).fill(false), savedAt: Date.now() };
    saveSession();
    render(result, data);
    showView("results");
  });

  function collect() {
    const fd = new FormData(form);
    const num = (k) => parseFloat(fd.get(k));
    return {
      height: num("height"),
      weight: num("weight"),
      age: num("age"),
      gender: fd.get("gender"),
      sleep: num("sleep"),
      activity: num("activity"),
      screen: num("screen"),
      water: num("water"),
      produce: num("produce"),
      stress: num("stress"),
      energy: num("energy"),
      goal: fd.get("goal") || "balance",
      challenges: (fd.get("challenges") || "").split(",").filter(Boolean),
    };
  }

  /* ============================================================
     SCORING ENGINE
     Each dimension scored 0–100, weighted into an overall score.
     ============================================================ */

  // Smooth "band" scorer: full marks inside [idealLow, idealHigh],
  // decaying linearly outside toward hardLow / hardHigh.
  function bandScore(v, idealLow, idealHigh, hardLow, hardHigh) {
    if (v >= idealLow && v <= idealHigh) return 100;
    if (v < idealLow) return clamp(((v - hardLow) / (idealLow - hardLow)) * 100, 0, 100);
    return clamp(((hardHigh - v) / (hardHigh - idealHigh)) * 100, 0, 100);
  }

  function bmiFrom(h, w) {
    const m = h / 100;
    return w / (m * m);
  }

  function analyze(d) {
    const bmi = bmiFrom(d.height, d.weight);

    const dims = {
      bmi: { label: "Berat & BMI", score: Math.round(bandScore(bmi, 18.5, 24.9, 14, 35)), weight: 1 },
      sleep: { label: "Kualitas Tidur", score: Math.round(bandScore(d.sleep, 7, 9, 3, 12)), weight: 1.3 },
      activity: { label: "Aktivitas Fisik", score: Math.round(bandScore(d.activity, 4, 7, 0, 7)), weight: 1.2 },
      screen: { label: "Screen Time", score: Math.round(bandScore(d.screen, 0, 3, 0, 12)), weight: 0.8 },
      water: { label: "Hidrasi", score: Math.round(bandScore(d.water, 8, 12, 0, 16)), weight: 0.9 },
      produce: { label: "Buah & Sayur", score: Math.round(bandScore(d.produce, 5, 10, 0, 10)), weight: 1 },
      stress: { label: "Manajemen Stres", score: Math.round(bandScore(d.stress, 1, 4, 1, 10)), weight: 1.2 },
      energy: { label: "Tingkat Energi", score: Math.round((d.energy / 10) * 100), weight: 0.8 },
    };

    let wsum = 0, wtot = 0;
    Object.values(dims).forEach((x) => { wsum += x.score * x.weight; wtot += x.weight; });
    const overall = Math.round(wsum / wtot);

    const sorted = Object.entries(dims).sort((a, b) => b[1].score - a[1].score);
    const strengths = sorted.filter(([, x]) => x.score >= 70).slice(0, 4);
    const priorities = sorted.filter(([, x]) => x.score < 70).reverse().slice(0, 4);

    return { bmi, dims, overall, strengths, priorities };
  }

  /* ============================================================
     COPYWRITING / RECOMMENDATION LIBRARY
     ============================================================ */

  const tierFor = (s) =>
    s >= 85 ? { name: "Thriving", emoji: "🌟", msg: "Kebiasaanmu sudah sangat solid. Fokus sekarang: menjaga konsistensi dan menyempurnakan detail." }
    : s >= 70 ? { name: "Balanced", emoji: "🌿", msg: "Fondasi gaya hidupmu sehat. Beberapa penyesuaian kecil bisa membawamu ke level berikutnya." }
    : s >= 55 ? { name: "Building", emoji: "🧭", msg: "Kamu sedang di jalur yang benar. Ada beberapa area kunci yang akan memberi dampak besar." }
    : s >= 40 ? { name: "Needs Care", emoji: "💛", msg: "Ada ruang perbaikan yang jelas. Mulai dari satu kebiasaan kecil akan terasa dampaknya." }
    : { name: "Reset Time", emoji: "🔄", msg: "Saatnya reset lembut. Pilih satu langkah mudah hari ini — momentum tumbuh dari sana." };

  const bmiLabel = (b) =>
    b < 18.5 ? "di bawah normal" : b < 25 ? "normal" : b < 30 ? "berlebih" : "obesitas";

  const STRENGTH_COPY = {
    bmi: "Berat badanmu berada di rentang yang sehat — pondasi bagus untuk energi harian.",
    sleep: "Pola tidurmu konsisten dan cukup — tubuh dan pikiranmu punya waktu pulih yang baik.",
    activity: "Kamu rutin bergerak. Ini mesin utama untuk mood, jantung, dan metabolisme.",
    screen: "Screen time-mu terkendali — matamu dan fokusmu berterima kasih.",
    water: "Hidrasimu bagus. Air yang cukup menjaga energi dan konsentrasi tetap stabil.",
    produce: "Asupan buah & sayurmu kaya — serat dan mikronutrien terpenuhi.",
    stress: "Kamu cukup tenang mengelola tekanan. Keseimbangan mentalmu terjaga.",
    energy: "Energimu di siang hari tinggi — tanda ritme harianmu bekerja baik.",
  };

  const PRIORITY_COPY = {
    bmi: (d, b) => `BMI-mu tergolong ${bmiLabel(b)} (${b.toFixed(1)}). Fokus pada pola makan seimbang dan gerak teratur, bukan diet ekstrem.`,
    sleep: (d) => `Tidurmu rata-rata ${d.sleep} jam. Targetkan 7–9 jam dengan jadwal tidur yang lebih teratur.`,
    activity: (d) => `Kamu aktif ${d.activity} hari/minggu. Tambah bertahap menuju 4–5 hari, mulai dari jalan cepat 20 menit.`,
    screen: (d) => `Screen time ${d.screen} jam/hari di luar kerja cukup tinggi. Coba batasi 1 jam sebelum tidur.`,
    water: (d) => `Kamu minum ± ${d.water} gelas/hari. Naikkan perlahan ke 8 gelas dengan botol yang selalu terlihat.`,
    produce: (d) => `Baru ${d.produce} porsi buah & sayur/hari. Tambah 1 porsi per makan untuk serat & imun.`,
    stress: (d) => `Tingkat stresmu ${d.stress}/10. Sisipkan jeda napas 5 menit dua kali sehari untuk menurunkannya.`,
    energy: (d) => `Energimu terasa rendah (${d.energy}/10). Perbaikan tidur, hidrasi, dan gerak biasanya mengangkatnya.`,
  };

  // Micro-actions per dimension used to build plan + today list
  const ACTIONS = {
    bmi: ["Catat porsi makan di satu kali makan hari ini", "Ganti satu camilan dengan buah", "Tambahkan protein di sarapan"],
    sleep: ["Matikan layar 45 menit sebelum tidur", "Tetapkan jam tidur yang sama malam ini", "Redupkan lampu kamar 1 jam sebelum tidur"],
    activity: ["Jalan cepat 15 menit", "Lakukan 10 menit peregangan", "Naik tangga alih-alih lift hari ini"],
    screen: ["Aktifkan mode fokus 1 jam", "Letakkan ponsel di ruangan lain saat makan", "Ambil jeda layar tiap 50 menit"],
    water: ["Minum 1 gelas air sekarang", "Isi botol air dan taruh di meja", "Minum air sebelum tiap makan"],
    produce: ["Tambahkan sayur ke makan siang", "Siapkan buah potong untuk camilan", "Mulai hari dengan segelas smoothie sayur-buah"],
    stress: ["Latihan napas 4-7-8 selama 5 menit", "Tulis 3 hal yang kamu syukuri", "Jalan santai tanpa ponsel 10 menit"],
    energy: ["Keluar cari sinar matahari pagi 10 menit", "Minum air sebelum kopi", "Istirahat aktif tiap 1 jam kerja"],
  };

  const GOAL_FOCUS = {
    energy: ["sleep", "activity", "water"],
    sleep: ["sleep", "stress", "screen"],
    weight: ["bmi", "activity", "produce"],
    stress: ["stress", "sleep", "activity"],
    fitness: ["activity", "produce", "sleep"],
    balance: ["stress", "sleep", "activity"],
  };

  /* ============================================================
     7-DAY PLAN GENERATOR
     Weaves together priority areas + user goal.
     ============================================================ */
  function buildPlan(result, data) {
    const focusKeys = [];
    // start from goal-driven focus, then fill with weakest dims
    (GOAL_FOCUS[data.goal] || []).forEach((k) => focusKeys.push(k));
    result.priorities.forEach(([k]) => { if (!focusKeys.includes(k)) focusKeys.push(k); });
    Object.keys(result.dims).forEach((k) => { if (!focusKeys.includes(k)) focusKeys.push(k); });

    const dayThemes = [
      { title: "Fondasi", lead: "Mulai perlahan & tetapkan niat" },
      { title: "Gerak", lead: "Aktifkan tubuh" },
      { title: "Nutrisi", lead: "Isi dengan bahan bakar baik" },
      { title: "Tenang", lead: "Rawat pikiran" },
      { title: "Ritme", lead: "Perkuat rutinitas tidur" },
      { title: "Konsistensi", lead: "Ulangi yang berhasil" },
      { title: "Refleksi", lead: "Tinjau & rayakan progres" },
    ];

    return dayThemes.map((theme, i) => {
      const key = focusKeys[i % focusKeys.length];
      const label = result.dims[key].label;
      const action = ACTIONS[key][i % ACTIONS[key].length];
      return {
        day: i + 1,
        title: theme.title,
        focus: label,
        task: `${theme.lead}. ${action}.`,
      };
    });
  }

  /* ---------------- Daily routine ---------------- */
  function buildRoutine(result, data) {
    const earlyBird = data.energy >= 6;
    const base = [
      { time: "06:30", title: "Bangun & hidrasi", desc: "Segelas air + buka tirai untuk cahaya pagi" },
      { time: "07:00", title: data.goal === "fitness" || data.goal === "weight" ? "Gerak 20–30 menit" : "Peregangan ringan", desc: "Mulai hari dengan tubuh yang aktif" },
      { time: "07:45", title: "Sarapan seimbang", desc: "Protein + serat dari buah/sayur" },
      { time: "12:30", title: "Makan siang + jeda layar", desc: "Makan tanpa ponsel, lalu jalan 5 menit" },
      { time: "15:00", title: "Reset energi", desc: data.stress >= 6 ? "Napas 4-7-8 selama 5 menit" : "Minum air & peregangan singkat" },
      { time: "18:00", title: data.activity < 3 ? "Jalan cepat 20 menit" : "Aktivitas pilihanmu", desc: "Lepaskan ketegangan hari ini" },
      { time: "19:30", title: "Makan malam ringan", desc: "Perbanyak sayur, kurangi gula" },
      { time: "21:30", title: "Wind-down bebas layar", desc: "Redupkan lampu, baca/journaling" },
      { time: "22:30", title: "Tidur", desc: `Target ${data.sleep < 7 ? "7–8" : "7–9"} jam tidur berkualitas` },
    ];
    return base;
  }

  /* ---------------- Today actions ---------------- */
  function buildToday(result, data) {
    const picks = [];
    const focus = result.priorities.map(([k]) => k);
    const goalFocus = GOAL_FOCUS[data.goal] || [];
    const order = [...new Set([...goalFocus, ...focus])];
    order.forEach((k) => {
      const a = ACTIONS[k];
      if (a) picks.push(a[Math.floor(Math.random() * a.length)]);
    });
    // guarantee at least 4, cap at 5
    while (picks.length < 4) picks.push(ACTIONS.water[picks.length % ACTIONS.water.length]);
    return [...new Set(picks)].slice(0, 5);
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function render(result, data) {
    const tier = tierFor(result.overall);

    $("#resultTier").textContent = `${tier.emoji} ${tier.name}`;
    $("#scoreTier").textContent = `${tier.emoji} ${tier.name}`;
    $("#resultSummary").textContent = tier.msg;

    // gauge
    injectGradient();
    animateGauge(result.overall);

    // metrics
    const metricsHtml = Object.entries(result.dims).map(([k, x]) => {
      const color = x.score >= 70 ? "var(--good)" : x.score >= 45 ? "var(--warn)" : "var(--bad)";
      return `
        <div class="metric">
          <div class="metric-top"><b>${x.label}</b><span>${x.score}/100</span></div>
          <div class="metric-bar"><i style="background:${color}" data-w="${x.score}"></i></div>
        </div>`;
    }).join("");
    $("#metricsList").innerHTML = metricsHtml;
    requestAnimationFrame(() => {
      $$("#metricsList .metric-bar i").forEach((bar) => { bar.style.width = `${bar.dataset.w}%`; });
    });

    // strengths
    const strengthsEl = $("#strengthsList");
    if (result.strengths.length) {
      strengthsEl.innerHTML = result.strengths
        .map(([k]) => `<li><span class="dot good"></span><span>${STRENGTH_COPY[k]}</span></li>`)
        .join("");
    } else {
      strengthsEl.innerHTML = `<li><span class="dot good"></span><span>Setiap perjalanan punya titik mulai. Kekuatan pertamamu adalah keputusan untuk mengecek diri hari ini.</span></li>`;
    }

    // priorities
    const prioEl = $("#prioritiesList");
    if (result.priorities.length) {
      prioEl.innerHTML = result.priorities
        .map(([k]) => `<li><span class="dot warn"></span><span>${PRIORITY_COPY[k](data, result.bmi)}</span></li>`)
        .join("");
    } else {
      prioEl.innerHTML = `<li><span class="dot warn"></span><span>Tidak ada area kritis — fokusmu kini menjaga konsistensi semua kebiasaan baikmu.</span></li>`;
    }

    // plan (with per-day progress checkboxes)
    const prog = (session && session.progress) || Array(7).fill(false);
    $("#planList").innerHTML = buildPlan(result, data)
      .map((p, i) => `
        <div class="plan-day${prog[i] ? " done" : ""}" data-day="${i}" role="button" tabindex="0"
             aria-pressed="${prog[i] ? "true" : "false"}" title="Tandai hari ini selesai">
          <span class="plan-check" aria-hidden="true">✓</span>
          <h4>Hari ${p.day} · ${p.title}</h4>
          <div class="focus">${p.focus}</div>
          <p>${p.task}</p>
        </div>`)
      .join("");
    updatePlanProgress();

    // routine
    $("#routineList").innerHTML = buildRoutine(result, data)
      .map((r) => `
        <li>
          <span class="time">${r.time}</span>
          <span class="act"><b>${r.title}</b><small>${r.desc}</small></span>
        </li>`)
      .join("");

    // today
    const todayEl = $("#todayList");
    todayEl.innerHTML = buildToday(result, data)
      .map((t) => `<li><span class="checkbox">✓</span><span class="txt">${t}</span></li>`)
      .join("");
  }

  /* ---------------- 7-day plan progress ---------------- */
  function updatePlanProgress() {
    if (!session) return;
    const done = session.progress.filter(Boolean).length;
    const pct = Math.round((done / 7) * 100);
    const fill = $("#planProgressFill");
    const label = $("#planProgressLabel");
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${done} / 7 hari selesai`;
  }

  function toggleDay(dayIndex) {
    if (!session || dayIndex < 0 || dayIndex > 6) return;
    session.progress[dayIndex] = !session.progress[dayIndex];
    saveSession();
    const card = $(`.plan-day[data-day="${dayIndex}"]`);
    if (card) {
      const on = session.progress[dayIndex];
      card.classList.toggle("done", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
    }
    updatePlanProgress();
  }

  /* ---------------- Gauge helpers ---------------- */
  function injectGradient() {
    const svg = $(".gauge-svg");
    if (svg.querySelector("#g")) return;
    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML = `
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#0ea5e9"/>
      </linearGradient>`;
    svg.prepend(defs);
  }

  function animateGauge(score) {
    const circle = $("#gaugeValue");
    const R = 68;
    const circ = 2 * Math.PI * R; // ~427
    circle.style.strokeDasharray = circ;
    const offset = circ - (score / 100) * circ;
    // color shift by tier
    const stroke = score >= 70 ? "url(#g)" : score >= 45 ? "var(--warn)" : "var(--bad)";
    requestAnimationFrame(() => {
      circle.style.strokeDashoffset = offset;
      if (score < 70) circle.style.stroke = stroke;
    });

    // count-up number
    const numEl = $("#scoreNum");
    let cur = 0;
    const dur = 1200, t0 = performance.now();
    const tick = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      numEl.textContent = Math.round(eased * score);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- Checklist toggle (bound once) ---------------- */
  $("#todayList").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) li.classList.toggle("done");
  });

  /* ---------------- 7-day plan toggle (bound once) ---------------- */
  $("#planList").addEventListener("click", (e) => {
    const card = e.target.closest(".plan-day");
    if (card) toggleDay(Number(card.dataset.day));
  });
  $("#planList").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".plan-day");
    if (card) { e.preventDefault(); toggleDay(Number(card.dataset.day)); }
  });

  /* ---------------- Init ---------------- */
  updateStepUI();
  // Offer "resume" on landing when a prior session exists.
  if (loadSession()) els.resume.hidden = false;
  showView("landing");
})();
