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
  function initForm(formId, successId) {
    var form = document.getElementById(formId);
    var success = document.getElementById(successId);
    if (!form || !success) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.hidden = true;
      success.hidden = false;
      play("swipe");
      success.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });

    var resets = success.querySelectorAll("[data-reset]");
    Array.prototype.forEach.call(resets, function (btn) {
      btn.addEventListener("click", function () {
        form.reset();
        success.hidden = true;
        form.hidden = false;
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