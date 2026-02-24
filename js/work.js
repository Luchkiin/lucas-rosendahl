(() => {
  // ===== Helpers =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;

  // ===== DOM =====
  const workControls = $(".work-controls");
  if (!workControls) return;

  const filterButtons = $$(".work-filters .chip");
  const viewWrap = $(".work-view");
  const viewButtons = $$(".work-view .icon-button");

  const results = $("[data-work-results]");
  const gridPanel = $('[data-panel="grid"]');
  const listPanel = $('[data-panel="list"]');

  if (!viewWrap || !results || !gridPanel || !listPanel) return;

  // Items
  const gridItems = $$('[data-view-panel="grid"] .project-card');
  const listItems = $$('[data-view-panel="list"] .project-row');

  // ===== Config =====
  const FILTER_FADE_MS = 220; // matchar ~240ms CSS-känsla
  const CLEANUP_MS = 340;
  const VIEW_HEIGHT_SETTLE_MS = 60;

  // ===== State =====
  const STORAGE_KEY = "workPageState";
  const defaultState = { view: "grid", filter: "all" };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
    } catch {
      return defaultState;
    }
  };

  const saveState = (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  };

  let state = loadState();

  // ===== UI setters =====
  const setFilterButtonStates = (filter) => {
    filterButtons.forEach((btn) => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const setViewButtonStates = (view) => {
    viewButtons.forEach((btn) => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  // ===== Sliding pill =====
  const setViewPill = () => {
    const activeBtn = viewWrap.querySelector(".icon-button.is-active");
    if (!activeBtn) return;

    // ::before har left/top = 3px -> aligna mot det
    const x = activeBtn.offsetLeft - 3;
    const w = activeBtn.offsetWidth;

    viewWrap.style.setProperty("--pill-x", `${x}px`);
    viewWrap.style.setProperty("--pill-w", `${w}px`);
  };

  // ===== FIX: Mobile floating position (teleport to body) =====
  // Gör att den inte hamnar "inne i" layout/overflow nära footer.
  const originalParent = viewWrap.parentElement;
  const originalNext = viewWrap.nextElementSibling;
  const mqMobile =
    window.matchMedia?.("(max-width: 767px)") || { matches: false };

  const moveWorkView = () => {
    const isMobile = mqMobile.matches;

    if (isMobile) {
      if (viewWrap.parentElement !== document.body) {
        document.body.appendChild(viewWrap);
      }
      viewWrap.classList.add("is-floating");
    } else {
      if (viewWrap.parentElement !== originalParent) {
        if (originalNext) originalParent.insertBefore(viewWrap, originalNext);
        else originalParent.appendChild(viewWrap);
      }
      viewWrap.classList.remove("is-floating");
    }

    // Pill måste beräknas om efter flytt/layout
    requestAnimationFrame(setViewPill);
  };

  moveWorkView();
  if (mqMobile.addEventListener) mqMobile.addEventListener("change", moveWorkView);
  else if (mqMobile.addListener) mqMobile.addListener(moveWorkView);
  // ===== /FIX =====

  // ===== Filtering =====
  const matchesFilter = (el, filter) => {
    if (filter === "all") return true;
    const tagsRaw = (el.dataset.tags || "").toLowerCase();
    const tags = tagsRaw.split(/\s+/).filter(Boolean);
    return tags.includes(filter);
  };

  // ===== Panel helpers =====
  const getActivePanel = () => $(".work-panel.is-active");

  const getActiveItems = () => {
    const panel = getActivePanel();
    if (!panel) return [];
    return $$("[data-tags]", panel);
  };

  const getVisibleItemsInActivePanel = () =>
    getActiveItems().filter((el) => !el.hidden);

  // ===== Visual classes =====
  const setVisualHidden = (el) => {
    el.classList.add("is-filter-hidden");
    el.classList.remove("is-filter-visible");
  };

  const setVisualVisible = (el) => {
    el.classList.add("is-filter-visible");
    el.classList.remove("is-filter-hidden");
  };

  // ===== Height refresh =====
  const refreshResultsHeight = () => {
    const activePanel = getActivePanel();
    if (!activePanel) return;

    activePanel.hidden = false;

    if (prefersReducedMotion) {
      results.style.height = "auto";
      return;
    }

    const from = results.offsetHeight;
    results.style.height = `${from}px`;
    void results.offsetHeight;

    const to = activePanel.offsetHeight;
    results.style.height = `${to}px`;

    const onEnd = (e) => {
      if (e.propertyName !== "height") return;
      results.style.height = "auto";
      results.removeEventListener("transitionend", onEnd);
    };
    results.addEventListener("transitionend", onEnd);
  };

  // ===== Apply filter NOW =====
  const applyFilterNow = (filter) => {
    gridItems.forEach((item) => {
      const show = matchesFilter(item, filter);
      item.hidden = !show;
      item.setAttribute("aria-hidden", show ? "false" : "true");
    });

    listItems.forEach((item) => {
      const show = matchesFilter(item, filter);
      item.hidden = !show;
      item.setAttribute("aria-hidden", show ? "false" : "true");
    });
  };

  // ===== Smooth filter animation =====
  const applyFilterAnimated = (filter) => {
    if (prefersReducedMotion) {
      applyFilterNow(filter);
      getVisibleItemsInActivePanel().forEach(setVisualVisible);
      refreshResultsHeight();
      return;
    }

    document.documentElement.classList.add("work-is-filtering");

    // lås height före fade (stabil layout)
    const fromHeight = getActivePanel()?.offsetHeight ?? results.offsetHeight;
    results.style.height = `${fromHeight}px`;
    void results.offsetHeight;

    // fade out nuvarande synliga (utan hidden)
    const beforeVisible = getVisibleItemsInActivePanel();
    beforeVisible.forEach(setVisualHidden);

    window.setTimeout(() => {
      applyFilterNow(filter);

      const afterVisible = getVisibleItemsInActivePanel();

      // init-state för fade-in
      afterVisible.forEach(setVisualHidden);
      void results.offsetHeight;
      afterVisible.forEach(setVisualVisible);

      refreshResultsHeight();

      window.setTimeout(() => {
        results.style.height = "auto";
        document.documentElement.classList.remove("work-is-filtering");
      }, CLEANUP_MS);
    }, FILTER_FADE_MS);
  };

  // ===== Smooth panel switch (grid/list) =====
  const setViewSmooth = (view) => {
    const next = view === "list" ? listPanel : gridPanel;
    const prev = view === "list" ? gridPanel : listPanel;

    if (next.classList.contains("is-active")) return;

    if (prefersReducedMotion) {
      prev.classList.remove("is-active");
      next.classList.add("is-active");
      prev.hidden = true;
      next.hidden = false;
      results.style.height = "auto";
      getVisibleItemsInActivePanel().forEach(setVisualVisible);
      return;
    }

    prev.hidden = false;
    next.hidden = false;

    const prevHeight = prev.offsetHeight;
    results.style.height = `${prevHeight}px`;
    void results.offsetHeight;

    prev.classList.remove("is-active");
    next.classList.add("is-active");

    const nextHeight = next.offsetHeight;
    results.style.height = `${nextHeight}px`;

    const onEnd = (e) => {
      if (e.propertyName !== "height") return;

      prev.hidden = true;
      next.hidden = false;
      results.style.height = "auto";
      results.removeEventListener("transitionend", onEnd);

      getVisibleItemsInActivePanel().forEach(setVisualVisible);
    };

    results.addEventListener("transitionend", onEnd);
  };

  // ===== Init =====
  const initPanels = () => {
    const startView = state.view === "list" ? "list" : "grid";
    const startFilter = state.filter || "all";

    if (startView === "list") {
      listPanel.hidden = false;
      listPanel.classList.add("is-active");
      gridPanel.hidden = true;
      gridPanel.classList.remove("is-active");
    } else {
      gridPanel.hidden = false;
      gridPanel.classList.add("is-active");
      listPanel.hidden = true;
      listPanel.classList.remove("is-active");
    }

    setViewButtonStates(startView);
    setFilterButtonStates(startFilter);

    applyFilterNow(startFilter);

    // init visuals
    getVisibleItemsInActivePanel().forEach(setVisualVisible);
    results.style.height = "auto";

    requestAnimationFrame(setViewPill);
  };

  // ===== Events =====
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter || "all";
      if (state.filter === filter) return;

      state.filter = filter;
      saveState(state);

      setFilterButtonStates(filter);
      applyFilterAnimated(filter);
    });
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (!view) return;
      if (state.view === view) return;

      state.view = view;
      saveState(state);

      setViewButtonStates(view);
      requestAnimationFrame(setViewPill);
      setViewSmooth(view);

      window.setTimeout(refreshResultsHeight, VIEW_HEIGHT_SETTLE_MS);
    });
  });

  window.addEventListener(
    "resize",
    () => {
      refreshResultsHeight();
      setViewPill();
    },
    { passive: true }
  );

  // ===== Kickoff =====
  initPanels();
})();