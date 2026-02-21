(() => {
  const html = document.documentElement;

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;

  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const raf2 = (cb) => requestAnimationFrame(() => requestAnimationFrame(cb));

  const readStaggerValue = (container, dataKey, cssVarName, fallback) => {
    const attrValue = Number(container.dataset[dataKey]);
    if (Number.isFinite(attrValue)) return attrValue;

    const cssValue = Number(
      window.getComputedStyle(container).getPropertyValue(cssVarName)
    );
    if (Number.isFinite(cssValue)) return cssValue;

    return fallback;
  };

  const setStaggerDelays = (container) => {
    const children = qsa("[data-reveal]", container);
    const defaultBase = container.closest(".hero")
      ? 220
      : container.closest(".site-header")
        ? 80
        : 120;
    const defaultStep = container.closest(".hero")
      ? 105
      : container.closest(".site-header")
        ? 70
        : 85;
    const base = readStaggerValue(
      container,
      "staggerBase",
      "--reveal-stagger-base",
      defaultBase
    );
    const step = readStaggerValue(
      container,
      "staggerStep",
      "--reveal-stagger-step",
      defaultStep
    );

    children.forEach((el, i) => {
      el.style.setProperty("--reveal-delay", `${base + i * step}ms`);
    });
  };

  const reveal = (el) => {
    if (el.getAttribute("data-revealed") === "true") return;
    el.classList.add("is-revealed");
    el.setAttribute("data-revealed", "true");
  };

  // Init stagger containers
  qsa("[data-stagger]").forEach(setStaggerDelays);

  // Reveal on load (explicit)
  const revealOnLoad = () => {
    qsa('[data-reveal="load"]').forEach(reveal);
  };

  // Reduced motion: show everything directly
  if (prefersReducedMotion) {
    html.classList.add("is-loaded");
    qsa("[data-reveal]").forEach(reveal);
    return;
  }

  // Treat "data-reveal" with no value as "scroll" by default
  // i.e. everything except explicit load is scroll-revealed
  const scrollEls = qsa('[data-reveal]:not([data-reveal="load"])');

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          reveal(el);
          io.unobserve(el);
        });
      },
      {
        threshold: 0.06,
        rootMargin: "0px 0px 14% 0px",
      }
    );

    scrollEls.forEach((el) => io.observe(el));
  } else {
    scrollEls.forEach(reveal);
  }

  // IMPORTANT: run after DOM is ready (not waiting for video/assets)
  const start = () => {
    let didRun = false;
    const commit = () => {
      if (didRun) return;
      didRun = true;
      html.classList.add("is-loaded");
      revealOnLoad();
    };

    // Smooth startup with a full pre-paint frame before reveal states kick in.
    raf2(commit);

    // Fallback for tabs where rAF can be throttled.
    window.setTimeout(commit, 240);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
