(() => {
  const viewer = document.querySelector("[data-image-viewer]");
  if (!viewer) return;

  const imgEl = viewer.querySelector("[data-image-viewer-img]");
  const closeBtn = viewer.querySelector("[data-image-viewer-close]");
  const overlay = viewer.querySelector(".image-viewer__overlay");

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;

  let activeThumb = null;
  let cloneEl = null;
  let lastFocused = null;
  let isOpen = false;

  // ---- Scroll lock (no jump, no "locked page" after) ----
  let scrollY = 0;

  const lockScroll = () => {
    scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    document.documentElement.classList.add("is-viewer-open");

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  };

  const unlockScroll = () => {
    document.documentElement.classList.remove("is-viewer-open");

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    window.scrollTo(0, scrollY);
  };

  // ---- Utilities ----
  const waitFrame = () => new Promise((r) => requestAnimationFrame(r));

  const cleanupClone = () => {
    if (cloneEl) {
      cloneEl.remove();
      cloneEl = null;
    }
    activeThumb?.classList.remove("is-zoom-hidden");
  };

  // "Contain" rect in viewport so 16:9 / 4:3 / etc animate correctly.
  const getContainRect = (naturalW, naturalH, padding = 32, maxW = 1440) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const availW = Math.min(maxW, vw - padding * 2);
    const availH = vh - padding * 2;

    const ratio = naturalW / naturalH;

    let w = availW;
    let h = w / ratio;

    if (h > availH) {
      h = availH;
      w = h * ratio;
    }

    const left = (vw - w) / 2;
    const top = (vh - h) / 2;

    return { left, top, width: w, height: h };
  };

  const setImgToContainRect = () => {
    if (!imgEl.src || !imgEl.naturalWidth) return;

    const target = getContainRect(imgEl.naturalWidth, imgEl.naturalHeight, 32, 1440);

    // Låt dialogen centrera men vi styr själva storleken för stabil FLIP
    imgEl.style.width = `${target.width}px`;
    imgEl.style.height = `${target.height}px`;
  };

  // ---- Open ----
  const open = async (thumb) => {
    if (!thumb || isOpen) return;
    isOpen = true;

    cleanupClone();
    activeThumb = thumb;
    lastFocused = document.activeElement;

    // Decode thumb before measuring
    if (!thumb.complete) {
      try { await thumb.decode(); } catch {}
    }

    const startRect = thumb.getBoundingClientRect();
    const src = thumb.currentSrc || thumb.src;

    // Prepare viewer (show overlay immediately, hide full image while animating)
    imgEl.src = src;
    imgEl.alt = thumb.alt || "";
    imgEl.style.width = "";
    imgEl.style.height = "";

    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");

    viewer.classList.add("is-open", "is-animating");
    viewer.classList.remove("is-ready");

    lockScroll();
    await waitFrame();

    // Decode large image so natural sizes are available
    try { await imgEl.decode(); } catch {}

    // Compute contain target
    const target = getContainRect(imgEl.naturalWidth, imgEl.naturalHeight, 32, 1440);

    // Reduced motion: show directly
    if (prefersReducedMotion) {
      imgEl.style.width = `${target.width}px`;
      imgEl.style.height = `${target.height}px`;
      viewer.classList.remove("is-animating");
      viewer.classList.add("is-ready");
      closeBtn?.focus?.({ preventScroll: true });
      return;
    }

    // Hide original thumb during FLIP
    thumb.classList.add("is-zoom-hidden");

    // Clone the thumb and animate it to the contain rect
    cloneEl = thumb.cloneNode(true);
    cloneEl.removeAttribute("data-zoomable");
    cloneEl.className = "image-viewer__clone";

    // Ensure the clone looks identical
    cloneEl.style.position = "fixed";
    cloneEl.style.left = `${startRect.left}px`;
    cloneEl.style.top = `${startRect.top}px`;
    cloneEl.style.width = `${startRect.width}px`;
    cloneEl.style.height = `${startRect.height}px`;
    cloneEl.style.transformOrigin = "top left";
    cloneEl.style.zIndex = "1000";
    cloneEl.style.willChange = "transform";

    document.body.appendChild(cloneEl);

    // Force reflow
    cloneEl.getBoundingClientRect();

    const dx = target.left - startRect.left;
    const dy = target.top - startRect.top;
    const sx = target.width / startRect.width;
    const sy = target.height / startRect.height;

    cloneEl.style.transition = "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)";
    cloneEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    // Failsafe: never get stuck if transitionend doesn't fire
    const fail = setTimeout(() => {
      cleanupClone();
      imgEl.style.width = `${target.width}px`;
      imgEl.style.height = `${target.height}px`;
      viewer.classList.remove("is-animating");
      viewer.classList.add("is-ready");
      closeBtn?.focus?.({ preventScroll: true });
    }, 700);

    cloneEl.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "transform") return;

        clearTimeout(fail);
        cleanupClone();

        imgEl.style.width = `${target.width}px`;
        imgEl.style.height = `${target.height}px`;

        viewer.classList.remove("is-animating");
        viewer.classList.add("is-ready");
        closeBtn?.focus?.({ preventScroll: true });
      },
      { once: true }
    );
  };

  // ---- Close ----
  const finishClose = () => {
    cleanupClone();

    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");

    viewer.classList.remove("is-open", "is-animating", "is-ready");

    imgEl.src = "";
    imgEl.style.width = "";
    imgEl.style.height = "";

    unlockScroll();

    isOpen = false;

    // Prevent browser from scrolling to the focused element
    lastFocused?.focus?.({ preventScroll: true });

    lastFocused = null;
    activeThumb = null;
  };

  const close = async () => {
    if (viewer.hidden) return;

    // guard: don't run close twice
    if (viewer.dataset.closing === "1") return;
    viewer.dataset.closing = "1";

    viewer.classList.remove("is-ready");

    const thumb = activeThumb;

    // timeout fallback to always unlock page
    const fail = setTimeout(() => {
      viewer.dataset.closing = "0";
      finishClose();
    }, 800);

    if (prefersReducedMotion || !thumb) {
      clearTimeout(fail);
      viewer.dataset.closing = "0";
      finishClose();
      return;
    }

    // Reverse FLIP: from contain rect -> thumb rect
    const endRect = thumb.getBoundingClientRect();

    // Compute current contain rect (stable even if viewport resized)
    const target = getContainRect(imgEl.naturalWidth, imgEl.naturalHeight, 32, 1440);

    // Create reverse clone from the large image at contain rect position
    thumb.classList.add("is-zoom-hidden");

    const reverse = imgEl.cloneNode(true);
    reverse.className = "image-viewer__clone";
    reverse.style.position = "fixed";
    reverse.style.left = `${target.left}px`;
    reverse.style.top = `${target.top}px`;
    reverse.style.width = `${target.width}px`;
    reverse.style.height = `${target.height}px`;
    reverse.style.transformOrigin = "top left";
    reverse.style.zIndex = "1000";
    reverse.style.willChange = "transform";
    document.body.appendChild(reverse);

    // Hide viewer content while clone animates out
    viewer.classList.add("is-animating");
    viewer.classList.remove("is-open");

    await waitFrame();

    const dx = endRect.left - target.left;
    const dy = endRect.top - target.top;
    const sx = endRect.width / target.width;
    const sy = endRect.height / target.height;

    reverse.style.transition = "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)";
    reverse.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    reverse.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "transform") return;

        clearTimeout(fail);
        viewer.dataset.closing = "0";

        reverse.remove();
        thumb.classList.remove("is-zoom-hidden");
        finishClose();
      },
      { once: true }
    );
  };

  // ---- Events ----
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img[data-zoomable]");
    if (!img) return;

    e.preventDefault();
    open(img);
  });

  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !viewer.hidden) close();
  });

  // Keep contain size correct when resizing
  window.addEventListener("resize", () => {
    if (viewer.hidden) return;
    setImgToContainRect();
  });
})();