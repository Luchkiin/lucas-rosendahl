(() => {
  const GA_MEASUREMENT_ID = "G-X7223FT6X1";
  const COOKIE_STORAGE_KEY = "cookieConsent"; // "accepted" | "declined"

  let analyticsLoaded = false;
  let analyticsTrackingInitialized = false;
  let scrollTracked = false;

  // ===== Helpers =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const getCookie = (name) => {
    const match = document.cookie.match(
      new RegExp(
        `(?:^|; )${name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&")}=([^;]*)`,
      ),
    );
    return match ? decodeURIComponent(match[1]) : null;
  };

  const getConsent = () => {
    try {
      return (
        localStorage.getItem(COOKIE_STORAGE_KEY) ||
        getCookie(COOKIE_STORAGE_KEY)
      );
    } catch {
      return getCookie(COOKIE_STORAGE_KEY);
    }
  };

  const setConsent = (value) => {
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, value);
    } catch {
      // ignore localStorage errors
    }

    document.cookie = `${COOKIE_STORAGE_KEY}=${encodeURIComponent(
      value,
    )}; Path=/; Max-Age=15552000; SameSite=Lax`;
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve(existing);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });

  const track = (eventName, params = {}) => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", eventName, params);
  };

  const getCaseTitle = () => {
    const titleEl = document.querySelector("#case-title");
    return titleEl ? titleEl.textContent.trim() : document.title;
  };

  const getLinkType = (href) => {
    if (!href) return null;
    if (href.startsWith("mailto:")) return "email";
    if (href.startsWith("tel:")) return "phone";
    if (href.startsWith("#")) return "anchor";

    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin ? "internal" : "external";
    } catch {
      return null;
    }
  };

  // ===== Analytics =====
  const initAnalyticsTracking = () => {
    if (analyticsTrackingInitialized) return;
    analyticsTrackingInitialized = true;

    const body = document.body;
    const isWorkPage = body.classList.contains("page-work");
    const isWorkDetailPage = body.classList.contains("page-work-detail");

    if (isWorkPage) {
      track("work_view");
    }

    if (isWorkDetailPage) {
      track("case_open", {
        case_name: getCaseTitle(),
      });
    }

    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      const linkType = getLinkType(href);

      if (linkType === "external") {
        track("external_link_click", {
          link_url: link.href,
          link_text:
            link.textContent.trim() ||
            link.getAttribute("aria-label") ||
            "unknown",
          page_path: window.location.pathname,
        });
      }

      if (linkType === "email") {
        track("email_click", {
          email_address: href.replace("mailto:", ""),
          page_path: window.location.pathname,
        });
      }

      if (linkType === "phone") {
        track("phone_click", {
          phone_number: href.replace("tel:", ""),
          page_path: window.location.pathname,
        });
      }
    });

    if (isWorkPage) {
      const filterButtons = $$(".work-filters .chip");
      const viewButtons = $$(".work-view .icon-button");

      filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const filter = button.dataset.filter || "unknown";

          track("work_filter_click", {
            filter_name: filter,
          });
        });
      });

      viewButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const view = button.dataset.view || "unknown";

          track("work_view_toggle", {
            view_type: view,
          });
        });
      });
    }

    if (isWorkDetailPage) {
      const visitWebsiteBtn = document.querySelector(".work-detail__cta");

      if (visitWebsiteBtn) {
        visitWebsiteBtn.addEventListener("click", () => {
          track("case_cta_click", {
            case_name: getCaseTitle(),
            cta_name: "visit_website",
            cta_url: visitWebsiteBtn.href,
          });
        });
      }
    }

    window.addEventListener(
      "scroll",
      () => {
        if (scrollTracked) return;

        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;

        const scrollPercent = (window.scrollY / docHeight) * 100;

        if (scrollPercent >= 75) {
          track("scroll_depth", {
            percent: 75,
            page_path: window.location.pathname,
          });
          scrollTracked = true;
        }
      },
      { passive: true },
    );
  };

  const enableOptionalCookies = async () => {
    if (analyticsLoaded) return;

    try {
      await loadScript(
        `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
      );

      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function () {
          window.dataLayer.push(arguments);
        };

      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, {
        send_page_view: true,
      });

      analyticsLoaded = true;
      initAnalyticsTracking();
    } catch (error) {
      console.error("Failed to load analytics:", error);
    }
  };

  const disableOptionalCookies = () => {
    analyticsLoaded = false;
    analyticsTrackingInitialized = false;
    scrollTracked = false;
  };

  // ===== Cookie consent =====
  (() => {
    const banner = document.querySelector("[data-cookie-consent]");
    if (!banner) return;

    const showBanner = () => {
      banner.hidden = false;
      banner.classList.remove("is-leaving");
      banner.classList.add("is-entering");

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
        if (content && e.target !== content) return;
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

    banner.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-consent]");
      if (!btn) return;

      const choice = btn.getAttribute("data-consent");
      if (choice === "accept") handleChoice("accepted");
      if (choice === "decline") handleChoice("declined");
    });

    const consent = getConsent();

    if (!consent) {
      showBanner();
    } else if (consent === "accepted") {
      enableOptionalCookies();
    }
  })();

  // ===== Mobile menu =====
  (() => {
    const root = document.documentElement;
    const toggleBtn = document.querySelector(".menu-toggle");
    const closeBtn = document.querySelector(".menu-close");
    const menu = document.getElementById("mobile-menu");
    const list = menu?.querySelector(".mobile-menu__list");

    if (!toggleBtn || !menu || !list) return;

    const getItems = () =>
      Array.from(list.querySelectorAll(".mobile-menu__item"));

    const base = 180;
    const step = 80;

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

    if (prefersReducedMotion) {
      getItems().forEach((item) => {
        item.style.setProperty("--stagger-delay", "0ms");
      });
    }
  })();


  // ===== Footer year =====
  (() => {
    const yearEl = document.getElementById("year");
    if (!yearEl) return;
    yearEl.textContent = new Date().getFullYear();
  })();
})();
