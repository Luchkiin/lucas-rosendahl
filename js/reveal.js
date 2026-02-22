(() => {
  const html = document.documentElement;
  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reveal = (el) => {
    el.classList.add("is-revealed");
    el.setAttribute("data-revealed", "true");
  };

  // Stagger: bara direkta children med data-reveal
  const setStaggerDelays = (container) => {
    const children = Array.from(container.children).filter((el) =>
      el.hasAttribute("data-reveal"),
    );

    const base = Number(container.dataset.staggerBase ?? 220);
    const step = Number(container.dataset.staggerStep ?? 120);

    children.forEach((el, i) => {
      el.style.setProperty("--reveal-delay", `${base + i * step}ms`);
    });
  };

  const showPage = () => {
    qsa("[data-page]").forEach((el) => el.classList.add("is-page-visible"));
  };

  const revealOnLoad = () => {
    qsa('[data-reveal="load"]').forEach(reveal);
  };

  const isInViewNow = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.95 && r.bottom > 0;
  };

  const setupScrollReveal = () => {
    const scrollEls = qsa('[data-reveal]:not([data-reveal="load"])');

    // 1) Default: trigga senare (mindre "för tidigt")
    const ioDefault = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.getAttribute("data-revealed") === "true") return;
          reveal(el);
          ioDefault.unobserve(el);
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -10% 0px", // trigga lite senare
      },
    );

    // 2) Footer: trigga lite tidigare så den alltid hinner
    const ioFooter = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.getAttribute("data-revealed") === "true") return;
          reveal(el);
          ioFooter.unobserve(el);
        });
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px 20% 0px", // snällare för botten
      },
    );

    scrollEls.forEach((el) => {
      const inFooter = !!el.closest("footer");

      (inFooter ? ioFooter : ioDefault).observe(el);

      // failsafe: om den redan syns vid init, reveal direkt
      if (isInViewNow(el) && el.getAttribute("data-revealed") !== "true") {
        reveal(el);
        (inFooter ? ioFooter : ioDefault).unobserve(el);
      }
    });
  };

  const start = () => {
    qsa("[data-stagger]").forEach(setStaggerDelays);

    html.classList.add("is-loaded");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        showPage();
        revealOnLoad();
      });
    });
  };

  if (prefersReducedMotion) {
    html.classList.add("is-loaded");
    showPage();
    qsa("[data-reveal]").forEach(reveal);
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        setupScrollReveal();
        start();
      },
      { once: true },
    );
  } else {
    setupScrollReveal();
    start();
  }
})();