(() => {
  const html = document.documentElement;
  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;

  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reveal = (el) => {
    el.classList.add("is-revealed");
    el.setAttribute("data-revealed", "true");
  };

  const setStaggerDelays = (container) => {
    const children = qsa("[data-reveal]", container);
    const base = Number(container.dataset.staggerBase ?? 220);
    const step = Number(container.dataset.staggerStep ?? 120);
    children.forEach((el, i) => {
      el.style.setProperty("--reveal-delay", `${base + i * step}ms`);
    });
  };

  // Page transition
  const showPage = () => {
    qsa("[data-page]").forEach((el) => el.classList.add("is-page-visible"));
  };

  // Reveal on load markers (header/hero)
  const revealOnLoad = () => {
    qsa('[data-reveal="load"]').forEach(reveal);
  };

const start = () => {
  qsa("[data-stagger]").forEach(setStaggerDelays);

  // 1) slå på transitions
  html.classList.add("is-loaded");

requestAnimationFrame(() => {
  setTimeout(() => {
    showPage();
    revealOnLoad();
  }, 80);
});
};

  if (prefersReducedMotion) {
    html.classList.add("is-loaded");
    showPage();
    qsa("[data-reveal]").forEach(reveal);
    return;
  }

  // Scroll reveals: allt som inte explicit är load
  const setupScrollReveal = () => {
    const scrollEls = qsa('[data-reveal]:not([data-reveal="load"])');

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.getAttribute("data-revealed") === "true") return;
          reveal(el);
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    scrollEls.forEach((el) => io.observe(el));
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        start();
        setupScrollReveal();
      },
      { once: true }
    );
  } else {
    start();
    setupScrollReveal();
  }
})();