(() => {
  const viewer = document.querySelector("[data-image-viewer]");
  if (!viewer) return;

  const imgEl = viewer.querySelector("[data-image-viewer-img]");
  const closeBtn = viewer.querySelector("[data-image-viewer-close]");
  const overlay = viewer.querySelector(".image-viewer__overlay");

  if (!imgEl || !closeBtn || !overlay) return;

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  let activeThumb = null;
  let cloneEl = null;
  let lastFocused = null;
  let isOpen = false;
  let isClosing = false;
  let lockedScrollY = 0;

  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const OPEN_MS = 520;
  const CLOSE_MS = 480;
  const VIEWER_PADDING = 32;
  const VIEWER_MAX_W = 1440;

  const waitFrame = () =>
    new Promise((resolve) => requestAnimationFrame(resolve));

  const waitFrames = async (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      await waitFrame();
    }
  };

  const getZoomFrame = (thumb) =>
    thumb.closest(".work-detail__media, .project-card__media, figure") || thumb;

  const getRadius = (thumb) => {
    const frame = getZoomFrame(thumb);
    const styles = window.getComputedStyle(frame);
    return styles.borderRadius || "0px";
  };

  const lockScroll = () => {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;

    document.documentElement.classList.add("is-viewer-open");
    document.body.classList.add("is-viewer-locked");
    document.body.style.top = `-${lockedScrollY}px`;
  };

  const unlockScroll = () => {
    document.documentElement.classList.remove("is-viewer-open");
    document.body.classList.remove("is-viewer-locked");
    document.body.style.top = "";

    window.scrollTo(0, lockedScrollY);
  };

  const cleanupClone = () => {
    if (cloneEl) {
      cloneEl.remove();
      cloneEl = null;
    }

    if (activeThumb) {
      activeThumb.classList.remove("is-zoom-hidden");
    }
  };

  const resetViewer = () => {
    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");
    viewer.classList.remove("is-open", "is-ready", "is-animating");
    imgEl.removeAttribute("src");
    imgEl.removeAttribute("style");
  };

  const getContainRect = (
    naturalW,
    naturalH,
    padding = VIEWER_PADDING,
    maxW = VIEWER_MAX_W,
  ) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const availableW = Math.min(maxW, vw - padding * 2);
    const availableH = vh - padding * 2;
    const ratio = naturalW / naturalH;

    let width = availableW;
    let height = width / ratio;

    if (height > availableH) {
      height = availableH;
      width = height * ratio;
    }

    return {
      left: (vw - width) / 2,
      top: (vh - height) / 2,
      width,
      height,
    };
  };

  const applyViewerRect = () => {
    if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;

    const rect = getContainRect(imgEl.naturalWidth, imgEl.naturalHeight);
    imgEl.style.width = `${rect.width}px`;
    imgEl.style.height = `${rect.height}px`;
  };

  const createClone = (thumb, rect) => {
    const clone = thumb.cloneNode(true);
    clone.removeAttribute("data-zoomable");
    clone.className = "image-viewer__clone";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.transform = "translate3d(0,0,0) scale(1)";
    clone.style.opacity = "1";
    clone.style.borderRadius = getRadius(thumb);

    document.body.appendChild(clone);
    return clone;
  };

  const open = async (thumb) => {
    if (!thumb || isOpen || isClosing) return;

    isOpen = true;
    activeThumb = thumb;
    lastFocused = document.activeElement;

    if (!thumb.complete) {
      try {
        await thumb.decode();
      } catch {}
    }

    const startRect = thumb.getBoundingClientRect();
    const src = thumb.currentSrc || thumb.src;
    const radius = getRadius(thumb);

    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");
    viewer.classList.add("is-open", "is-animating");
    viewer.classList.remove("is-ready");

    imgEl.src = src;
    imgEl.alt = thumb.alt || "";
    imgEl.style.width = "";
    imgEl.style.height = "";
    imgEl.style.borderRadius = radius;

    lockScroll();

    try {
      await imgEl.decode();
    } catch {}

    const targetRect = getContainRect(imgEl.naturalWidth, imgEl.naturalHeight);

    if (prefersReducedMotion) {
      applyViewerRect();
      viewer.classList.remove("is-animating");
      viewer.classList.add("is-ready");
      closeBtn.focus({ preventScroll: true });
      return;
    }

    thumb.classList.add("is-zoom-hidden");
    cloneEl = createClone(thumb, startRect);

    await waitFrames(2);

    const dx = targetRect.left - startRect.left;
    const dy = targetRect.top - startRect.top;
    const sx = targetRect.width / startRect.width;
    const sy = targetRect.height / startRect.height;

    cloneEl.style.transition = `transform ${OPEN_MS}ms ${EASE}`;
    cloneEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;

    const fallback = window.setTimeout(() => {
      cleanupClone();
      applyViewerRect();
      viewer.classList.remove("is-animating");
      viewer.classList.add("is-ready");
      closeBtn.focus({ preventScroll: true });
    }, OPEN_MS + 100);

    cloneEl.addEventListener(
      "transitionend",
      (event) => {
        if (event.propertyName !== "transform") return;

        window.clearTimeout(fallback);
        cleanupClone();
        applyViewerRect();
        viewer.classList.remove("is-animating");
        viewer.classList.add("is-ready");
        closeBtn.focus({ preventScroll: true });
      },
      { once: true },
    );
  };

  const finishClose = () => {
    cleanupClone();
    resetViewer();
    unlockScroll();

    isOpen = false;
    isClosing = false;

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }

    activeThumb = null;
    lastFocused = null;
  };

  const close = async () => {
    if (!isOpen || isClosing) return;

    isClosing = true;
    viewer.classList.remove("is-ready");

    if (prefersReducedMotion || !activeThumb || !imgEl.naturalWidth) {
      finishClose();
      return;
    }

    const thumb = activeThumb;
    const endRect = thumb.getBoundingClientRect();
    const startRect = getContainRect(imgEl.naturalWidth, imgEl.naturalHeight);
    const radius = getRadius(thumb);

    const reverseClone = imgEl.cloneNode(true);
    reverseClone.className = "image-viewer__clone";
    reverseClone.style.left = `${startRect.left}px`;
    reverseClone.style.top = `${startRect.top}px`;
    reverseClone.style.width = `${startRect.width}px`;
    reverseClone.style.height = `${startRect.height}px`;
    reverseClone.style.transform = "translate3d(0,0,0) scale(1)";
    reverseClone.style.opacity = "1";
    reverseClone.style.borderRadius = radius;

    document.body.appendChild(reverseClone);
    thumb.classList.add("is-zoom-hidden");

    viewer.classList.add("is-animating");
    viewer.classList.remove("is-open");

    await waitFrames(2);

    const dx = endRect.left - startRect.left;
    const dy = endRect.top - startRect.top;
    const sx = endRect.width / startRect.width;
    const sy = endRect.height / startRect.height;

    reverseClone.style.transition = `transform ${CLOSE_MS}ms ${EASE}`;
    reverseClone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;

    const fallback = window.setTimeout(() => {
      reverseClone.remove();
      finishClose();
    }, CLOSE_MS + 100);

    reverseClone.addEventListener(
      "transitionend",
      (event) => {
        if (event.propertyName !== "transform") return;

        window.clearTimeout(fallback);
        reverseClone.remove();
        finishClose();
      },
      { once: true },
    );
  };

  document.addEventListener("click", (event) => {
    const thumb = event.target.closest("img[data-zoomable]");
    if (!thumb) return;

    event.preventDefault();
    open(thumb);
  });

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      close();
    }
  });

  window.addEventListener(
    "resize",
    () => {
      if (!isOpen || viewer.hidden || isClosing) return;
      applyViewerRect();
    },
    { passive: true },
  );

  resetViewer();
})();
