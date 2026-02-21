(() => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const accordions = document.querySelectorAll("[data-accordion]");
  if (!accordions.length) return;

  accordions.forEach((accordion) => {
    const single = accordion.getAttribute("data-accordion-single") === "true";

    const items = Array.from(
      accordion.querySelectorAll("details.accordion__item")
    );

    const getParts = (item) => {
      const content = item.querySelector(".accordion__content");
      const inner = item.querySelector(".accordion__content-inner");
      return { content, inner };
    };

    const openItem = (item) => {
      const { content, inner } = getParts(item);
      if (!content || !inner) {
        item.setAttribute("open", "");
        return;
      }

      item.setAttribute("open", "");

      if (prefersReducedMotion) {
        content.style.height = "auto";
        content.style.opacity = "1";
        return;
      }

      content.style.height = "0px";
      content.style.opacity = "1";
      content.offsetHeight; // reflow

      content.style.height = `${inner.scrollHeight}px`;

      const onEnd = (e) => {
        if (e.propertyName !== "height") return;
        content.style.height = "auto";
        content.removeEventListener("transitionend", onEnd);
      };
      content.addEventListener("transitionend", onEnd);
    };

    const closeItem = (item) => {
      const { content, inner } = getParts(item);
      if (!content || !inner) {
        item.removeAttribute("open");
        return;
      }

      if (prefersReducedMotion) {
        content.style.height = "0px";
        content.style.opacity = "0";
        item.removeAttribute("open");
        return;
      }

      const startHeight =
        content.style.height === "auto" || !content.style.height
          ? inner.scrollHeight
          : parseFloat(content.style.height);

      content.style.height = `${startHeight}px`;
      content.offsetHeight; // reflow

      content.style.height = "0px";
      content.style.opacity = "0";

      const onEnd = (e) => {
        if (e.propertyName !== "height") return;
        item.removeAttribute("open");
        content.removeEventListener("transitionend", onEnd);
      };
      content.addEventListener("transitionend", onEnd);
    };

    // Init
    items.forEach((item) => {
      const { content } = getParts(item);
      if (!content) return;

      if (item.hasAttribute("open")) {
        content.style.height = "auto";
        content.style.opacity = "1";
      } else {
        content.style.height = "0px";
        content.style.opacity = "0";
      }
    });

    // Click handler
    items.forEach((item) => {
      const summary = item.querySelector("summary");
      if (!summary) return;

      summary.addEventListener("click", (e) => {
        e.preventDefault();

        const isOpen = item.hasAttribute("open");

        if (isOpen) {
          closeItem(item);
          return;
        }

        // Only close others when accordion is single-open
        if (single) {
          items.forEach((other) => {
            if (other !== item && other.hasAttribute("open")) closeItem(other);
          });
        }

        openItem(item);
      });
    });
  });
})();