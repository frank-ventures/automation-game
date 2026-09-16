"use strict";

/* ================= TUNABLES ================= */
const manualCards = 5;      // Act 1: cards to process by hand
const runBatch    = 30;     // Act 3: records the bot processes
const ACT3_STEP_MS = 900;   // Act 3: ms per item (~27s for 30)

/* ================= DATA ================= */
const FIRST = ["Amira","Ben","Chloe","Dev","Elena","Farid","Grace","Hugo","Isla","Jack","Kira","Leo","Maya","Noor","Owen","Priya","Rhys","Sana","Tom","Uma","Vik","Wren","Yusuf","Zara"];
const LAST  = ["Patel","Kaur","Brennan","Okafor","Marsh","Ivanov","Diaz","Whitcombe","Ahmed","Novak","Suzuki","Bright","Ellison","Kone","Fischer","Reyes"];
const COMPANIES = ["Acme Ltd","Brightpath Co","Cedar Group","Dune Analytics","Everest HR","Foxglove Ltd","GraniteOps","Hexley & Sons","Ionic Retail","Junction Foods","Kestrel Media","Lumen Care","Northwind","Orchard Legal","Pinecrest","Quillo","Ridge Bank","Sable Travel","Tessellate","Umbra Health"];
const PLANS = ["Basic", "Pro", "Premium"];

// NOTE (known quirk, kept as specified): forcePremium only NUDGES the plan
// probability (50% vs 40%) — it does not guarantee a Premium plan.
function makeSignup(forcePremium) {
    const name = FIRST[Math.floor(Math.random()*FIRST.length)] + " " + LAST[Math.floor(Math.random()*LAST.length)];
    const plan = Math.random() < (forcePremium ? 0.5 : 0.4)
    ? "Premium"
    : PLANS[Math.floor(Math.random()*2)]; // Basic / Pro
    const company = COMPANIES[Math.floor(Math.random()*COMPANIES.length)];
    const email = name.split(" ")[0].toLowerCase() + "@" + company.toLowerCase().replace(/[^a-z]/g,"") + ".co.uk";
    return { name, email, company, plan };
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const $ = s => document.querySelector(s);

/* ================= STATE ================= */
const state = {
    manualCards: [], cardIndex: 0, manualErrors: 0, manualSeconds: 0,
    timerId: null, timerStart: null,
    botSeconds: 0, emailsSent: 0
};

/* ================= DRAG HELPER (pointer-event based, mouse + touch) ================= */
function makeDraggable(el, onDrop) {
    el.addEventListener("pointerdown", e => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const offX = e.clientX - rect.left, offY = e.clientY - rect.top;
        const ghost = el.cloneNode(true);
        ghost.classList.add("drag-ghost");
        ghost.style.width = rect.width + "px";
        ghost.style.left = rect.left + "px";
        ghost.style.top  = rect.top + "px";
        document.body.appendChild(ghost);

        let currentZone = null;
        const zoneAt = (x, y) => {
            const t = document.elementFromPoint(x, y);
            return t ? t.closest("[data-dropzone]") : null;
        };
        const move = ev => {
            ghost.style.left = (ev.clientX - offX) + "px";
            ghost.style.top  = (ev.clientY - offY) + "px";
            const z = zoneAt(ev.clientX, ev.clientY);
            if (z !== currentZone) {
                if (currentZone) currentZone.classList.remove("over");
                currentZone = z;
                if (z) z.classList.add("over");
            }
        };
        const up = ev => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", up);
            document.removeEventListener("pointercancel", up);
            ghost.remove();
            if (currentZone) currentZone.classList.remove("over");
            onDrop(zoneAt(ev.clientX, ev.clientY), el);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
    });
}

/* ================= ACT NAVIGATION ================= */
function showAct(id) {
    document.querySelectorAll("section.act").forEach(s => s.classList.toggle("active", s.id === id));
    document.querySelectorAll(".act-tab").forEach(t => t.classList.toggle("active", t.dataset.act === id));
}
document.querySelectorAll(".act-tab").forEach(tab =>
tab.addEventListener("click", () => showAct(tab.dataset.act)));

function unlock(actId) {
    const tab = document.querySelector(`.act-tab[data-act="${actId}"]`);
    if (tab) tab.disabled = false;
}

/* ================= ACT 1 — MANUAL ================= */
const SLOT_FIELDS = ["name", "email", "company", "plan"];
const SLOT_LABELS = { name: "Name", email: "Email", company: "Company", plan: "Plan" };

