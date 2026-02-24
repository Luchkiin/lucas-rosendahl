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
  const viewButtons = $$(".work-view .icon-button");

  const results = $("[data-work-results]");
  const gridPanel = $('[data-panel="grid"]');
  const listPanel = $('[data-panel="list"]');

  if (!results || !gridPanel || !listPanel) return;

  // Items
  const gridItems = $$('[data-view-panel="grid"] .project-card');
  const listItems = $$('[data-view-panel="list"] .project-row');

  // ===== Config =====
  const FILTER_FADE_MS = 220; // matcha din CSS (~240ms)
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

  // ===== UI state setters =====
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

  // ===== Filtering logic =====
  const matchesFilter = (el, filter) => {
    if (filter === "all") return true;
    const tagsRaw = (el.dataset.tags || "").toLowerCase();
    const tags = tagsRaw.split(/\s+/).filter(Boolean);
    return tags.includes(filter);
  };

  // ===== Active-panel helpers =====
  const getActivePanel = () => $(".work-panel.is-active");

  const getActiveItems = () => {
    const panel = getActivePanel();
    if (!panel) return [];
    // Både cards & rows har data-tags
    return $$("[data-tags]", panel);
  };

  const getVisibleItemsInActivePanel = () =>
    getActiveItems().filter((el) => !el.hidden);

  // Force-reveal för list rows som annars väntar på scroll
  const forceRevealIfNeeded = (el) => {
    // reveal.js använder class + data-revealed
    if (el.hasAttribute("data-reveal") && el.getAttribute("data-revealed") !== "true") {
      el.classList.add("is-revealed");
      el.setAttribute("data-revealed", "true");
    }
  };

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
    // force reflow
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

  // ===== Apply filter (no animation, used internally) =====
  const applyFilterNow = (filter) => {
    // Grid
    gridItems.forEach((item) => {
      const show = matchesFilter(item, filter);
      item.hidden = !show;
      item.setAttribute("aria-hidden", show ? "false" : "true");
    });

    // List
    listItems.forEach((item) => {
      const show = matchesFilter(item, filter);
      item.hidden = !show;
      item.setAttribute("aria-hidden", show ? "false" : "true");
    });
  };

  // ===== Smooth filter animation (grid + list) =====
  const applyFilterAnimated = (filter) => {
    if (prefersReducedMotion) {
      applyFilterNow(filter);
      // Säkerställ att list-rows inte “saknas”
      getVisibleItemsInActivePanel().forEach(forceRevealIfNeeded);
      refreshResultsHeight();
      return;
    }

    document.documentElement.classList.add("work-is-filtering");

    // 1) lås wrapper-höjd på nuvarande state (stabil layout under fade-out)
    const fromHeight = getActivePanel()?.offsetHeight ?? results.offsetHeight;
    results.style.height = `${fromHeight}px`;
    void results.offsetHeight;

    // 2) fade out nuvarande synliga (utan att hidden)
    const beforeVisible = getVisibleItemsInActivePanel();
    beforeVisible.forEach(setVisualHidden);

    // 3) efter fade-out: toggla hidden + fade in de nya
    window.setTimeout(() => {
      // Apply hidden/show
      applyFilterNow(filter);

      // Viktigt: “force reveal” på synliga list rows efter filter
      const afterVisible = getVisibleItemsInActivePanel();
      afterVisible.forEach(forceRevealIfNeeded);

      // Starta nya synliga i hidden-visual state (för att kunna animera in)
      afterVisible.forEach(setVisualHidden);

      // force reflow innan vi slår på visible
      void results.offsetHeight;

      // 4) fade in
      afterVisible.forEach(setVisualVisible);

      // 5) animera höjd till nya panelhöjden
      refreshResultsHeight();

      // 6) släpp lås efter att höjden hunnit sätta sig lite
      window.setTimeout(() => {
        results.style.height = "auto";
        document.documentElement.classList.remove("work-is-filtering");
      }, 340);
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
      // efter view byte: se till att synliga items är “visible”
      getVisibleItemsInActivePanel().forEach((el) => {
        forceRevealIfNeeded(el);
        setVisualVisible(el);
      });
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

      // init visuals + reveal safety
      const afterVisible = getVisibleItemsInActivePanel();
      afterVisible.forEach((el) => {
        forceRevealIfNeeded(el);
        setVisualVisible(el);
      });
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

    // Visual init: synliga ska vara visible + (för list) revealade
    getVisibleItemsInActivePanel().forEach((el) => {
      forceRevealIfNeeded(el);
      setVisualVisible(el);
    });

    results.style.height = "auto";
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
      setViewSmooth(view);

      window.setTimeout(refreshResultsHeight, VIEW_HEIGHT_SETTLE_MS);
    });
  });

  window.addEventListener(
    "resize",
    () => {
      refreshResultsHeight();
    },
    { passive: true }
  );

  // ===== Kickoff =====
  initPanels();
})();