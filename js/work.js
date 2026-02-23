(() => {
  // ===== Helpers =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // ===== DOM =====
  const workControls = $(".work-controls");
  if (!workControls) return; // Kör bara på work-sidan

  const filterButtons = $$(".work-filters .chip");
  const viewButtons = $$(".work-view .icon-button");

  const results = $("[data-work-results]");
  const gridPanel = $('[data-panel="grid"]');
  const listPanel = $('[data-panel="list"]');

  const gridItems = $$('[data-view-panel="grid"] .project-card');
  const listItems = $$('[data-view-panel="list"] .project-row');

  if (!results || !gridPanel || !listPanel) return;

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

    // Grid cards: data-tags="mobile web"
    // List rows: lägg gärna data-tags även där (se kommentar nedan).
    const tagsRaw = (el.dataset.tags || "").toLowerCase();
    const tags = tagsRaw.split(/\s+/).filter(Boolean);

    // Filterknappar: data-filter="mobile" / "web"
    return tags.includes(filter);
  };

  const applyFilterToCollection = (collection, filter) => {
    collection.forEach((item) => {
      const show = matchesFilter(item, filter);
      item.hidden = !show;
      // Valfritt: aria-hidden för extra tydlighet
      item.setAttribute("aria-hidden", show ? "false" : "true");
    });
  };

  const applyFilter = (filter) => {
    applyFilterToCollection(gridItems, filter);
    applyFilterToCollection(listItems, filter);

    // Uppdatera wrapperhöjd så det inte "hoppar"
    refreshResultsHeight();
  };

  // ===== Smooth panel switch (grid/list) =====
  const setViewSmooth = (view) => {
    const next = view === "list" ? listPanel : gridPanel;
    const prev = view === "list" ? gridPanel : listPanel;

    if (next.classList.contains("is-active")) return;

    // Om reduced motion: bara byt direkt
    if (prefersReducedMotion) {
      prev.classList.remove("is-active");
      next.classList.add("is-active");
      prev.hidden = true;
      next.hidden = false;
      results.style.height = "auto";
      return;
    }

    // Säkerställ att båda är "displayade" under mätningen
    prev.hidden = false;
    next.hidden = false;

    // Lås wrapper-höjden till nuvarande (prev)
    const prevHeight = prev.offsetHeight;
    results.style.height = `${prevHeight}px`;

    // Force reflow
    results.offsetHeight;

    // Växla active states (fade/slide)
    prev.classList.remove("is-active");
    next.classList.add("is-active");

    // Mät nästa höjd och animera wrapper
    const nextHeight = next.offsetHeight;
    results.style.height = `${nextHeight}px`;

    const onEnd = (e) => {
      if (e.propertyName !== "height") return;

      // Städa: göm den som inte är aktiv
      prev.hidden = true;
      next.hidden = false;

      // Släpp height
      results.style.height = "auto";

      results.removeEventListener("transitionend", onEnd);
    };

    results.addEventListener("transitionend", onEnd);
  };

  // ===== Height refresh (efter filter eller resize) =====
  const refreshResultsHeight = () => {
    const activePanel = $(".work-panel.is-active");
    if (!activePanel) return;

    // Om hidden är aktivt på panelen av misstag, säkerställ synlig för mätning
    activePanel.hidden = false;

    if (prefersReducedMotion) {
      results.style.height = "auto";
      return;
    }

    // Animera wrappern till panelens nya höjd (snyggt, men snabbt)
    const from = results.offsetHeight;
    results.style.height = `${from}px`;
    results.offsetHeight;

    const to = activePanel.offsetHeight;
    results.style.height = `${to}px`;

    const onEnd = (e) => {
      if (e.propertyName !== "height") return;
      results.style.height = "auto";
      results.removeEventListener("transitionend", onEnd);
    };
    results.addEventListener("transitionend", onEnd);
  };

  // ===== Init (panels + state) =====
  const initPanels = () => {
    // Säkerställ korrekt startläge
    const startView = state.view === "list" ? "list" : "grid";

    // Visa rätt panel, göm den andra
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

    // Sätt knappar + filter
    setViewButtonStates(startView);
    setFilterButtonStates(state.filter);

    // Applicera filter på båda
    applyFilter(state.filter);

    // Height ska vara auto efter init
    results.style.height = "auto";
  };

  // ===== Events =====
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter || "all";
      state.filter = filter;
      saveState(state);

      setFilterButtonStates(filter);
      applyFilter(filter);
      window.dispatchEvent(new Event("scroll"));
    });
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (!view) return;

      state.view = view;
      saveState(state);

      setViewButtonStates(view);
      setViewSmooth(view);
      window.dispatchEvent(new Event("scroll"));

      // efter view byte: säkerställ höjd matchar (om fonts/images påverkar)
      window.setTimeout(refreshResultsHeight, 50);
    });
  });

  // Uppdatera höjd vid resize (när layout bryter)
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