function initAct1() {
    state.manualCards = Array.from({ length: manualCards }, () => makeSignup());
    // Fix for the known quirk: guarantee at least one Premium card in Act 1,
    // otherwise the "Send welcome email" step may never appear.
    if (!state.manualCards.some(c => c.plan === "Premium")) {
        const idx = Math.floor(Math.random() * state.manualCards.length);
        state.manualCards[idx].plan = "Premium";
        state.manualCards[idx].email = state.manualCards[idx].email; // plan is the only change needed
    }
    $("#a1-total").textContent = manualCards;

    $("#a1-slots").innerHTML = SLOT_FIELDS.map(f =>
    `<div class="slot" data-dropzone="slot" data-field="${f}"><span class="slot-label">${SLOT_LABELS[f]}</span></div>`
    ).join("");

    $("#a1-save").addEventListener("click", saveManualCard);
    $("#a1-email").addEventListener("click", () => {
        state.welcomeSent = true;
        $("#a1-email").disabled = true;
        $("#a1-email").textContent = "✅ Welcome email sent";
        updateA1Buttons();
    });

    renderManualCard();
}

function startTimer() {
    if (state.timerStart) return;
    state.timerStart = Date.now();
    state.timerId = setInterval(() => {
        state.manualSeconds = Math.round((Date.now() - state.timerStart) / 1000);
        $("#a1-time").textContent = state.manualSeconds + "s";
    }, 250);
}

function renderManualCard() {
    const s = state.manualCards[state.cardIndex];
    state.welcomeSent = false;
    $("#a1-card").textContent = state.cardIndex + 1;
    $("#a1-email").textContent = "📧 Send welcome email";
    $("#a1-premium-flag").classList.toggle("hidden", s.plan !== "Premium");

    // reset slots
    document.querySelectorAll("#a1-slots .slot").forEach(sl => {
        sl.classList.remove("filled");
        sl.innerHTML = `<span class="slot-label">${SLOT_LABELS[sl.dataset.field]}</span>`;
    });

    // chips in RANDOM order — deliberate, creates slip/error chance
    const fields = shuffle([...SLOT_FIELDS]);
    const chipsEl = $("#a1-chips");
    chipsEl.innerHTML = fields.map(f =>
    `<div class="chip" data-field="${f}"><b>${SLOT_LABELS[f]}:</b> ${s[f]}</div>`
    ).join("");
    chipsEl.querySelectorAll(".chip").forEach(chip =>
    makeDraggable(chip, (zone, src) => handleChipDrop(zone, src))
    );
    updateA1Buttons();
}

function handleChipDrop(zone, chip) {
    if (!zone || zone.dataset.dropzone !== "slot") return; // dropped on nothing — ignore, no penalty
    const s = state.manualCards[state.cardIndex];
    const field = chip.dataset.field;
    if (zone.dataset.field === field && !zone.classList.contains("filled")) {
        startTimer();
        zone.classList.add("filled");
        zone.innerHTML = `<span class="filled-text">${s[field]}</span>`;
        chip.remove();
        updateA1Buttons();
    } else {
        // wrong slot (or slot already filled) → error
        state.manualErrors++;
        $("#a1-errors").textContent = state.manualErrors;
        chip.classList.remove("shake"); void chip.offsetWidth; chip.classList.add("shake");
    }
}

function updateA1Buttons() {
    const s = state.manualCards[state.cardIndex];
    if (!s) return;
    const filled = document.querySelectorAll("#a1-slots .slot.filled").length;
    const needsEmail = s.plan === "Premium" && !state.welcomeSent;
    $("#a1-email").disabled = !(s.plan === "Premium") || state.welcomeSent;
    $("#a1-save").disabled = filled < 4 || needsEmail;
}

function saveManualCard() {
    state.cardIndex++;
    if (state.cardIndex >= manualCards) {
        clearInterval(state.timerId);
        $("#a1-done").classList.remove("hidden");
        $("#a1-done").innerHTML = `
        <p><b>Done.</b> ${manualCards} records in <b>${state.manualSeconds}s</b>
        with <b>${state.manualErrors}</b> error${state.manualErrors === 1 ? "" : "s"}.</p>
        <p>Tired of dragging? Good — that's Act 1's whole point. Now make a machine do it.</p>
        <button class="btn primary" id="a1-next">🔧 Build the automation →</button>`;
        $("#a1-save").disabled = true; // guard: don't let Save fire again on the last card
        $("#a1-next").addEventListener("click", () => { unlock("act2"); showAct("act2"); });
        return;
    }
    renderManualCard();
}

