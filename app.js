(function () {
  "use strict";

  const MAX_PICKS = 10;
  const STORAGE_KEY = "top-matches-2026";

  const $ = (id) => document.getElementById(id);
  const els = {
    pickList: $("pick-list"),
    pickCount: $("pick-count"),
    picksEmpty: $("picks-empty"),
    matchList: $("match-list"),
    search: $("search"),
    toast: $("toast"),
    customForm: $("custom-form"),
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
        return { picks: parsed.picks || [], custom: parsed.custom || [] };
      }
    } catch (e) {
      /* storage unavailable or corrupt: start fresh */
    }
    return { picks: [], custom: [] };
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
        '<button type="button" data-act="adopt">Make it mine</button>' +
        '<button type="button" class="ghost" data-act="leave">Back to my list</button>';
      banner.addEventListener("click", (e) => {
        const act = e.target.dataset.act;
        if (act === "adopt") {
          const extra = shared.custom.filter((m) => !state.custom.some((c) => c.id === m.id));
          state = { picks: shared.picks.slice(), custom: state.custom.concat(extra) };
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

  function matchMeta(m) {
    return [m.event, m.round, m.month].filter(Boolean).join(" · ");
  }

  function renderPicks() {
    const v = view();
    const readOnly = !!shared;
    els.pickList.innerHTML = "";
    els.pickCount.textContent = `${v.picks.length} / ${MAX_PICKS}`;
    els.picksEmpty.hidden = v.picks.length > 0;
    document.querySelector(".actions").hidden = readOnly;

    v.picks.forEach((id, i) => {
      const m = byId(id, v.custom);
      if (!m) return;
      const li = document.createElement("li");
      li.className = "pick";
      li.dataset.id = id;
      li.draggable = !readOnly;
      li.innerHTML = `
        <span class="rank">${i + 1}</span>
        <div class="pick-body">
          <div class="title"></div>
          <div class="meta"></div>
          <div class="score"></div>
        </div>
        ${
          readOnly
            ? ""
            : `<div class="pick-controls">
            <button type="button" class="icon" data-act="up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="icon" data-act="down" aria-label="Move down" ${i === v.picks.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="icon" data-act="remove" aria-label="Remove">✕</button>
          </div>`
        }`;
      li.querySelector(".title").textContent = matchTitle(m);
      li.querySelector(".meta").textContent = matchMeta(m);
      li.querySelector(".score").textContent = m.score || "";
      els.pickList.appendChild(li);
    });
  }

  function renderCatalog() {
    const q = els.search.value.trim().toLowerCase();
    const v = view();
    const full = state.picks.length >= MAX_PICKS;
    els.matchList.innerHTML = "";

    const list = allMatches().filter((m) => {
      if (tourFilter !== "all" && m.tour !== tourFilter) return false;
      if (!q) return true;
      return [m.winner, m.loser, m.event, m.round, m.note].join(" ").toLowerCase().includes(q);
    });

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
        <button type="button" class="add" data-id="${m.id}"></button>`;
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

  function commit() {
    saveLocal();
    render();
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

  function movePick(from, to) {
    if (to < 0 || to >= state.picks.length || from === to) return;
    const [id] = state.picks.splice(from, 1);
    state.picks.splice(to, 0, id);
    commit();
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (els.toast.textContent = ""), 2500);
  }

  async function copy(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch (e) {
      window.prompt("Copy this:", text);
    }
  }

  function asText() {
    const lines = state.picks.map((id, i) => {
      const m = byId(id);
      return `${i + 1}. ${matchTitle(m)} ${m.score ? m.score + " " : ""}(${matchMeta(m)})`;
    });
    return ["My top tennis matches of 2026", ...lines].join("\n");
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

  // Drag to reorder
  let dragId = null;
  els.pickList.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".pick");
    if (!li) return;
    dragId = li.dataset.id;
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  els.pickList.addEventListener("dragover", (e) => {
    if (!dragId) return;
    e.preventDefault();
    const over = e.target.closest(".pick");
    els.pickList.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    if (over && over.dataset.id !== dragId) over.classList.add("drop-target");
  });
  els.pickList.addEventListener("drop", (e) => {
    e.preventDefault();
    const over = e.target.closest(".pick");
    if (dragId && over) movePick(state.picks.indexOf(dragId), state.picks.indexOf(over.dataset.id));
  });
  els.pickList.addEventListener("dragend", () => {
    dragId = null;
    render();
  });

  els.search.addEventListener("input", renderCatalog);

  document.querySelector(".segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tour]");
    if (!btn) return;
    tourFilter = btn.dataset.tour;
    document.querySelectorAll(".segmented button").forEach((b) => b.classList.toggle("active", b === btn));
    renderCatalog();
  });

  $("share-btn").addEventListener("click", () => {
    if (!state.picks.length) return showToast("Pick some matches first.");
    const url = location.origin + location.pathname + "#list=" + encodeShare();
    copy(url, "Share link copied.");
  });

  $("copy-text-btn").addEventListener("click", () => {
    if (!state.picks.length) return showToast("Pick some matches first.");
    copy(asText(), "List copied.");
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
      month: "",
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

  window.addEventListener("hashchange", () => {
    shared = readShareHash();
    render();
  });

  render();
})();
