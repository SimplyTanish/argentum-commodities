/* ============================================================
   ARGENTUM DESK — internal CRM
   auth · tables · realtime · status · supplier match
   ============================================================ */
(function () {
  "use strict";

  var STATUSES = ["Pending", "Verified", "Quoting", "Negotiating", "Won", "Lost"];
  var state = {
    client: null,
    rfqs: [],
    suppliers: [],
    contacts: [],
    tab: "dashboard",
    openId: null,
    match: {}
  };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var fmtDate = function (d) {
    if (!d) return "—";
    var x = new Date(d);
    return isNaN(x) ? "—" : x.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  var chip = function (status) {
    return '<span class="desk-chip status-' + esc(status) + '">' + esc(status) + "</span>";
  };

  /* ---------- Boot ---------- */
  function boot() {
    var cfg = window.ARGENTUM_SUPABASE;
    if (!cfg || !cfg.url || !cfg.anonKey || typeof window.supabase === "undefined") {
      $("deskLogin").hidden = false;
      $("loginError").hidden = false;
      $("loginError").textContent = "Supabase is not configured on this build. Set js/supabase-config.js.";
      $("loginBtn").disabled = true;
      return;
    }
    state.client = window.supabase.createClient(cfg.url, cfg.anonKey);
    state.client.auth.getSession().then(function (res) {
      if (res.data && res.data.session) startApp(res.data.session);
      else showLogin();
    });
    wireLogin();
    wireTabs();
    wireDrawer();
    $("logoutBtn").addEventListener("click", function () {
      state.client.auth.signOut().then(function () { location.reload(); });
    });
  }

  /* ---------- Login ---------- */
  function showLogin() {
    $("deskLogin").hidden = false;
    $("deskApp").hidden = true;
    var err = $("loginError");
    err.hidden = true;
  }
  function wireLogin() {
    $("loginForm").addEventListener("submit", handleLogin);
  }
  function handleLogin(e) {
    e.preventDefault();
    var err = $("loginError");
    err.hidden = true;
    var email = $("loginEmail").value.trim();
    var pass = $("loginPassword").value;
    if (!email || !pass) { err.hidden = false; err.textContent = "Enter credentials."; return; }
    var btn = $("loginBtn");
    btn.disabled = true; btn.textContent = "Opening…";
    state.client.auth.signInWithPassword({ email: email, password: pass })
      .then(function (res) {
        btn.disabled = false; btn.textContent = "Open Desk";
        if (res.error) {
          err.hidden = false;
          err.textContent = (res.error.message || "Sign-in failed.") + " Check credentials.";
          return;
        }
        startApp(res.data.session);
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = "Open Desk";
        err.hidden = false;
        err.textContent = "Network error. Try again.";
      });
  }

  /* ---------- App ---------- */
  function startApp() {
    $("deskLogin").hidden = true;
    $("deskApp").hidden = false;
    loadData();
    wireSearch();
    subscribeRealtime();
  }

  function loadData() {
    Promise.all([
      state.client.from("rfqs").select("*").order("created_at", { ascending: false }),
      state.client.from("suppliers").select("*").order("created_at", { ascending: false }),
      state.client.from("contacts").select("*").order("created_at", { ascending: false })
    ]).then(function (res) {
      state.rfqs = (res[0].data || []);
      state.suppliers = (res[1].data || []);
      state.contacts = (res[2].data || []);
      if (res[0].error || res[1].error || res[2].error) {
        console.error("desk load", res.map(function (r) { return r.error; }));
      }
      renderAll();
    });
  }

  function subscribeRealtime() {
    ["rfqs", "suppliers", "contacts"].forEach(function (table) {
      state.client
        .channel("desk-" + table)
        .on("postgres_changes", { event: "*", schema: "public", table: table }, function () {
          $("deskLive").textContent = "LIVE";
          loadData();
        })
        .subscribe();
    });
  }

  /* ---------- Rendering ---------- */
  function renderAll() {
    renderDashboard();
    renderRfqs();
    renderSuppliers();
    renderContacts();
    renderDeals();
  }

  function renderDashboard() {
    var today = new Date().toDateString();
    var newToday = state.rfqs.filter(function (r) { return new Date(r.created_at).toDateString() === today; }).length;
    var verified = state.rfqs.filter(function (r) { return r.status === "Verified" || r.status === "Quoting" || r.status === "Negotiating"; }).length;
    var deals = state.rfqs.filter(function (r) { return r.status === "Won"; }).length;
    $("deskMetrics").innerHTML =
      metric("New RFQs", newToday) + metric("Verified", verified) +
      metric("Suppliers", state.suppliers.length) + metric("Deals Closed", deals);

    var recent = state.rfqs.slice(0, 6);
    $("dashRfqs").innerHTML = recent.length ? recent.map(rfqRow).join("") : '<p class="desk-empty">No enquiries yet.</p>';
    bindOpenButtons($("dashRfqs"));
  }
  function metric(label, val) {
    return '<div class="desk-metric"><span>' + esc(label) + "</span><b>" + esc(val) + "</b></div>";
  }
  function rfqRow(r) {
    return '<div class="desk-row">' +
      '<div class="desk-row-main"><h3>' + esc(r.company_name) + "</h3>" +
      "<p>" + esc(r.quantity != null ? r.quantity + " kg " : "") + esc(r.commodity) +
      (r.delivery_city ? " · " + esc(r.delivery_city) : "") +
      " · " + esc(fmtDate(r.created_at)) + "</p></div>" +
      chip(r.status || "Pending") +
      '<button class="desk-open" data-open="' + r.id + '">Open</button></div>';
  }
  function bindOpenButtons(root) {
    root.querySelectorAll("[data-open]").forEach(function (btn) {
      btn.addEventListener("click", function () { openDrawer(btn.getAttribute("data-open")); });
    });
  }

  /* ---------- Tables ---------- */
  function filteredRfqs() {
    var q = ($("rfqSearch").value || "").toLowerCase();
    var st = $("rfqStatusFilter").value;
    return state.rfqs.filter(function (r) {
      if (st && r.status !== st) return false;
      if (!q) return true;
      return [r.company_name, r.commodity, r.delivery_city, r.contact_person, r.phone]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderRfqs() {
    var rows = filteredRfqs();
    var body = $("rfqTableBody");
    if (!rows.length) { body.innerHTML = '<tr><td colspan="7" class="dim">No matching RFQs.</td></tr>'; return; }
    body.innerHTML = rows.map(function (r) {
      return "<tr>" +
        '<td class="dim">' + esc(fmtDate(r.created_at)) + "</td>" +
        "<td><b>" + esc(r.company_name) + "</b><br><span class='dim'>" + esc(r.contact_person || "") + (r.phone ? " · " + esc(r.phone) : "") + "</span></td>" +
        "<td>" + esc(r.commodity) + (r.purity ? "<br><span class='dim'>" + esc(r.purity) + "</span>" : "") + "</td>" +
        "<td>" + (r.quantity != null ? esc(r.quantity) + " kg" : "—") + "</td>" +
        "<td class='dim'>" + esc(r.delivery_city || "—") + "</td>" +
        "<td>" + chip(r.status || "Pending") + "</td>" +
        '<td><button class="desk-open" data-open="' + r.id + '">Open</button></td>' +
        "</tr>";
    }).join("");
    bindOpenButtons(body);
  }

  function renderSuppliers() {
    var q = ($("supSearch").value || "").toLowerCase();
    var rows = state.suppliers.filter(function (s) {
      if (!q) return true;
      return [s.company_name, s.commodity, s.cities, s.contact_person].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    var body = $("supTableBody");
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="dim">No suppliers yet.</td></tr>'; return; }
    body.innerHTML = rows.map(function (s) {
      return "<tr>" +
        "<td><b>" + esc(s.company_name) + "</b><br><span class='dim'>" + esc(s.gst || "") + "</span></td>" +
        "<td>" + esc(s.commodity || "—") + "</td>" +
        "<td>" + esc(s.moq || "—") + "</td>" +
        "<td class='dim'>" + esc(s.cities || "—") + "</td>" +
        "<td class='dim'>" + esc(s.contact_person || "") + (s.phone ? "<br>" + esc(s.phone) : "") + "</td>" +
        "<td><button class='desk-open' data-verify='" + s.id + "'>" + (s.verified ? "Verified" : "Verify") + "</button></td>" +
        "</tr>";
    }).join("");
    body.querySelectorAll("[data-verify]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-verify");
        var sup = state.suppliers.filter(function (s) { return s.id === id; })[0];
        if (!sup) return;
        state.client.from("suppliers").update({ verified: !sup.verified }).eq("id", id).then(loadData);
      });
    });
  }

  function renderContacts() {
    var q = ($("conSearch").value || "").toLowerCase();
    var rows = state.contacts.filter(function (c) {
      if (!q) return true;
      return [c.company_name, c.person, c.city, c.phone].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    var body = $("conTableBody");
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="dim">No contacts yet.</td></tr>'; return; }
    body.innerHTML = rows.map(function (c) {
      return "<tr>" +
        "<td><b>" + esc(c.company_name || "—") + "</b></td>" +
        "<td class='dim'>" + esc(c.person || "—") + "</td>" +
        "<td>" + esc(c.type || "—") + "</td>" +
        "<td class='dim'>" + esc(c.phone || "—") + "</td>" +
        "<td class='dim'>" + esc(c.city || "—") + "</td>" +
        "<td class='dim'>" + esc(c.remarks || "—") + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderDeals() {
    var deals = state.rfqs.filter(function (r) { return r.status === "Won"; });
    var sumQty = deals.reduce(function (a, r) { return a + (r.quantity || 0); }, 0);
    $("dealMetrics").innerHTML =
      metric("Deals Won", deals.length) +
      metric("Total Quantity (kg)", Math.round(sumQty)) +
      metric("Avg / Deal", deals.length ? Math.round(sumQty / deals.length) : 0);
    $("dealList").innerHTML = deals.length ? deals.map(rfqRow).join("") : '<p class="desk-empty">No closed deals yet.</p>';
    bindOpenButtons($("dealList"));
  }

  function wireSearch() {
    ["rfqSearch", "rfqStatusFilter"].forEach(function (id) {
      $(id).addEventListener("input", renderRfqs);
    });
    $("supSearch").addEventListener("input", renderSuppliers);
    $("conSearch").addEventListener("input", renderContacts);
  }

  /* ---------- Tabs ---------- */
  function wireTabs() {
    $("deskTabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".desk-tab");
      if (!btn) return;
      var tab = btn.getAttribute("data-tab");
      state.tab = tab;
      document.querySelectorAll(".desk-tab").forEach(function (t) { t.classList.toggle("is-active", t === btn); });
      document.querySelectorAll(".desk-pane").forEach(function (p) { p.hidden = p.id !== "pane-" + tab; });
      renderAll();
    });
  }

  /* ---------- Drawer / supplier match ---------- */
  function wireDrawer() {
    document.querySelectorAll("[data-close-drawer]").forEach(function (el) {
      el.addEventListener("click", closeDrawer);
    });
    $("sendRfqBtn").addEventListener("click", function () {
      if (!state.openId) return;
      var selected = Object.keys(state.match).filter(function (k) { return state.match[k]; });
      state.client
        .from("rfqs")
        .update({ status: "Quoting", assigned_suppliers: selected })
        .eq("id", state.openId)
        .then(function () {
          closeDrawer();
          loadData();
        });
    });
  }

  function openDrawer(id) {
    var r = state.rfqs.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    state.openId = id;
    state.match = {};

    $("drawerTitle").textContent = r.company_name || "RFQ";
    $("drawerMeta").innerHTML =
      metaRow("Commodity", r.commodity) +
      metaRow("Quantity", r.quantity != null ? r.quantity + " kg" : "—") +
      metaRow("Purity", r.purity) +
      metaRow("Delivery", r.delivery_city) +
      metaRow("Required by", r.required_date) +
      metaRow("Contact", [r.contact_person, r.phone, r.email].filter(Boolean).join(" · ")) +
      metaRow("Received", fmtDate(r.created_at)) +
      metaRow("Notes", r.notes);

    var sel = $("drawerStatus");
    sel.innerHTML = STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === (r.status || "Pending") ? " selected" : "") + ">" + s + "</option>";
    }).join("");
    sel.onchange = function () {
      state.client.from("rfqs").update({ status: sel.value }).eq("id", id).then(loadData);
    };

    renderMatch(r);

    var drawer = $("deskDrawer");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  }
  function metaRow(k, v) {
    return "<p>" + esc(k) + " <b>" + esc(v == null || v === "" ? "—" : v) + "</b></p>";
  }
  function closeDrawer() {
    var drawer = $("deskDrawer");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    state.openId = null;
    state.match = {};
  }

  function renderMatch(rfq) {
    var city = (rfq.delivery_city || "").toLowerCase();
    var words = (rfq.commodity || "").toLowerCase().split(/[\s,·]+/).filter(function (w) { return w.length > 2; });

    var scored = state.suppliers.map(function (s) {
      var hay = ((s.commodity || "") + " " + (s.company_name || "") + " " + (s.cities || "")).toLowerCase();
      var cityHit = city && hay.indexOf(city) !== -1;
      var wordHit = words.some(function (w) { return hay.indexOf(w) !== -1; });
      var score = (cityHit ? 2 : 0) + (wordHit ? 1 : 0);
      return { s: s, score: score, cityHit: cityHit, wordHit: wordHit };
    }).filter(function (x) { return x.score > 0 && x.s.verified; })
      .sort(function (a, b) { return b.score - a.score || a.s.company_name.localeCompare(b.s.company_name); });

    var box = $("drawerMatch");
    if (!scored.length) {
      box.innerHTML = '<p class="match-empty">No verified suppliers match this enquiry yet. Verify suppliers in the Suppliers tab.</p>';
      $("sendRfqBtn").disabled = true;
      return;
    }
    $("sendRfqBtn").disabled = false;
    box.innerHTML = '<div class="desk-match-list">' + scored.map(function (x, i) {
      var s = x.s;
      return '<label class="match-item">' +
        '<input type="checkbox" data-sup="' + s.id + '"' + (i === 0 ? " checked" : "") + ">" +
        "<div><h4>" + esc(s.company_name) + "</h4>" +
        "<p>MOQ: " + esc(s.moq || "—") + (s.cities ? " · " + esc(s.cities) : "") +
        " <span class='ok'>✓ " + (x.cityHit ? "City match" : "Commodity match") + "</span></p></div></label>";
    }).join("") + "</div>";

    state.match = {};
    box.querySelectorAll("[data-sup]").forEach(function (cb) {
      state.match[cb.getAttribute("data-sup")] = cb.checked;
      cb.addEventListener("change", function () { state.match[cb.getAttribute("data-sup")] = cb.checked; });
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();