/* ================= ACT 2 — BUILD ================= */
const usedBlocks = new Set();

function initAct2() {
    const zoneMain = $("#zone-main"), zoneIf = $("#zone-iftrue");

    document.querySelectorAll("#palette .block").forEach(block =>
    makeDraggable(block, (zone, src) => {
        if (!zone) return; // dropped nowhere
        const id = src.dataset.block;
        if (usedBlocks.has(id)) return;
        if (zone.querySelector(`[data-block="${id}"]`)) return;
        const placed = document.createElement("div");
        placed.className = "block placed";
        placed.dataset.block = id;
        placed.innerHTML = src.innerHTML;
        zone.appendChild(placed);
        usedBlocks.add(id);
        src.classList.add("used");
        placed.addEventListener("click", () => {
            placed.remove();
            usedBlocks.delete(id);
            src.classList.remove("used");
            validateFlow();
        });
        validateFlow();
    })
    );

    $("#a2-run").addEventListener("click", () => {
        // remember whether the optional Tag Priority block was included (affects Act 3 log)
        state.tagPriority = usedBlocks.has("tag");
        unlock("act3");
        initAct3();
        showAct("act3");
    });

    validateFlow();
}

function validateFlow() {
    const main = [...$("#zone-main").querySelectorAll(".placed")].map(b => b.dataset.block);
    const ifb  = [...$("#zone-iftrue").querySelectorAll(".placed")].map(b => b.dataset.block);
    const problems = [];
    if (!main.includes("add-crm"))   problems.push("Add <b>Add to CRM</b> to the main path.");
    if (!main.includes("condition")) problems.push("Add the <b>Condition</b> block to the main path.");
    if (!ifb.includes("email"))      problems.push("Put <b>Send welcome email</b> under <i>If TRUE</i>.");
    if (ifb.includes("condition"))   problems.push("The <b>Condition</b> belongs on the main path, not under <i>If TRUE</i>.");
    if (main.includes("email") || main.includes("tag"))
        problems.push("Email/tagging actions belong under <i>If TRUE</i>, not the main path.");
    if (main.includes("archive") || ifb.includes("archive"))
        problems.push("<b>Archive form</b> isn't part of this flow — remove it.");

    const el = $("#a2-validation");
    if (problems.length) {
        el.innerHTML = problems.map(p => `<p class="problem">⚠ ${p}</p>`).join("");
        $("#a2-run").disabled = true;
    } else {
        el.innerHTML = `<p class="ok">✅ Flow looks good${usedBlocks.has("tag") ? " (nice — you even tagged priorities)" : ""}. Run it!</p>`;
        $("#a2-run").disabled = false;
    }
}

