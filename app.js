(function () {
  "use strict";

  /* ---------------- data ---------------- */
  const firstNames = [
    "Ava",
    "Liam",
    "Noah",
    "Mia",
    "Oliver",
    "Amelia",
    "Freya",
    "George",
    "Isla",
    "Harper",
    "Oscar",
    "Ella",
    "Jack",
    "Ruby",
    "Leo",
    "Chloe",
    "Finn",
    "Poppy",
    "Arthur",
    "Willow",
  ];
  const lastNames = [
    "Patel",
    "Smith",
    "Khan",
    "O'Brien",
    "Brown",
    "Walker",
    "Singh",
    "Murphy",
    "Jones",
    "Garcia",
    "Wilson",
    "Taylor",
    "Chen",
    "Dawson",
    "Hughes",
  ];
  const companies = [
    "Acme Corp",
    "Globex",
    "Initech",
    "Umbrella",
    "Stark Ind.",
    "Wayne Ent.",
    "Soylent Co.",
    "Hooli",
    "Pied Piper",
    "Wonka Inc.",
  ];
  const domains = ["gmail.com", "outlook.com", "company.co.uk", "work.com"];

  function rand(a) {
    return a[Math.floor(Math.random() * a.length)];
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function makeSignup(forcePremium) {
    const fn = rand(firstNames),
      ln = rand(lastNames);
    const name = fn + " " + ln;
    const email =
      (fn[0] + ln).toLowerCase() +
      "." +
      Math.floor(Math.random() * 90 + 10) +
      "@" +
      rand(domains);
    const company = rand(companies);
    const plan = forcePremium
      ? Math.random() < 0.4
        ? "Premium"
        : "Free"
      : Math.random() < 0.5
        ? "Premium"
        : "Free";
    return { name, email, company, plan };
  }
  const manualCards = [
    makeSignup(true),
    makeSignup(true),
    makeSignup(false),
    makeSignup(false),
    makeSignup(false),
  ];
  const runBatch = Array.from({ length: 30 }, () => makeSignup(true));

  /* ---------------- helpers ---------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  function flash(el, cls) {
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 320);
  }

  let timerId = null,
    timerStart = 0;
  function startTimer(el) {
    stopTimer();
    timerStart = Date.now();
    const tick = () => {
      const el2 = el || $("#hudTimer");
      el2.textContent = fmt((Date.now() - timerStart) / 1000);
    };
    tick();
    timerId = setInterval(tick, 250);
    return {
      stop: stopTimer,
      elapsed: () => (Date.now() - timerStart) / 1000,
    };
  }
  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $("#" + id).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- drag & drop ---------------- */
  function zoneUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest("[data-dropzone]") : null;
  }
  function makeDraggable(el, onDrop) {
    el.addEventListener("pointerdown", function (e) {
      if (
        el.classList.contains("used") ||
        el.classList.contains("placed-block")
      )
        return;
      e.preventDefault();
      const sx = e.clientX,
        sy = e.clientY;
      const r = el.getBoundingClientRect();
      const offX = sx - r.left,
        offY = sy - r.top;
      const ghost = el.cloneNode(true);
      ghost.classList.add("drag-ghost");
      ghost.style.width = r.width + "px";
      document.body.appendChild(ghost);
      el.classList.add("dragging-src");
      let moved = false;
      function move(ev) {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4)
          moved = true;
        ghost.style.left = ev.clientX - offX + "px";
        ghost.style.top = ev.clientY - offY + "px";
        const z = zoneUnder(ev.clientX, ev.clientY);
        $$(".dropzone").forEach((dz) => dz.classList.remove("drop-hover"));
        if (z) z.classList.add("drop-hover");
      }
      function up(ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        ghost.remove();
        el.classList.remove("dragging-src");
        $$(".dropzone").forEach((dz) => dz.classList.remove("drop-hover"));
        if (!moved) {
          onDrop(null, el);
          return;
        }
        const z = zoneUnder(ev.clientX, ev.clientY);
        onDrop(z, el);
      }
      move({ clientX: sx, clientY: sy });
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    });
  }

  /* ================= ACT 1 : MANUAL ================= */
  const FIELDS = [
    ["name", "Name"],
    ["email", "Email"],
    ["company", "Company"],
    ["plan", "Plan"],
  ];
  let mIndex = 0,
    mErrors = 0,
    mFilled = 0,
    manualTimer = null;

  function buildManualCard() {
    const c = manualCards[mIndex];
    $("#cardCounter").textContent =
      "Card " + (mIndex + 1) + " of " + manualCards.length;
    const chips = $("#chipArea");
    chips.innerHTML = "";
    shuffle(FIELDS).forEach(([key, label]) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.dataset.field = key;
      chip.dataset.value = c[key];
      chip.innerHTML =
        '<div class="chip-k">' +
        label +
        '</div><div class="chip-v">' +
        c[key] +
        "</div>";
      chips.appendChild(chip);
      makeDraggable(chip, (zone, el) => {
        if (!zone || !zone.classList.contains("slot")) return;
        if (zone.classList.contains("filled")) {
          flash(zone, "flash-warn");
          return;
        }
        zone.querySelector(".slot-v").textContent = el.dataset.value;
        zone.classList.add("filled");
        if (zone.dataset.slot === el.dataset.field) {
          zone.classList.add("ok");
        } else {
          zone.classList.add("bad");
          mErrors++;
          updateManualHUD();
        }
        el.classList.add("used");
        mFilled++;
        if (mFilled === 4) $("#btnSave").disabled = false;
      });
    });
    const slots = $("#slotArea");
    slots.innerHTML = "";
    FIELDS.forEach(([key, label]) => {
      const s = document.createElement("div");
      s.className = "slot dropzone";
      s.dataset.dropzone = "";
      s.dataset.slot = key;
      s.innerHTML =
        '<span class="slot-k">' +
        label +
        '</span><span class="slot-v">—</span>';
      slots.appendChild(s);
    });
    $("#btnSave").disabled = true;
    const em = $("#btnEmail");
    em.className = "btn email";
    em.disabled = false;
    em.textContent = "✉ Send welcome email";
    $("#btnEmail").dataset.needed = c.plan === "Premium" ? "1" : "0";
    const left = manualCards.length - (mIndex + 1);
    $("#stackHint").innerHTML =
      left > 0
        ? '<span class="mini"></span>'.repeat(Math.min(left, 4)) +
          " &nbsp;" +
          left +
          " more in the queue"
        : "Last one — good luck.";
  }

  function updateManualHUD() {
    $("#hudCounter").textContent =
      mIndex + " / " + manualCards.length + " · " + mErrors + " err";
  }

  $("#btnSave").addEventListener("click", function () {
    const c = manualCards[mIndex];
    const em = $("#btnEmail");
    if (c.plan === "Premium" && !em.classList.contains("done")) {
      em.classList.add("show");
      flash(em, "flash-warn");
      em.textContent = "✉ Premium — send welcome email first";
      return;
    }
    mIndex++;
    mFilled = 0;
    if (mIndex >= manualCards.length) {
      finishManual();
    } else {
      buildManualCard();
      updateManualHUD();
    }
  });

  $("#btnEmail").addEventListener("click", function () {
    const em = this;
    if (em.classList.contains("done")) return;
    em.classList.add("done");
    em.textContent = "✉ Welcome email sent ✓";
    $("#btnSave").disabled = false;
  });

  function finishManual() {
    stopTimer();
    const t = fmt(manualTimer.elapsed());
    $("#hudTimer").textContent = t;
    $("#manualDone").style.display = "block";
    $("#manualDoneText").innerHTML =
      "You processed <b>" +
      manualCards.length +
      "</b> sign-ups in <b>" +
      t +
      "</b> with <b>" +
      mErrors +
      "</b> error" +
      (mErrors === 1 ? "" : "s") +
      ".<br>Now let's build the automation so you don't have to.";
    $("#actPill").textContent = "Manual done";
    $("#manualDone").scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  $("#btnToBuild").addEventListener("click", function () {
    showScreen("screen-build");
    $("#actPill").textContent = "Act 2 · Build";
    $("#hudTimerLbl").textContent = "Status";
    $("#hudCounterLbl").textContent = "Flow";
    $("#hudTimer").textContent = "—";
    $("#hudCounter").textContent = "building…";
  });

  /* ================= ACT 2 : BUILD ================= */
  $$("#palette .block").forEach((b) => {
    makeDraggable(b, (zone, el) => {
      if (!zone || !zone.classList.contains("zone")) return;
      const accept = (zone.dataset.accept || "").split(",");
      const type = el.dataset.type;
      if (!accept.includes(type)) {
        flash(zone, "flash-warn");
        return;
      }
      const cap = parseInt(zone.dataset.cap || "1", 10);
      if (zone.querySelectorAll(".placed-block").length >= cap) {
        flash(zone, "flash-warn");
        return;
      }
      zone.appendChild(el);
      el.classList.add("placed-block");
      el.style.cursor = "default";
      updateFlowStatus();
    });
  });
  $$("#palette .block .cond-field, #palette .block .cond-value").forEach(
    (sel) => {
      sel.addEventListener("change", updateFlowStatus);
    },
  );

  function flowValid() {
    const mainOk = $("#zoneMain").querySelector('[data-type="add-crm"]');
    const condEl = $("#zoneCond").querySelector('[data-type="condition"]');
    const condOk =
      condEl &&
      condEl.querySelector(".cond-field").value === "Plan" &&
      condEl.querySelector(".cond-value").value === "Premium";
    const emailOk = $("#zonePrem").querySelector('[data-type="send-email"]');
    return !!(mainOk && condOk && emailOk);
  }
  function updateFlowStatus() {
    const mainOk = !!$("#zoneMain").querySelector('[data-type="add-crm"]');
    const condEl = $("#zoneCond").querySelector('[data-type="condition"]');
    const condOk =
      !!condEl &&
      condEl.querySelector(".cond-field").value === "Plan" &&
      condEl.querySelector(".cond-value").value === "Premium";
    const emailOk = !!$("#zonePrem").querySelector('[data-type="send-email"]');
    $("#zoneMain").classList.toggle("satisfied", mainOk);
    $("#zoneCond").classList.toggle("satisfied", condOk);
    $("#zonePrem").classList.toggle("satisfied", emailOk);
    const ok = flowValid();
    $("#btnRun").disabled = !ok;
    $("#runHint").textContent = ok
      ? "The flow is valid — run it."
      : "Place the blocks to enable the run.";
    $("#hudCounter").textContent = ok ? "ready ✓" : "building…";
  }

  $("#btnRun").addEventListener("click", function () {
    showScreen("screen-run");
    $("#actPill").textContent = "Act 3 · Run";
    $("#hudTimerLbl").textContent = "Elapsed";
    $("#hudCounterLbl").textContent = "Processed";
    runBatchGame();
  });

  /* ================= ACT 3 : RUN ================= */
  function renderQueue(topIndex) {
    const stack = $("#queueStack");
    stack.innerHTML = "";
    const remaining = runBatch.length - topIndex;
    const maxBacks = 8;
    const backs = Math.min(Math.max(remaining - 1, 0), maxBacks);
    for (let i = 0; i < backs; i++) {
      const b = document.createElement("div");
      b.className = "qback";
      b.style.bottom = i * 5 + "px";
      b.style.left = i * 2 + "px";
      stack.appendChild(b);
    }
    if (remaining > 0) {
      const item = runBatch[topIndex];
      const top = document.createElement("div");
      top.className = "qtop";
      top.style.bottom = backs * 5 + "px";
      top.innerHTML =
        '<div class="qname">' +
        item.name +
        '</div><div class="qplan ' +
        (item.plan === "Premium" ? "pre" : "free") +
        '">' +
        item.plan +
        "</div>";
      stack.appendChild(top);
    }
    $("#queueCount").textContent = remaining;
  }

  function runBatchGame() {
    const pipeline = $("#pipeline");
    const token = $("#token");
    const queueStack = $("#queueStack");
    const processedPile = $("#processedPile");
    const nodes = {};
    $$(".pipe-node").forEach((n) => (nodes[n.dataset.node] = n));
    const runTimer = startTimer($("#mTime"));
    let idx = 0,
      done = 0;
    processedPile.innerHTML = "";
    renderQueue(0);
    $("#mQueue").textContent = runBatch.length;
    $("#mDone").textContent = "0/" + runBatch.length;
    $("#processedCount").textContent = "0";
    $("#log").innerHTML = "";
    token.style.opacity = "0";

    function rel(el) {
      const c = pipeline.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return {
        x: r.left - c.left + r.width / 2,
        y: r.top - c.top + r.height / 2,
      };
    }
    function moveTo(el) {
      const p = rel(el);
      token.style.left = p.x - token.offsetWidth / 2 + "px";
      token.style.top = p.y - token.offsetHeight / 2 + "px";
      token.style.opacity = "1";
    }
    function lit(node, on) {
      node.classList.toggle("lit", on);
    }
    function clearLits() {
      $$(".pipe-node").forEach((n) => n.classList.remove("lit"));
    }
    function logLine(html) {
      const line = document.createElement("div");
      line.innerHTML = html;
      const log = $("#log");
      log.insertBefore(line, log.firstChild);
      while (log.children.length > 4) log.removeChild(log.lastChild);
    }
    function addProcessed(item) {
      const chip = document.createElement("div");
      chip.className = "pchip " + (item.plan === "Premium" ? "pre" : "free");
      chip.textContent = item.name.split(" ")[0];
      processedPile.appendChild(chip);
      $("#processedCount").textContent = done;
    }

    function step() {
      if (idx >= runBatch.length) {
        finishRun();
        return;
      }
      const item = runBatch[idx];
      const isPrem = item.plan === "Premium";
      // 1) pick up the top card from the queue
      token.innerHTML =
        item.name + '<span class="tk-plan">' + item.plan + "</span>";
      clearLits();
      moveTo(queueStack);
      renderQueue(idx + 1); // queue now shows the NEXT card on top
      $("#mQueue").textContent = runBatch.length - done;
      // 2) travel through the flow
      setTimeout(() => {
        lit(nodes.trigger, true);
        moveTo(nodes.trigger);
      }, 140);
      setTimeout(() => {
        lit(nodes.trigger, false);
        lit(nodes.crm, true);
        moveTo(nodes.crm);
        logLine(
          "#" +
            (idx + 1) +
            ' <span class="ok">added to CRM</span> · <span class="' +
            (isPrem ? "pre" : "free") +
            '">' +
            item.plan +
            "</span>",
        );
      }, 320);
      setTimeout(() => {
        lit(nodes.crm, false);
        lit(nodes.decision, true);
        moveTo(nodes.decision);
      }, 500);
      setTimeout(() => {
        lit(nodes.decision, false);
        if (isPrem) {
          lit(nodes.email, true);
          moveTo(nodes.email);
        } else {
          moveTo(processedPile);
        }
      }, 680);
      // 3) drop into the processed pile
      setTimeout(() => {
        lit(nodes.email, false);
        moveTo(processedPile);
        done++;
        addProcessed(item);
        $("#mDone").textContent = done + "/" + runBatch.length;
        $("#hudCounter").textContent = done + "/" + runBatch.length;
        idx++;
        token.style.opacity = "0"; // card "dropped in" — next card will be picked up
        setTimeout(step, 220);
      }, 880);
    }
    setTimeout(step, 300);

    function finishRun() {
      stopTimer();
      const t = fmt(runTimer.elapsed());
      $("#mTime").textContent = t;
      $("#hudTimer").textContent = t;
      token.style.opacity = "0";
      setTimeout(() => {
        $("#rYouTime").textContent = manualTimer
          ? fmt(manualTimer.elapsed())
          : "0:00";
        $("#rYouCount").textContent = manualCards.length + " processed";
        $("#rYouErr").textContent =
          mErrors + " error" + (mErrors === 1 ? "" : "s");
        $("#rBotTime").textContent = t;
        $("#rBotCount").textContent = runBatch.length + " processed";
        $("#rBotErr").textContent = "0 errors";
        $("#actPill").textContent = "Done";
        showScreen("screen-results");
      }, 700);
    }
  }

  /* ================= flow control ================= */
  $("#btnStart").addEventListener("click", function () {
    mIndex = 0;
    mErrors = 0;
    mFilled = 0;
    showScreen("screen-manual");
    $("#actPill").textContent = "Act 1 · Manual";
    $("#hudTimerLbl").textContent = "Time";
    $("#hudCounterLbl").textContent = "Progress";
    $("#manualDone").style.display = "none";
    buildManualCard();
    updateManualHUD();
    manualTimer = startTimer($("#hudTimer"));
  });

  $("#btnAgain").addEventListener("click", function () {
    const pal = $("#palette");
    $$(".placed-block").forEach((b) => {
      pal.appendChild(b);
      b.classList.remove("placed-block");
      b.style.cursor = "grab";
    });
    $$("#palette .cond-field").forEach((s) => (s.selectedIndex = 0));
    $$("#palette .cond-value").forEach((s) => (s.selectedIndex = 0));
    $$(".zone").forEach((z) => z.classList.remove("satisfied"));
    $("#btnRun").disabled = true;
    $("#runHint").textContent = "Place the blocks to enable the run.";
    $("#processedPile").innerHTML = "";
    $("#mQueue").textContent = "30";
    $("#mDone").textContent = "0/30";
    $("#mErr").textContent = "0";
    $("#mTime").textContent = "0:00";
    $("#log").innerHTML = "";
    $("#actPill").textContent = "Intro";
    $("#hudTimer").textContent = "0:00";
    $("#hudCounter").textContent = "—";
    showScreen("screen-intro");
  });
})();
