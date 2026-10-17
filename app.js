(function () {
  "use strict";

  const MAX_PICKS = 10;
  const STORAGE_KEY = "top-matches-2026";
  const CONFIG = window.TOP_MATCHES_CONFIG || {};

  const $ = (id) => document.getElementById(id);
  const els = {
    pickList: $("pick-list"),
    pickCount: $("pick-count"),
    picksEmpty: $("picks-empty"),
    matchList: $("match-list"),
    toast: $("toast"),
    customForm: $("custom-form"),
    submitForm: $("submit-form"),
    submitEmail: $("submit-email"),
    submitBtn: $("submit-btn"),
  };

  // ---------- state ----------

  let state = loadLocal();
  let shared = readShareHash(); // non-null while viewing someone's shared list
  let tourFilter = "all";
  let toastTimer;

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          picks: parsed.picks || [],
          custom: parsed.custom || [],
          email: parsed.email || "",
          submitted: parsed.submitted || null,
        };
      }
    } catch (e) {
      /* storage unavailable or corrupt: start fresh */
    }
    return { picks: [], custom: [], email: "", submitted: null };
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  function allMatches(custom) {
    return window.SEED_MATCHES.concat(custom || state.custom);
  }

  function byId(id, custom) {
    return allMatches(custom).find((m) => m.id === id);
  }

  // ---------- share links ----------

  function encodeShare() {
    const custom = state.custom.filter((m) => state.picks.includes(m.id));
    const json = JSON.stringify({ p: state.picks, c: custom });
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function readShareHash() {
    const m = location.hash.match(/^#list=(.+)$/);
    if (!m) return null;
    try {
      const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(escape(atob(b64)));
      const data = JSON.parse(json);
      const custom = Array.isArray(data.c) ? data.c : [];
      const picks = (Array.isArray(data.p) ? data.p : [])
        .filter((id) => byId(id, custom))
        .slice(0, MAX_PICKS);
      return { picks, custom };
    } catch (e) {
      return null;
    }
  }

  // ---------- rendering ----------

  function render() {
    renderBanner();
    renderPicks();
    renderCatalog();
  }

  function renderBanner() {
    let banner = $("shared-banner");
    if (!shared) {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "shared-banner";
      banner.className = "banner";
      banner.innerHTML =
        '<span>You’re looking at a shared list.</span>' +
        '<button type="button" class="btn btn-primary" data-act="adopt">Make it mine</button>' +
        '<button type="button" class="link-btn" data-act="leave">Back to my list</button>';
      banner.addEventListener("click", (e) => {
        const act = e.target.dataset.act;
        if (act === "adopt") {
          const extra = shared.custom.filter((m) => !state.custom.some((c) => c.id === m.id));
          state.picks = shared.picks.slice();
          state.custom = state.custom.concat(extra);
          saveLocal();
          leaveShared();
          showToast("Saved as your list.");
        } else if (act === "leave") {
          leaveShared();
        }
      });
      document.querySelector(".layout").before(banner);
    }
  }

  function leaveShared() {
    shared = null;
    history.replaceState(null, "", location.pathname + location.search);
    render();
  }

  function view() {
    return shared || state;
  }

  function matchTitle(m) {
    return `${m.winner} d. ${m.loser}`;
  }

  // Surnames keep a top-10 row to one line: "Alcaraz d. Zverev".
  function surname(name) {
    return name.trim().split(/\s+/).pop();
  }

  function shortTitle(m) {
    return `${surname(m.winner)} d. ${surname(m.loser)}`;
  }

  function matchMeta(m) {
    return [m.event, m.round].filter(Boolean).join(" · ");
  }

  const GRIP =
    '<span class="grip" aria-hidden="true"><svg viewBox="0 0 10 16" width="10" height="16">' +
    '<circle cx="2" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="2" cy="8" r="1.5"/>' +
    '<circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg></span>';

  function renderPicks() {
    const v = view();
    const readOnly = !!shared;
    els.pickList.innerHTML = "";
    els.pickCount.textContent = `${v.picks.length} / ${MAX_PICKS}`;
    els.picksEmpty.hidden = v.picks.length > 0;
    document.querySelector(".actions").hidden = readOnly;
    els.submitForm.hidden = readOnly;
    els.submitBtn.disabled = !v.picks.length;
    els.submitBtn.textContent = state.submitted ? "Resubmit" : "Submit";

    v.picks.forEach((id, i) => {
      const m = byId(id, v.custom);
      if (!m) return;
      const li = document.createElement("li");
      li.className = "pick";
      li.dataset.id = id;
      li.innerHTML = `
        ${readOnly ? "" : GRIP}
        <span class="rank">${i + 1}</span>
        <div class="pick-body">
          <div class="pick-line"><span class="title"></span><span class="score"></span></div>
          <div class="meta"></div>
        </div>
        ${
          readOnly
            ? ""
            : `<div class="pick-controls">
            <button type="button" class="icon-btn" data-act="up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="icon-btn" data-act="down" aria-label="Move down" ${i === v.picks.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="icon-btn" data-act="remove" aria-label="Remove">✕</button>
          </div>`
        }`;
      li.querySelector(".title").textContent = shortTitle(m);
      li.querySelector(".title").title = matchTitle(m);
      li.querySelector(".meta").textContent = matchMeta(m);
      li.querySelector(".score").textContent = m.score || "";
      els.pickList.appendChild(li);
    });
  }

  function renderCatalog() {
    const v = view();
    const full = state.picks.length >= MAX_PICKS;
    els.matchList.innerHTML = "";

    const list = allMatches().filter((m) => tourFilter === "all" || m.tour === tourFilter);

    if (!list.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matches found.";
      els.matchList.appendChild(li);
      return;
    }

    list.forEach((m) => {
      const picked = v.picks.includes(m.id);
      const li = document.createElement("li");
      li.className = "match" + (picked ? " picked" : "");
      li.innerHTML = `
        <div class="match-body">
          <div class="title"><span class="tour"></span><span class="names"></span></div>
          <div class="meta"></div>
          <div class="score"></div>
          <p class="note"></p>
        </div>
        <button type="button" class="btn btn-outline add" data-id="${m.id}"></button>`;
      li.querySelector(".tour").textContent = m.tour;
      li.querySelector(".tour").classList.add(m.tour.toLowerCase());
      li.querySelector(".names").textContent = matchTitle(m);
      li.querySelector(".meta").textContent = matchMeta(m);
      li.querySelector(".score").textContent = m.score || "";
      li.querySelector(".note").textContent = m.note || "";
      const btn = li.querySelector(".add");
      if (shared) {
        btn.remove();
      } else if (picked) {
        btn.textContent = "#" + (state.picks.indexOf(m.id) + 1);
        btn.classList.add("ranked");
        btn.setAttribute("aria-label", "Remove from top 10");
        btn.dataset.act = "remove";
      } else {
        btn.textContent = "Add";
        btn.disabled = full;
        btn.title = full ? "Your top 10 is full" : "";
        btn.dataset.act = "add";
      }
      els.matchList.appendChild(li);
    });
  }

  // ---------- actions ----------

  // ---------- motion (FLIP with the Web Animations API, no library) ----------

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Where each pick sits on screen right now, keyed by match id.
  function snapshot() {
    const rects = new Map();
    els.pickList.querySelectorAll(".pick").forEach((li) => rects.set(li.dataset.id, li.getBoundingClientRect()));
    return rects;
  }

  // After a re-render, slide each pick from its old spot to its new one.
  // `liftedId` gets a shadow and rides above the others while it moves.
  function playFlip(before, liftedId) {
    if (reduceMotion.matches) return;
    els.pickList.querySelectorAll(".pick").forEach((li) => {
      const prev = before.get(li.dataset.id);
      if (!prev) {
        li.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], {
          duration: 220,
          easing: "ease-out",
        });
        return;
      }
      const now = li.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (!dx && !dy) return;
      const lifted = li.dataset.id === liftedId;
      const from = { transform: `translate(${dx}px, ${dy}px)` };
      const to = { transform: "none" };
      if (lifted) {
        from.boxShadow = to.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.16)";
        li.style.zIndex = "2";
      }
      const anim = li.animate([from, to], { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      if (lifted) anim.onfinish = anim.oncancel = () => (li.style.zIndex = "");
    });
  }

  function commit(before, liftedId) {
    const rects = before || snapshot();
    saveLocal();
    render();
    playFlip(rects, liftedId);
  }

  function addPick(id) {
    if (state.picks.includes(id) || state.picks.length >= MAX_PICKS) return;
    state.picks.push(id);
    commit();
  }

  function removePick(id) {
    state.picks = state.picks.filter((p) => p !== id);
    commit();
  }

  function movePick(from, to, before) {
    if (to < 0 || to >= state.picks.length) return;
    const [id] = state.picks.splice(from, 1);
    state.picks.splice(to, 0, id);
    commit(before, id);
  }

  function showToast(msg, opts) {
    const o = opts || {};
    els.toast.textContent = msg;
    els.toast.classList.toggle("error", !!o.error);
    clearTimeout(toastTimer);
    if (!o.sticky) toastTimer = setTimeout(() => (els.toast.textContent = ""), 3000);
  }

  async function copy(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch (e) {
      window.prompt("Copy this:", text);
    }
  }

  // ---------- events ----------

  els.matchList.addEventListener("click", (e) => {
    const btn = e.target.closest("button.add");
    if (!btn) return;
    if (btn.dataset.act === "add") addPick(btn.dataset.id);
    else removePick(btn.dataset.id);
  });

  els.pickList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".pick").dataset.id;
    const i = state.picks.indexOf(id);
    if (btn.dataset.act === "up") movePick(i, i - 1);
    else if (btn.dataset.act === "down") movePick(i, i + 1);
    else if (btn.dataset.act === "remove") removePick(id);
  });

  // Drag to reorder. Pointer events rather than native drag-and-drop, so the
  // dragged card can be styled and it works with touch. Mouse drags from
  // anywhere on a row; touch drags from the grip so the page still scrolls.
  let drag = null;

  els.pickList.addEventListener("pointerdown", (e) => {
    if (shared || e.button !== 0 || e.target.closest("button")) return;
    const li = e.target.closest(".pick");
    if (!li) return;
    const onGrip = !!e.target.closest(".grip");
    if (e.pointerType !== "mouse" && !onGrip) return;
    e.preventDefault(); // no text selection while dragging
    drag = { li, id: li.dataset.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  });

  function startDrag(e) {
    const li = drag.li;
    const r = li.getBoundingClientRect();
    drag.items = Array.from(els.pickList.querySelectorAll(".pick"));
    drag.from = drag.items.indexOf(li);
    // Row midpoints in page coordinates, measured once so the opening gap
    // doesn't move the targets out from under the pointer.
    drag.mids = drag.items.map((n) => {
      const b = n.getBoundingClientRect();
      return b.top + window.scrollY + b.height / 2;
    });
    drag.offsetY = e.clientY - r.top;
    drag.slot = null;

    const clone = li.cloneNode(true);
    clone.classList.add("drag-clone");
    clone.style.width = r.width + "px";
    clone.style.left = r.left + "px";
    clone.style.top = r.top + "px";
    document.body.appendChild(clone);
    drag.clone = clone;

    li.classList.add("drag-source");
    document.body.classList.add("is-dragging");
    drag.active = true;
    placeLine();
  }

  // Keep the drop line centred in the opening gap (it moves while the gap
  // animates open, so track it every frame).
  function placeLine() {
    if (!drag || !drag.active) return;
    if (drag.slot === null) {
      if (drag.line) drag.line = (drag.line.remove(), null);
    } else {
      if (!drag.line) {
        drag.line = document.createElement("div");
        drag.line.className = "drop-line";
        document.body.appendChild(drag.line);
      }
      const n = drag.items.length;
      const listRect = els.pickList.getBoundingClientRect();
      const y =
        drag.slot < n
          ? drag.items[drag.slot].getBoundingClientRect().top - 8
          : drag.items[n - 1].getBoundingClientRect().bottom + 8;
      drag.line.style.top = y + "px";
      drag.line.style.left = listRect.left + 8 + "px";
      drag.line.style.width = listRect.width - 16 + "px";
    }
    requestAnimationFrame(placeLine);
  }

  function setSlot(slot) {
    // Dropping right where it started is a no-op, so show no gap there.
    if (slot === drag.from || slot === drag.from + 1) slot = null;
    if (slot === drag.slot) return;
    drag.slot = slot;
    drag.items.forEach((n) => n.classList.remove("gap-before", "gap-after"));
    // The floating copy shows the rank it would land at.
    const to = slot === null ? drag.from : slot > drag.from ? slot - 1 : slot;
    drag.clone.querySelector(".rank").textContent = to + 1;
    if (slot === null) return;
    if (slot < drag.items.length) drag.items[slot].classList.add("gap-before");
    else drag.items[drag.items.length - 1].classList.add("gap-after");
  }

  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      startDrag(e);
    }
    drag.clone.style.top = e.clientY - drag.offsetY + "px";
    const y = e.clientY + window.scrollY;
    setSlot(drag.mids.filter((m) => m < y).length);
    if (e.clientY < 60) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
  });

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    // The dropped card animates from wherever the floating copy was let go.
    const before = snapshot();
    before.set(d.id, d.clone.getBoundingClientRect());
    d.clone.remove();
    if (d.line) d.line.remove();
    document.body.classList.remove("is-dragging");
    const to = cancelled || d.slot === null ? d.from : d.slot > d.from ? d.slot - 1 : d.slot;
    movePick(d.from, to, before);
  }

  window.addEventListener("pointerup", (e) => endDrag(e, false));
  window.addEventListener("pointercancel", (e) => endDrag(e, true));


  document.querySelector(".tour-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tour]");
    if (!btn) return;
    tourFilter = btn.dataset.tour;
    document.querySelectorAll(".tour-tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    renderCatalog();
  });

  $("share-btn").addEventListener("click", () => {
    if (!state.picks.length) return showToast("Pick some matches first.");
    const url = location.origin + location.pathname + "#list=" + encodeShare();
    copy(url, "Share link copied.");
  });

  $("clear-btn").addEventListener("click", () => {
    if (!state.picks.length) return;
    if (!confirm("Clear your top 10?")) return;
    state.picks = [];
    commit();
  });

  els.customForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(els.customForm);
    const m = {
      id: "custom-" + Date.now().toString(36),
      tour: f.get("tour"),
      event: f.get("event").trim(),
      round: f.get("round").trim(),
      winner: f.get("winner").trim(),
      loser: f.get("loser").trim(),
      score: f.get("score").trim(),
      note: "Added by you.",
    };
    state.custom.push(m);
    if (state.picks.length < MAX_PICKS) state.picks.push(m.id);
    els.customForm.reset();
    commit();
    showToast(state.picks.includes(m.id) ? "Added to your top 10." : "Added to the list.");
  });

  // ---------- submit ----------

  els.submitEmail.value = state.email;
  els.submitEmail.addEventListener("input", () => {
    state.email = els.submitEmail.value;
    saveLocal();
  });

  els.submitForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.picks.length) return showToast("Pick some matches first.", { error: true });
    if (!CONFIG.submitUrl) {
      return showToast("Submissions aren\u2019t switched on yet.", { error: true, sticky: true });
    }

    const payload = {
      email: els.submitEmail.value.trim().toLowerCase(),
      picks: state.picks.map((id, i) => {
        const m = byId(id);
        return {
          rank: i + 1,
          id: m.id,
          tour: m.tour,
          event: m.event,
          round: m.round,
          winner: m.winner,
          loser: m.loser,
          score: m.score,
        };
      }),
    };

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Sending\u2026";
    try {
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
      const res = await fetch(CONFIG.submitUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "HTTP " + res.status);
      state.submitted = new Date().toISOString();
      saveLocal();
      showToast(
        data.updated ? "Updated your submitted list." : "Submitted! You can resubmit any time to update it.",
        { sticky: true }
      );
    } catch (err) {
      showToast("Couldn\u2019t submit right now. Please try again.", { error: true, sticky: true });
    } finally {
      render();
    }
  });

  window.addEventListener("hashchange", () => {
    shared = readShareHash();
    render();
  });

  render();
})();