/* ================= ACT 3 — RUN ================= */
let currentRunId = 0; // guards against overlapping Act 3 runs (nav back + Run again)
function initAct3() {
    const runId = ++currentRunId;
    if (state.act3TimerId) clearInterval(state.act3TimerId); // stop old run's HUD timer
    state.emailsSent = 0; // reset: re-running Act 3 must not double-count emails
    const queue = Array.from({ length: runBatch }, () => makeSignup());
    const queueStack = $("#queue-stack"), pile = $("#processed-pile"), log = $("#log");
    queueStack.innerHTML = ""; pile.innerHTML = ""; log.innerHTML = "";
    $("#a3-done").textContent = "0"; $("#a3-emails").textContent = "0"; $("#a3-time").textContent = "0s";
    queue.forEach((s, i) => {
        const chip = document.createElement("div");
        chip.className = "q-chip"; chip.dataset.id = i;
        chip.innerHTML = `${s.name} <span class="plan plan-${s.plan}">${s.plan}</span>`;
        queueStack.appendChild(chip);
    });
    $("#queue-count").textContent = `(${queue.length})`;

    const grid = $("#run-grid"), token = $("#token");
    const t0 = Date.now();
    const timerId = state.act3TimerId = setInterval(() => {
        $("#a3-time").textContent = Math.round((Date.now() - t0) / 1000) + "s";
    }, 250);

    function moveToken(targetEl) {
        const g = grid.getBoundingClientRect(), r = targetEl.getBoundingClientRect();
        token.style.left = (r.left - g.left + r.width / 2) + "px";
        token.style.top  = (r.top  - g.top  + r.height / 2) + "px";
        token.classList.remove("hidden");
    }
    function lit(id) {
        const n = $("#node-" + id);
        n.classList.add("lit");
        setTimeout(() => n.classList.remove("lit"), ACT3_STEP_MS * 0.4);
    }
    function logLine(text, premium) {
        const p = document.createElement("div");
        if (premium) p.className = "premium-log";
        p.textContent = text;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
    }

    function step(i) {
        if (runId !== currentRunId) return; // a newer run superseded this one
        if (i >= queue.length) {
            clearInterval(timerId);
            state.botSeconds = Math.round((Date.now() - t0) / 1000);
            setTimeout(showResults, 600);
            return;
        }
        const s = queue[i];
        const chip = queueStack.querySelector(`.q-chip[data-id="${i}"]`);
        chip.classList.add("current");
        lit("trigger"); moveToken($("#node-trigger")); // every item starts at the trigger

        const u = ACT3_STEP_MS; // offsets below keep ~900 ms/item pace
        setTimeout(() => { if (runId !== currentRunId) return; chip.remove(); $("#queue-count").textContent = `(${queue.length - i - 1})`; lit("crm"); moveToken($("#node-crm")); }, u * 0.15);
        setTimeout(() => { if (runId !== currentRunId) return; lit("cond"); moveToken($("#node-cond")); }, u * 0.4);

        if (s.plan === "Premium") {
            setTimeout(() => {
                if (runId !== currentRunId) return;
                lit("email"); moveToken($("#node-email"));
                state.emailsSent++; $("#a3-emails").textContent = state.emailsSent;
            }, u * 0.65);
            setTimeout(() => drop(i, s, `#${String(i+1).padStart(2,"0")} ${s.company} — Premium → CRM ✓ · welcome email ✓${state.tagPriority ? " · tagged priority" : ""}`), u * 0.9);
        } else {
            setTimeout(() => drop(i, s, `#${String(i+1).padStart(2,"0")} ${s.company} — ${s.plan} → CRM ✓`), u * 0.7);
        }

        function drop(idx, signup, text) {
            if (runId !== currentRunId) return;
            moveToken($(".processed-panel h3"));
            const p = document.createElement("div");
            p.className = "p-chip";
            p.innerHTML = `${signup.name} <span class="plan plan-${signup.plan}">${signup.plan}</span>`;
            pile.prepend(p);
            $("#a3-done").textContent = idx + 1;
            logLine(text, signup.plan === "Premium");
            setTimeout(() => step(idx + 1), ACT3_STEP_MS * 0.1);
        }
    }

    setTimeout(() => step(0), 400);
}

/* ================= RESULTS ================= */
function showResults() {
    const mN = manualCards, mT = state.manualSeconds, mE = state.manualErrors;
    const bN = runBatch, bT = state.botSeconds;
    $("#r-manual-n").textContent = mN;
    $("#r-manual-time").textContent = mT + "s";
    $("#r-manual-errors").textContent = mE;
    $("#r-manual-per").textContent = (mT / mN).toFixed(1) + "s/record";
    $("#r-bot-n").textContent = bN;
    $("#r-bot-time").textContent = bT + "s";
    $("#r-bot-per").textContent = (bT / bN).toFixed(1) + "s/record";

    const speedup = bN / mN;
    const projected = Math.round(mT * speedup);
    $("#r-punchline").innerHTML =
    `You did ${mN} records in ${mT}s${mE ? ` with ${mE} mistake${mE === 1 ? "" : "s"}` : ""}.
    The bot did <b>${bN}</b> in <b>${bT}s</b>, error-free.
    At your pace, ${bN} records would take about <b>${projected}s</b> — and you'd get bored.`;

    // unlock results
    const nav = document.getElementById("actnav");
    if (!document.querySelector('.act-tab[data-act="results"]')) {
        const tab = document.createElement("button");
        tab.className = "act-tab"; tab.dataset.act = "results"; tab.textContent = "★ Results";
        nav.appendChild(tab);
        tab.addEventListener("click", () => showAct("results"));
    }
    document.querySelector('.act-tab[data-act="results"]').disabled = false;
    showAct("results");
}

$("#restart").addEventListener("click", () => location.reload());

/* ================= BOOT ================= */
initAct1();
initAct2(); // registers Act 2 drag handlers + Run button — without this, Act 2 is inert
