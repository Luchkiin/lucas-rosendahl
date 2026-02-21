(() => {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  const fields = Array.from(form.querySelectorAll(".field"));
  const inputs = Array.from(
    form.querySelectorAll(".field__input, .field__textarea"),
  );
  const statusEl = form.querySelector(".contact-form__status");
  const submitBtn = form.querySelector('button[type="submit"]');

  const showStatus = (type, message) => {
    if (!statusEl) return;
    statusEl.textContent = message;

    statusEl.classList.remove("is-success", "is-error");
    statusEl.classList.add(
      "is-visible",
      type === "success" ? "is-success" : "is-error",
    );

    statusEl.hidden = false; // SUPERviktigt (annars syns aldrig)
  };

  const hideStatus = () => {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("is-visible", "is-success", "is-error");
  };

  const setFieldState = (input, isValid, message = "") => {
    const field = input.closest(".field");
    const errorEl = field?.querySelector(".field__error");

    field?.classList.toggle("is-valid", isValid);
    field?.classList.toggle("is-invalid", !isValid);

    // a11y
    input.toggleAttribute("aria-invalid", !isValid);

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = isValid || !message;
    }
  };

  const validateInput = (input) => {
    const value = input.value.trim();

    // required
    if (input.hasAttribute("required") && !value) {
      setFieldState(input, false, "This field is required.");
      return false;
    }

    // minlength (för både input + textarea)
    const min = input.getAttribute("minlength");
    if (min && value.length && value.length < Number(min)) {
      setFieldState(input, false, `Please enter at least ${min} characters.`);
      return false;
    }

    // email format
    if (input.type === "email" && value) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!ok) {
        setFieldState(input, false, "Enter a valid email address.");
        return false;
      }
    }

    setFieldState(input, true, "");
    return true;
  };

  const validateForm = () => inputs.every((i) => validateInput(i));

  // Live validation + rensa status när man börjar skriva igen
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      hideStatus();
      validateInput(input);
    });
    input.addEventListener("blur", () => validateInput(input));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideStatus();

    const ok = validateForm();
    if (!ok) {
      const firstInvalid = form.querySelector(
        ".field.is-invalid .field__input, .field.is-invalid .field__textarea",
      );
      firstInvalid?.focus({ preventScroll: false });
      return;
    }

    submitBtn?.setAttribute("disabled", "disabled");

    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });

      // Formspree skickar ofta JSON med { ok: true } vid success
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false))
        throw new Error("Request failed");

      form.reset();
      fields.forEach((f) => f.classList.remove("is-valid", "is-invalid"));

      showStatus("success", "Message sent! I’ll get back to you soon.");
      statusEl?.focus?.({ preventScroll: true });
    } catch {
      showStatus("error", "Something went wrong. Please try again.");
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });
})();
