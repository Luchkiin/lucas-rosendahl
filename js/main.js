(() => {
  const STORAGE_KEY = "cookieConsent"; // "accepted" | "declined"
  const banner = document.querySelector("[data-cookie-consent]");
  if (!banner) return;

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const getConsent = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const setConsent = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // fallback: cookie 6 months
      document.cookie = `${STORAGE_KEY}=${value}; Path=/; Max-Age=15552000; SameSite=Lax`;
    }
  };

  const enableOptionalCookies = () => {
    // Här aktiverar du sådant du vill kräva "Accept" för (ex: analytics).
    // Exempel: ladda script först efter accept.
    // loadScript("https://example.com/analytics.js");
  };

  const disableOptionalCookies = () => {
    // Om du vill: stäng av/ta bort icke-nödvändiga cookies här.
    // Obs: du kan inte alltid radera 3rd party-cookies fullt ut från JS.
  };

  const showBanner = () => {
    banner.hidden = false;

    // Start state (off-screen) -> enter animation
    banner.classList.remove("is-leaving");
    banner.classList.add("is-entering");

    // trigga transition (nästa frame)
    requestAnimationFrame(() => {
      banner.classList.add("is-visible");
      banner.classList.remove("is-entering");
    });
  };

  const hideBanner = () => {
    const content = banner.querySelector(".cookie-consent__content");

    banner.classList.add("is-leaving");
    banner.classList.remove("is-visible");

    const done = (e) => {
      if (content && e.target !== content) return; // säkerställ rätt element
      banner.hidden = true;
      banner.classList.remove("is-leaving");
      content?.removeEventListener("transitionend", done);
    };

    if (prefersReducedMotion) {
      done({ target: content });
      return;
    }

    content?.addEventListener("transitionend", done);
  };

  const handleChoice = (choice) => {
    setConsent(choice);

    if (choice === "accepted") enableOptionalCookies();
    if (choice === "declined") disableOptionalCookies();

    hideBanner();
  };

  // Wire up buttons
  banner.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-consent]");
    if (!btn) return;

    const choice = btn.getAttribute("data-consent");
    if (choice === "accept") handleChoice("accepted");
    if (choice === "decline") handleChoice("declined");
  });

  // Init
  const consent = getConsent();
  if (!consent) {
    showBanner();
  } else if (consent === "accepted") {
    enableOptionalCookies();
  }
})();

(() => {
  const root = document.documentElement;

  const toggleBtn = document.querySelector(".menu-toggle");
  const closeBtn = document.querySelector(".menu-close");
  const menu = document.getElementById("mobile-menu");
  const list = menu?.querySelector(".mobile-menu__list");

  if (!toggleBtn || !menu || !list) return;

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const getItems = () =>
    Array.from(list.querySelectorAll(".mobile-menu__item"));

  const base = 180; // första item-delay
  const step = 80; // spacing per item

  const applyOpenStagger = () => {
    const items = getItems();
    items.forEach((item, i) => {
      item.style.setProperty("--stagger-delay", `${base + i * step}ms`);
    });
  };

  const openMenu = () => {
    applyOpenStagger();
    root.classList.add("is-menu-open");
    toggleBtn.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
  };

  const closeMenu = () => {
    root.classList.remove("is-menu-open");
    toggleBtn.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");

    // Optional: nollställ inline delays om du vill
    // getItems().forEach((item) => item.style.removeProperty("--stagger-delay"));
  };

  toggleBtn.addEventListener("click", () => {
    root.classList.contains("is-menu-open") ? closeMenu() : openMenu();
  });

  closeBtn?.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  menu.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link) closeMenu();
  });

  // Reduced motion: ta bort stagger känslan helt (valfritt)
  if (prefersReducedMotion) {
    getItems().forEach((item) =>
      item.style.setProperty("--stagger-delay", "0ms"),
    );
  }
})();

(() => {
  const yearEl = document.getElementById("year");
  if (!yearEl) return;

  yearEl.textContent = new Date().getFullYear();
})();
