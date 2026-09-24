/* ============================================================
   ARGENTUM COMMODITIES — micro-interactions
   cursor · sound · reveal · navigation · forms
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  /* ---------- Sound ---------- */
  var audio = {};
  function buildSound(key, url, vol) {
    var a = new Audio(url);
    a.volume = vol;
    a.preload = "none";
    audio[key] = a;
  }
  buildSound("click", "sounds/metal-click.wav", 0.45);
  buildSound("swipe", "sounds/paper-swipe.wav", 0.5);
  buildSound("tick", "sounds/soft-tick.wav", 0.4);

  var soundUnlocked = false;
  function play(key) {
    var a = audio[key];
    if (!a) return;
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (err) {}
  }
  function warm() {
    if (soundUnlocked) return;
    soundUnlocked = true;
    Object.keys(audio).forEach(function (k) {
      var a = audio[k];
      a.volume = 0;
      a.muted = true;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      setTimeout(function () {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        a.volume = k === "click" ? 0.45 : k === "swipe" ? 0.5 : 0.4;
      }, 60);
    });
  }

  window.addEventListener(
    "pointerdown",
    function () { warm(); },
    { once: true }
  );

  /* ---------- Minimal cursor ---------- */
  if (finePointer && !reduceMotion) {
    document.documentElement.classList.add("has-cursor");
    var cursorEl = document.querySelector(".cursor");
    var ring = document.querySelector(".cursor-ring");
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var ringX = mx, ringY = my;
    var ringScale = 1, targetRingScale = 1;
    var visible = false;

    cursorEl.style.opacity = "0";

    var INTERACTIVE = "a, button, input, textarea, select, label, .btn, [data-hover]";

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        cursorEl.style.opacity = "1";
        ringX = mx; ringY = my;
      }
      var t = e.target;
      targetRingScale = !!(t.closest && t.closest(INTERACTIVE)) ? 1.6 : 1;
      cursorEl.classList.toggle("is-active", t.closest && t.closest(INTERACTIVE));
    });

    document.addEventListener("mouseleave", function () {
      visible = false;
      cursorEl.style.opacity = "0";
    });
    document.documentElement.addEventListener("mouseenter", function () {
      visible = true;
      cursorEl.style.opacity = "1";
    });

    function tick() {
      ringScale += (targetRingScale - ringScale) * 0.15;
      ringX += (mx - ringX) * 0.18;
      ringY += (my - ringY) * 0.18;
      ring.style.transform =
        "translate3d(" + ringX + "px," + ringY + "px,0) translate(-50%,-50%) scale(" + ringScale.toFixed(3) + ")";
      requestAnimationFrame(tick);
    }
    tick();
  } else {
    var c = document.querySelector(".cursor");
    if (c) c.style.display = "none";
  }

  /* ---------- Metallic click ---------- */
  document.addEventListener(
    "click",
    function (e) {
      if (e.target.closest && e.target.closest("button, .btn")) play("click");
    },
    true
  );

  /* ---------- Header state ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var navToggle = document.getElementById("navToggle");
  var mobileMenu = document.getElementById("mobileMenu");
  function setMenu(open) {
    var currentlyOpen = mobileMenu.classList.contains("is-open");
    if (open === currentlyOpen) return;
    navToggle.setAttribute("aria-expanded", String(open));
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.classList.toggle("is-open", open);
    play("tick");
  }
  navToggle.addEventListener("click", function () {
    setMenu(mobileMenu.classList.contains("is-open") ? false : true);
  });
  document.addEventListener("click", function (e) {
    if (
      mobileMenu.classList.contains("is-open") &&
      !mobileMenu.contains(e.target) &&
      !navToggle.contains(e.target)
    ) {
      setMenu(false);
    }
  });

  /* ---------- Page transitions (anchor nav + paper swipe) ---------- */
  document.querySelectorAll("a[data-nav]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      play("swipe");
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  /* ---------- Scroll reveals ---------- */
  var heroes = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    heroes.forEach(function (el) { observer.observe(el); });
  } else {
    heroes.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- Forms ---------- */
  var supabaseClient = null;
  var haveSupa = (function () {
    try {
      var cfg = window.ARGENTUM_SUPABASE;
      if (!cfg || !cfg.url || !cfg.anonKey) return false;
      if (typeof window.supabase === "undefined") return false;
      supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
      return true;
    } catch (err) {
      return false;
    }
  })();

  var formErrors = document.createElement("p");
  formErrors.className = "form-error";
  formErrors.style.cssText =
    "color:#f2f2f2;background:rgba(242,242,242,.06);border:1px solid #ff000066;padding:.7rem 1rem;font-size:.78rem;margin-top:1rem;line-height:1.6;";
  function showFormError(form, msg) {
    formErrors.textContent = msg;
    form.appendChild(formErrors);
    formErrors.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  var fieldNames = {
    rfqForm: { company: "company_name", contact: "contact_person", phone: "phone", email: "email", commodity: "commodity", purity: "purity", quantity: "quantity", location: "delivery_city", requiredBy: "required_date", notes: "notes" },
    supplierForm: { company: "company_name", gst: "gst", contact: "contact_person", phone: "phone", email: "email", commodity: "commodity", moq: "moq", cities: "cities", notes: "notes" }
  };

  var RE_PHONE = /^[6-9]\d{9}$/;
  var RE_EMAIL = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
  var BAD_EMAIL_DOMAINS = /(^|\.)(example\.com|example\.org|example\.net|test\.com|test\.org|yourdomain\.com|domain\.com|domain\.org|site\.com|mysite\.com|website\.com|email\.com|mail\.com|mailinator\.com|yopmail\.com|10minutemail\.com|guerrillamail\.com|throwawaymail\.com)$/i;
  var RE_GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  var RE_PURITY = /^\d{1,3}(\.\d{1,4})?%?$/;
  var RE_NAME = /^[A-Za-z .'\-]{2,80}$/;

  function gstChecksumOk(gst) {
    var v = gst.toUpperCase();
    if (!RE_GST.test(v)) return false;
    var sum = 0, i, c, val, prod;
    for (i = 0; i < 14; i++) {
      c = v.charCodeAt(i);
      val = c >= 48 && c <= 57 ? c - 48 : c - 55;
      prod = val * (i % 2 === 0 ? 1 : 2);
      sum += Math.floor(prod / 10) + (prod % 10);
    }
    var ck = sum % 36 === 0 ? 0 : 36 - (sum % 36);
    var last = v.charCodeAt(14);
    var lastVal = last >= 48 && last <= 57 ? last - 48 : last - 55;
    return ck === lastVal;
  }

  function validateField(input) {
    if (!input || !input.name) return "";
    var name = input.name;
    var value = input.value ? input.value.trim() : "";
    var msg = "";
    var req = function (m) { return value ? "" : m; };
    if (name === "company") {
      msg = req("Company name is required.") || (value.length < 2 ? "Company name looks too short." : "");
    } else if (name === "contact") {
      msg = req("Contact person is required.") || (!RE_NAME.test(value) ? "Enter a valid name (letters, spaces, dots)." : "");
    } else if (name === "phone") {
      msg = req("Phone is required.") || (!RE_PHONE.test(value) ? "Enter a valid 10-digit Indian mobile (starts 6–9)." : "");
    } else if (name === "email") {
      msg = value && (!RE_EMAIL.test(value) ? "Enter a valid email address (e.g. name@company.com)." : BAD_EMAIL_DOMAINS.test(value) ? "That email domain looks fake — use a real one." : "");
    } else if (name === "gst") {
      msg = req("GST number is required.") ||
        (!RE_GST.test(value) ? "GST must be 15 characters (e.g. 27AAACP1234F1Z7)." : "") ||
        (!gstChecksumOk(value) ? "GST checksum failed — verify the number." : "");
    } else if (name === "commodity") {
      msg = req("Commodity is required.") || (value.length < 2 ? "Commodity looks too short." : "");
    } else if (name === "purity") {
      msg = req("Purity is required.") || (!RE_PURITY.test(value) ? "Enter purity like 99.99 or 99.99%." : "");
    } else if (name === "quantity") {
      msg = req("Quantity is required.");
      if (!msg) {
        var n = parseFloat(value.replace(/[^\d.]/g, ""));
        if (isNaN(n) || n <= 0) msg = "Enter a quantity greater than zero.";
        else if (n >= 1000000) msg = "Quantity looks unrealistically large.";
      }
    } else if (name === "requiredBy") {
      msg = req("Required-by date is required.");
      if (!msg) {
        var d = new Date(value + "T00:00:00");
        var today = new Date(); today.setHours(0, 0, 0, 0);
        if (isNaN(d.getTime())) msg = "Pick a valid date.";
        else if (d < today) msg = "This date is in the past.";
        else if (d.getTime() - today.getTime() > 1892160000000) msg = "This is more than 2 years out — check the timeline.";
      }
    } else if (name === "location") {
      msg = req("Delivery location is required.") || (value.length < 2 ? "Location looks too short." : "");
    } else if (name === "moq") {
      msg = req("MOQ is required.") || (value.length < 2 ? "MOQ looks too short." : "");
    } else if (name === "cities") {
      msg = req("Cities served is required.") || (value.length < 2 ? "Cities looks too short." : "");
    } else if (name === "notes") {
      msg = value.length > 2000 ? "Notes are too long (max 2000 characters)." : "";
    }
    return msg;
  }

  var fieldErrors = {};
  function attachFieldValidation(form) {
    Array.prototype.forEach.call(form.querySelectorAll("input, textarea, select"), function (input) {
      if (input.type === "hidden" || input.classList.contains("hpot") || !input.name) return;
      var fieldEl = input.closest(".field");
      if (!fieldEl) return;
      var err = document.createElement("span");
      err.className = "field-err";
      err.hidden = true;
      fieldEl.appendChild(err);
      fieldErrors[input.name] = { input: input, fieldEl: fieldEl, err: err };
      input.addEventListener("blur", function () { markField(input); });
      input.addEventListener("input", function () { clearField(input); });
    });
  }
  function markField(input) {
    var rec = fieldErrors[input.name];
    if (!rec) return;
    var msg = validateField(input);
    if (msg) {
      rec.fieldEl.classList.add("is-invalid");
      rec.err.textContent = msg;
      rec.err.hidden = false;
    } else {
      clearField(input);
    }
  }
  function clearField(input) {
    var rec = fieldErrors[input.name];
    if (!rec) return;
    rec.fieldEl.classList.remove("is-invalid");
    rec.err.hidden = true;
  }
  function validateForm(form) {
    var bad = null;
    Array.prototype.forEach.call(form.querySelectorAll("input, textarea, select"), function (input) {
      if (input.type === "hidden" || input.classList.contains("hpot") || !input.name) return;
      markField(input);
      var rec = fieldErrors[input.name];
      if (!bad && rec && rec.fieldEl.classList.contains("is-invalid")) bad = input;
    });
    if (bad) {
      bad.focus({ preventScroll: true });
      bad.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
    return !bad;
  }
  function isBot(form) {
    var h = form.querySelector(".hpot");
    return !!(h && h.value && h.value.trim());
  }
  var lastSubmit = 0;

  function payloadFor(formId, form) {
    var map = fieldNames[formId];
    var out = {};
    Object.keys(map).forEach(function (key) {
      var el = form.elements.namedItem(key);
      var raw = el ? el.value.trim() : "";
      if (!raw) return;
      if (map[key] === "quantity") {
        var n = parseFloat(raw.replace(/[^\d.]/g, ""));
        if (!isNaN(n)) out.quantity = n;
      } else if (map[key] === "required_date") {
        out.required_date = raw || null;
      } else {
        out[map[key]] = raw;
      }
    });
    return out;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "supa-toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed", bottom: "1.25rem", left: "50%", transform: "translateX(-50%)",
      zIndex: 6000, background: "#090909", color: "#f2f2f2", border: "1px solid #c8ccd166",
      padding: ".7rem 1.2rem", fontSize: ".78rem", letterSpacing: ".08em", fontFamily: "Inter, sans-serif"
    });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3400);
  }

  function initForm(formId, successId) {
    var form = document.getElementById(formId);
    var success = document.getElementById(successId);
    if (!form || !success) return;
    attachFieldValidation(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (formErrors.parentNode === form) formErrors.remove();
      if (isBot(form)) {
        form.hidden = true;
        success.hidden = false;
        return;
      }
      var now = Date.now();
      if (now - lastSubmit < 4000) {
        showFormError(form, "Please wait a few seconds before submitting again.");
        return;
      }
      if (!validateForm(form)) return;
      lastSubmit = now;
      if (supabaseClient) {
        var table = formId === "rfqForm" ? "rfqs" : "suppliers";
        var payload = payloadFor(formId, form);
        var btn = form.querySelector("button[type=submit]");
        btn.disabled = true;
        var label = btn.textContent;
        btn.textContent = "Sending…";
        supabaseClient
          .from(table)
          .insert(payload)
          .then(function (res) {
            btn.disabled = false;
            btn.textContent = label;
            if (res.error) {
              if (res.error.message && /duplicate/i.test(res.error.message)) {
                showFormError(form, "This was already received in the last 10 minutes — our desk has it.");
              } else {
                showFormError(form, "The desk could not accept this submission. Check the highlighted fields and try again, or email " +
                  '<a href="mailto:argentumcommodities@proton.me" style="color:#c8ccd1;">argentumcommodities@proton.me</a>');
              }
              return;
            }
            form.hidden = true;
            success.hidden = false;
            play("swipe");
            toast(formId === "rfqForm" ? "RFQ received by the trading desk." : "Supplier application received.");
            success.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = label;
            showFormError(form, "Network error — the desk could not receive this submission. Check the highlighted fields and try again.");
          });
      } else {
        form.hidden = true;
        success.hidden = false;
        play("swipe");
        success.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      }
    });

    var resets = success.querySelectorAll("[data-reset]");
    Array.prototype.forEach.call(resets, function (btn) {
      btn.addEventListener("click", function () {
        form.reset();
        success.hidden = true;
        form.hidden = false;
        if (formErrors.parentNode === form) formErrors.remove();
        play("click");
      });
    });
  }
  initForm("supplierForm", "supplierSuccess");
  initForm("rfqForm", "rfqSuccess");

  /* ---------- Footer divider reveal ---------- */
  var footer = document.querySelector(".site-footer");
  if (footer && "IntersectionObserver" in window) {
    var fObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            footer.classList.add("in-view");
            fObserver.unobserve(footer);
          }
        });
      },
      { threshold: 0.15 }
    );
    fObserver.observe(footer);
  } else if (footer) {
    footer.classList.add("in-view");
  }

  /* ---------- Hero immediate reveal ---------- */
  var hero = document.querySelector(".hero");
  if (hero) hero.classList.add("in-view");
})();