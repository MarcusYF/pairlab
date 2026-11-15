/* PairDeck review overlay: comment on a slide, or ask about it, by dragging a box over it.
   `pairdeck review` injects this into the pages it serves; it is never written into the deck.
   Comments and questions go to POST /__pairdeck/comments (kind "change" or "question"); replies and answers written by
   `pairdeck resolve` come back through GET /__pairdeck/state. */
(function () {
  "use strict";
  var CFG = window.PAIRDECK || {};
  var UNIT = CFG.unit === "poster" ? "poster" : "slide", TOOL = CFG.tool || "PairDeck", CLI = CFG.cli || "pairdeck";
  var API = "/__pairdeck/";
  var POLL_MS = 2500, MIN_DRAG = 8;
  var comments = [], sig = null, isOpen = false, marking = null, draft = null, shownId = null, tab = "slide", busy = false;
  var panel, fabs, fab, askBtn, countBtn, layer, list, compose, area, where, msg, sendBtn, toastEl, toastTimer;
  var seen = null; // replies already shown, per comment id: an answer that arrives later gets a notice
  var SEEN_KEY = "pd-seen:" + (CFG.slug || location.pathname), WIDE_KEY = "pd-wide";
  var PLACEHOLDER = {
    change: "What should change? For example: too many words; make the second bar teal.",
    question: "What do you want to know? For example: where does this number come from? Why this baseline?"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  /* Replies and answers in light Markdown: paragraphs, - and 1. lists, **bold**, *italic*, `code`, [links](https://...).
     The text is escaped first, so nothing in it can add markup of its own. */
  function inline(t) {
    return t.replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    var out = [], para = [], lst = null;
    function endPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    function endList() {
      if (!lst) return;
      out.push("<" + lst.tag + ">" + lst.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + lst.tag + ">");
      lst = null;
    }
    esc(src).split(/\r?\n/).forEach(function (ln) {
      var m = /^\s*(?:[-*\u2022]|(\d+)[.)])\s+(.*)$/.exec(ln);
      if (m) {
        endPara();
        var tag = m[1] ? "ol" : "ul";
        if (!lst || lst.tag !== tag) { endList(); lst = { tag: tag, items: [] }; }
        lst.items.push(m[2]);
      } else if (!ln.trim()) { endPara(); endList(); }
      else if (lst && /^\s{2,}/.test(ln)) { lst.items[lst.items.length - 1] += " " + ln.trim(); }
      else { endList(); para.push(ln.trim()); }
    });
    endPara(); endList();
    return out.join("");
  }
  function store(kind) { try { return window[kind]; } catch (_) { return null; } }
  function allSlides() { return Array.prototype.slice.call(document.querySelectorAll(".dk-slide")); }
  function deckEl() { return $(".dk-deck") || document.body; }
  function distinct(nodes) {
    var seen = {};
    Array.prototype.forEach.call(nodes, function (e) { seen[e.getAttribute("data-step")] = 1; });
    return Object.keys(seen).length;
  }
  function here() {
    var slides = allSlides(), i = window.Deck ? window.Deck.index : 0, s = slides[i] || null;
    var h = s && s.querySelector(".dk-h");
    return {
      slide: i + 1, el: s,
      step: s ? distinct(s.querySelectorAll("[data-step].is-on")) : 0,
      steps: s ? distinct(s.querySelectorAll("[data-step]")) : 0,
      label: s ? (s.getAttribute("data-label") || "") : "",
      title: h ? h.textContent.replace(/\s+/g, " ").trim() : "",
      id: s ? (s.id || "") : ""
    };
  }
  /* Boxes are stored as fractions of the slide's content block (.dk-inner), so they land on the same content at any
     window size; without the engine, of the deck area. */
  function frame(slideEl) {
    var inner = slideEl && slideEl.querySelector(".dk-inner");
    return (inner || deckEl()).getBoundingClientRect();
  }
  /* A box is also stored relative to the smallest block under its centre (a figure, the headline, the takeaway...), so it
     lands on the same marks when the layout reflows (a narrower window, a phone, the panel opening). */
  var ANCHORS = CFG.anchors || ".dk-fig, .dk-h, .dk-take, .dk-note, .dk-list, .dk-ctl, .dk-cols, .dk-sub";
  function anchorFor(slideEl, r) {
    if (!slideEl) return null;
    var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, best = null;
    slideEl.querySelectorAll(ANCHORS).forEach(function (el, i) {
      var b = el.getBoundingClientRect();
      if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom || !b.width || !b.height) return;
      if (!best || b.width * b.height < best.area) best = { i: i, area: b.width * b.height, b: b };
    });
    if (!best) return null;
    var B = best.b;
    return { i: best.i, x: (r.left - B.left) / B.width, y: (r.top - B.top) / B.height, w: (r.right - r.left) / B.width,
             h: (r.bottom - r.top) / B.height };
  }
  function boxRect(c, slideEl) {
    var a = c.anchor, els = slideEl ? slideEl.querySelectorAll(ANCHORS) : [];
    if (a && els[a.i]) {
      var B = els[a.i].getBoundingClientRect();
      if (B.width && B.height) return { left: B.left + a.x * B.width, top: B.top + a.y * B.height, width: a.w * B.width, height: a.h * B.height };
    }
    var F = frame(slideEl);
    return { left: F.left + c.box.x * F.width, top: F.top + c.box.y * F.height, width: c.box.w * F.width, height: c.box.h * F.height };
  }
  function when(t) {
    var d = new Date(t);
    if (isNaN(d)) return "";
    var same = d.toDateString() === new Date().toDateString();
    return same ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function shownInSlide(el, stop) {
    for (var e = el; e && e !== stop; e = e.parentNode) {
      if (e.nodeType !== 1) continue;
      var cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }
  /* The words under a box, so the agent knows what it covers even if the layout moves. */
  function textUnder(slideEl, r) {
    if (!slideEl) return "";
    var out = [], seen = {};
    slideEl.querySelectorAll("text, h1, h2, h3, p, li, td, th, figcaption, button, label, .pp-t, .pp-n, .pp-k, .pp-lead").forEach(function (el) {
      if (!shownInSlide(el, slideEl)) return;
      if (el.tagName.toLowerCase() !== "text" && el.closest("svg")) return;
      var b = el.getBoundingClientRect(), cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return;
      var t = el.textContent.replace(/\s+/g, " ").trim();
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    var s = out.join(" · ");
    return s.length > 300 ? s.slice(0, 298) + "…" : s;
  }

  /* The named part of the page under a box (the smallest element with a data-label, other than the slide itself):
     on a poster, the block a comment is about. */
  function blockUnder(slideEl, r) {
    if (!slideEl) return "";
    var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, best = null;
    slideEl.querySelectorAll("[data-label]").forEach(function (el) {
      var b = el.getBoundingClientRect();
      if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom || !b.width || !b.height) return;
      if (!best || b.width * b.height < best.area) best = { area: b.width * b.height, label: el.getAttribute("data-label") };
    });
    return best ? best.label : "";
  }

  // ------------------------------------------------------------------ building the UI

  function build() {
    fabs = document.createElement("div");
    fabs.className = "pd-fabs";
    askBtn = document.createElement("button");
    askBtn.type = "button";
    askBtn.className = "pd-fab pd-ask";
    askBtn.title = "Ask about a part of this " + UNIT + " (q)";
    askBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><path d="M12 17.2h.01"/></svg><span>Ask</span>';
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "pd-fab";
    fab.title = "Comment on this " + UNIT + ": say what should change (c)";
    fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-5 4v-4.3A2.5 2.5 0 0 1 4 13.5z"/><path d="M12 6.5v6M9 9.5h6"/></svg><span>Comment</span>';
    fabs.append(askBtn, fab);
    countBtn = document.createElement("button");
    countBtn.type = "button";
    countBtn.className = "pd-count";
    countBtn.title = "Show comments";
    panel = document.createElement("aside");
    panel.className = "pd-panel";
    panel.setAttribute("aria-label", "Comments");
    panel.innerHTML =
      '<header class="pd-head"><b>Comments</b><span class="pd-tabs" role="group" aria-label="Which comments">' +
      '<button type="button" data-tab="slide">This slide</button><button type="button" data-tab="all">All</button></span>' +
      '<button type="button" class="pd-wide" aria-pressed="false" title="Wider panel, for long answers">⇔</button>' +
      '<button type="button" class="pd-x" aria-label="Close comments">×</button></header>' +
      '<div class="pd-compose" hidden><div class="pd-kind" role="group" aria-label="Comment or question">' +
      '<button type="button" data-kind="change">Change it</button><button type="button" data-kind="question">Ask about it</button></div>' +
      '<div class="pd-where"></div>' +
      '<textarea rows="4"></textarea>' +
      '<div class="pd-row"><button type="button" class="pd-send">Send</button><button type="button" class="pd-cancel">Cancel</button>' +
      '<button type="button" class="pd-redraw">Redraw box</button></div><div class="pd-msg" aria-live="polite"></div></div>' +
      '<div class="pd-list"></div>' +
      '<footer class="pd-foot">' + esc(CFG.agent || "The agent") + ' reads these through ' + esc(TOOL) + '. A comment changes the ' +
      UNIT + '; a question gets an answer here. Keys: c comment, q ask, Esc cancel, ⌘ or Ctrl + Enter send.</footer>';
    toastEl = document.createElement("div");
    toastEl.className = "pd-toast";
    toastEl.setAttribute("role", "status");
    toastEl.hidden = true;
    layer = document.createElement("div");
    layer.className = "pd-layer";
    document.body.append(layer, fabs, countBtn, panel, toastEl);
    list = $(".pd-list", panel);
    compose = $(".pd-compose", panel);
    area = $("textarea", panel);
    where = $(".pd-where", panel);
    msg = $(".pd-msg", panel);
    sendBtn = $(".pd-send", panel);
    try { if (store("localStorage") && localStorage.getItem(WIDE_KEY) === "1") document.body.classList.add("pd-wider"); } catch (_) {}

    fab.addEventListener("click", function () { startMark(null, "change"); });
    askBtn.addEventListener("click", function () { startMark(null, "question"); });
    $(".pd-wide", panel).addEventListener("click", function () {
      var on = document.body.classList.toggle("pd-wider");
      try { localStorage.setItem(WIDE_KEY, on ? "1" : "0"); } catch (_) {}
      window.dispatchEvent(new Event("resize"));
      render();
    });
    panel.querySelectorAll("[data-kind]").forEach(function (b) {
      b.addEventListener("click", function () { if (draft) { draft.kind = b.getAttribute("data-kind"); showKind(); drawBoxes(); area.focus(); } });
    });
    toastEl.addEventListener("click", function (e) {
      var id = toastEl.getAttribute("data-id");
      hideToast();
      var c = comments.filter(function (x) { return x.id === id; })[0];
      if (!c || e.target.closest("[data-act=close]")) return;
      shownId = c.id; tab = "slide"; goTo(c); setOpen(true);
      setTimeout(function () { var it = list.querySelector('[data-id="' + c.id + '"]'); if (it) it.scrollIntoView({ block: "nearest" }); }, 120);
    });
    countBtn.addEventListener("click", function () { setOpen(!isOpen); });
    $(".pd-x", panel).addEventListener("click", function () { setOpen(false); });
    $(".pd-send", panel).addEventListener("click", send);
    $(".pd-cancel", panel).addEventListener("click", cancelDraft);
    $(".pd-redraw", panel).addEventListener("click", function () { startMark(draft && draft.parent, draft ? draft.kind : "change"); });
    panel.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); render(); });
    });
    area.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
      if (e.key === "Escape") { e.preventDefault(); cancelDraft(); }
    });
    // Keys inside the panel (Enter or Space on a button) must not also step the deck.
    panel.addEventListener("keydown", function (e) { e.stopPropagation(); });
    list.addEventListener("click", onListClick);
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape" && marking) { e.preventDefault(); endMark(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); startMark(null, "change"); }
      if (e.key === "q" || e.key === "Q") { e.preventDefault(); startMark(null, "question"); }
    });
    window.addEventListener("resize", drawBoxes);
    document.addEventListener("scroll", drawBoxes, true); // a tall slide scrolls: boxes follow its content
    if (window.Deck && window.Deck.on) window.Deck.on("step", function () { render(); });
  }

  function setOpen(v) {
    isOpen = v;
    document.body.classList.toggle("pd-open", v);
    panel.classList.toggle("is-open", v);
    window.dispatchEvent(new Event("resize")); // the engine refits figures to the narrower deck
    render();
  }

  // ------------------------------------------------------------------ marking a box

  function startMark(parent, kind) {
    if (marking) return;
    kind = kind === "question" ? "question" : "change";
    if (!isOpen) setOpen(true);
    var ov = document.createElement("div");
    ov.className = "pd-mark" + (kind === "question" ? " q" : "");
    ov.innerHTML = '<div class="pd-mhint">' + (kind === "question" ? "Drag a box over what you are asking about"
      : "Drag a box over what you mean") + ' · click for the whole ' + UNIT + ' · Esc cancels</div>';
    var R = deckEl().getBoundingClientRect();
    ov.style.left = R.left + "px"; ov.style.top = R.top + "px"; ov.style.width = R.width + "px"; ov.style.height = R.height + "px";
    document.body.append(ov);
    marking = { ov: ov, box: null, x0: 0, y0: 0, down: false, parent: parent, kind: kind };
    clearBoxes();
    ov.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      try { ov.setPointerCapture(e.pointerId); } catch (_) {}
      marking.down = true; marking.x0 = e.clientX; marking.y0 = e.clientY;
      marking.box = document.createElement("div");
      marking.box.className = "pd-box draft" + (marking.kind === "question" ? " q" : "");
      layer.append(marking.box);
      size(e);
    });
    ov.addEventListener("pointermove", function (e) { if (marking && marking.down) size(e); });
    ov.addEventListener("pointerup", function (e) {
      if (!marking || !marking.down) return;
      marking.down = false;
      var r = size(e), h = here(), F = frame(h.el), box = null, anchor = null, under = "", block = "";
      if (r.w >= MIN_DRAG && r.h >= MIN_DRAG) {
        var sr = { left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h };
        box = { x: (r.x - F.left) / F.width, y: (r.y - F.top) / F.height, w: r.w / F.width, h: r.h / F.height };
        anchor = anchorFor(h.el, sr);
        under = textUnder(h.el, sr);
        block = blockUnder(h.el, sr);
      }
      var parent = marking.parent, kind = marking.kind;
      endMark();
      openDraft(h, box, under, parent, anchor, block, kind);
    });
    ov.addEventListener("click", function (e) { e.stopPropagation(); });
  }
  function size(e) {
    var x = Math.min(marking.x0, e.clientX), y = Math.min(marking.y0, e.clientY);
    var r = { x: x, y: y, w: Math.abs(e.clientX - marking.x0), h: Math.abs(e.clientY - marking.y0) };
    var s = marking.box.style;
    s.left = r.x + "px"; s.top = r.y + "px"; s.width = r.w + "px"; s.height = r.h + "px";
    return r;
  }
  function endMark() {
    if (!marking) return;
    if (marking.box) marking.box.remove();
    marking.ov.remove();
    marking = null;
    drawBoxes();
  }

  // ------------------------------------------------------------------ the draft

  function openDraft(h, box, under, parent, anchor, block, kind, text) {
    var keep = text != null ? text : draft ? area.value : "";
    draft = { slide: h.slide, slide_id: h.id, label: h.label, title: h.title, step: h.step, steps: h.steps, box: box,
              anchor: anchor || null, under: under, block: block || "", parent: parent || null,
              kind: kind === "question" ? "question" : "change", viewport: [window.innerWidth, window.innerHeight] };
    compose.hidden = false;
    var place = UNIT === "poster" ? (block ? "<b>" + esc(block) + "</b>" : "the poster")
      : "slide " + h.slide + (h.steps ? ", step " + h.step + " of " + h.steps : "");
    where.innerHTML = (parent ? "Follow-up to <b>" + esc(parent) + "</b> · " : "") + place +
      " · " + (box ? "the box" : "the whole " + UNIT) +
      (under ? '<span class="pd-under">' + esc(under) + "</span>" : "");
    area.value = keep;
    msg.textContent = "";
    showKind();
    render();
    area.focus();
    if (keep) area.setSelectionRange(keep.length, keep.length);
  }
  function showKind() {
    var q = draft && draft.kind === "question";
    compose.classList.toggle("q", q);
    panel.querySelectorAll("[data-kind]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-kind") === (q ? "question" : "change")));
    });
    area.placeholder = PLACEHOLDER[q ? "question" : "change"];
    sendBtn.textContent = q ? "Ask" : "Send";
  }
  function cancelDraft() {
    draft = null;
    compose.hidden = true;
    area.value = "";
    msg.textContent = "";
    render();
  }
  function send() {
    if (!draft || busy) return;
    var text = area.value.trim();
    if (!text) { msg.textContent = draft.kind === "question" ? "Type the question first." : "Type the comment first."; area.focus(); return; }
    busy = true;
    msg.textContent = "Sending…";
    var body = Object.assign({}, draft, { text: text });
    fetch(API + "comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (rec) {
        draft = null;
        compose.hidden = true;
        area.value = "";
        msg.textContent = "";
        shownId = rec.id;
        if (seen) seen[rec.id] = 0;
        return poll();
      })
      .catch(function (e) { msg.textContent = "Not sent: " + e.message + ". Is `" + CLI + " review` still running?"; })
      .then(function () { busy = false; });
  }

  // ------------------------------------------------------------------ the list and the boxes

  function isQ(c) { return c && c.kind === "question"; }
  function statusChip(c) {
    var cls = { "waiting": "st-wait", "with the agent": "st-agent", "answered": "st-done", "kept": "st-kept" }[c.status] || "";
    var label = isQ(c) ? ({ "waiting": "sent", "with the agent": "answering…", "kept": "done" }[c.status] || c.status) : c.status;
    return '<span class="pd-chip ' + cls + '">' + esc(label) + "</span>";
  }
  function itemHTML(c) {
    var q = isQ(c);
    var replies = (c.replies || []).map(function (r) {
      return '<div class="pd-reply"><div class="pd-who">' + esc(r.agent || CFG.agent || "Agent") + "</div>" + md(r.text) + "</div>";
    }).join("");
    var acts = "";
    if (c.replies && c.replies.length) {
      acts = q
        ? '<div class="pd-actions"><button type="button" data-act="askmore">Ask more</button>' +
          '<button type="button" data-act="promote" title="Turn this answer into a change to the ' + UNIT + '">Put it in the ' + UNIT + '</button>' +
          (c.kept ? "" : '<button type="button" data-act="keep" title="The question is settled">Done</button>') + "</div>"
        : '<div class="pd-actions">' + (c.kept ? "" : '<button type="button" data-act="keep" title="Accept the change as made">Keep</button>') +
          '<button type="button" data-act="follow">Follow up</button></div>';
    }
    return '<article class="pd-item' + (q ? " is-q" : "") + (c.id === shownId ? " is-shown" : "") + '" data-id="' + esc(c.id) + '">' +
      '<div class="pd-meta"><b>' + esc(c.id) + "</b> · " + (q ? '<span class="pd-kindtag">question</span> · ' : "") +
      (UNIT === "poster" ? esc(c.block || "poster") : "slide " + c.slide + (c.steps ? "." + c.step : "")) +
      (c.parent ? " · re " + esc(c.parent) : "") + " · " + esc(when(c.time)) + " " + statusChip(c) + "</div>" +
      '<div class="pd-text"><b>' + esc(c.author || CFG.author || "You") + (q ? " asks" : "") + ":</b> " + esc(c.text) + "</div>" +
      replies + acts + "</article>";
  }
  function render() {
    if (!panel) return;
    var h = here();
    var mine = comments.filter(function (c) { return c.slide === h.slide; });
    var rows = tab === "all" ? comments : mine;
    panel.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tab") === tab)); });
    $("[data-tab=slide]", panel).textContent = "This " + UNIT + " (" + mine.length + ")";
    $(".pd-tabs", panel).hidden = allSlides().length <= 1;  // one page (a poster): "this slide" and "all" are the same
    $("[data-tab=all]", panel).textContent = "All (" + comments.length + ")";
    list.innerHTML = rows.length ? rows.slice().reverse().map(itemHTML).join("")
      : '<p class="pd-empty">' + (tab === "all" ? "No comments yet." : "No comments on this " + UNIT + " yet.") +
        " Press <b>Comment</b> to change something, or <b>Ask</b> to ask about it; drag a box over what you mean, and type.</p>";
    var open = comments.filter(function (c) { return c.status !== "answered" && c.status !== "kept"; }).length;
    countBtn.textContent = comments.length ? comments.length + (open ? " · " + open + " open" : "") : "0";
    countBtn.hidden = !comments.length && !isOpen;
    $(".pd-wide", panel).setAttribute("aria-pressed", String(document.body.classList.contains("pd-wider")));
    drawBoxes();
  }
  function clearBoxes() { layer.querySelectorAll(".pd-box:not(.draft)").forEach(function (b) { b.remove(); }); }
  function putBox(c, cls, label) {
    var h = here();
    if (!c.box || c.slide !== h.slide) return;
    var R = boxRect(c, h.el), b = document.createElement("div");
    b.className = "pd-box " + cls + (isQ(c) ? " q" : "");
    b.style.left = R.left + "px";
    b.style.top = R.top + "px";
    b.style.width = R.width + "px";
    b.style.height = R.height + "px";
    if (label) { var t = document.createElement("span"); t.textContent = label; b.append(t); }
    layer.append(b);
  }
  function drawBoxes() {
    if (!layer) return;
    clearBoxes();
    if (!isOpen || marking) return;
    var h = here();
    comments.forEach(function (c) {
      // A comment the author accepted (Keep) is settled: its box leaves the slide, and comes back only while
      // the author has that comment selected in the list.
      if (c.status === "kept" && c.id !== shownId) return;
      if (c.slide === h.slide && c.box) putBox(c, c.id === shownId ? "shown" : "faint", c.id + (isQ(c) ? " ?" : ""));
    });
    if (draft && draft.box && draft.slide === h.slide) putBox(draft, "pending", isQ(draft) ? "new ?" : "new");
  }
  function goTo(c) {
    var h = here();
    if (window.Deck && (h.slide !== c.slide || h.step !== (c.step || 0))) {
      window.Deck.go(c.slide - 1);
      for (var k = 0; k < (c.step || 0); k++) window.Deck.next();
    }
    var s = allSlides()[c.slide - 1], els = s ? s.querySelectorAll(ANCHORS) : [];
    if (c.anchor && els[c.anchor.i] && els[c.anchor.i].scrollIntoView) els[c.anchor.i].scrollIntoView({ block: "nearest" });
  }
  function onListClick(e) {
    var item = e.target.closest(".pd-item");
    if (!item) return;
    var c = comments.filter(function (x) { return x.id === item.getAttribute("data-id"); })[0];
    if (!c) return;
    var act = e.target.closest("[data-act]");
    if (act && act.getAttribute("data-act") === "keep") {
      fetch(API + "keep", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) })
        .then(poll);
      return;
    }
    shownId = c.id;
    goTo(c);
    var a = act && act.getAttribute("data-act");
    if (a === "follow" || a === "askmore" || a === "promote") {
      var h = here();
      openDraft(h, c.box, c.under || "", c.id, c.anchor, c.block, a === "askmore" ? "question" : "change",
                a === "promote" ? "Put the answer to " + c.id + " on this " + UNIT + "." : null);
      return;
    }
    setTimeout(render, 80);
  }

  // ------------------------------------------------------------------ polling and reloads

  function loadSeen() {
    try { var v = store("sessionStorage") && sessionStorage.getItem(SEEN_KEY); return v ? JSON.parse(v) : null; } catch (_) { return null; }
  }
  function saveSeen() { try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (_) {} }
  function noticeAnswers() {
    var first = seen === null, fresh = [];
    if (first) seen = {};
    comments.forEach(function (c) {
      var n = (c.replies || []).length;
      if (!first && n > (seen[c.id] || 0)) fresh.push(c);
      seen[c.id] = n;
    });
    saveSeen();
    if (!fresh.length) return;
    var c = fresh[fresh.length - 1];
    var item = isOpen && list.querySelector('[data-id="' + c.id + '"]');
    if (item) { item.classList.add("is-new"); setTimeout(function () { item.classList.remove("is-new"); }, 2600); }
    if (item && c.id === shownId) return;
    showToast(c, fresh.length);
  }
  function showToast(c, n) {
    var who = esc((c.replies[c.replies.length - 1] || {}).agent || CFG.agent || "The agent");
    toastEl.setAttribute("data-id", c.id);
    toastEl.innerHTML = "<b>" + who + (isQ(c) ? " answered " : " replied to ") + esc(c.id) + "</b>" +
      (n > 1 ? " and " + (n - 1) + " more" : "") + '<span class="pd-tq">' + esc(c.text.length > 70 ? c.text.slice(0, 68) + "…" : c.text) +
      '</span><span class="pd-trow"><button type="button">Show</button><button type="button" data-act="close">Later</button></span>';
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 15000);
  }
  function hideToast() { toastEl.hidden = true; clearTimeout(toastTimer); }

  function poll() {
    return fetch(API + "state", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
      comments = s.comments || [];
      if (sig && s.sig !== sig && !draft && !marking) {
        // The deck changed on disk (the agent's fix): reload, keeping the slide, the step and the panel.
        try {
          var h = here();
          sessionStorage.setItem("pd-restore", JSON.stringify({ slide: h.slide, step: h.step, open: isOpen, tab: tab, shown: shownId }));
        } catch (_) {}
        location.reload();
        return;
      }
      sig = s.sig;
      render();
      noticeAnswers();
    }).catch(function () {});
  }

  function restore() {
    var want = null;
    try { want = JSON.parse(sessionStorage.getItem("pd-restore") || "null"); sessionStorage.removeItem("pd-restore"); } catch (_) {}
    var q = /[?&]comment=([\w-]+)/.exec(location.search);
    return poll().then(function () {
      if (q) {
        var c = comments.filter(function (x) { return x.id === q[1]; })[0];
        if (c) { shownId = c.id; tab = "slide"; goTo(c); setOpen(true); }
      } else if (want) {
        tab = want.tab || "slide";
        shownId = want.shown || null;
        if (window.Deck) goTo({ slide: want.slide, step: want.step });
        if (want.open) setOpen(true);
      }
      render();
    });
  }

  function start() {
    seen = loadSeen();
    build();
    render();
    // After the engine has shown its first slide (it does so on load).
    setTimeout(function () { restore().then(function () { setInterval(poll, POLL_MS); }); }, 60);
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
