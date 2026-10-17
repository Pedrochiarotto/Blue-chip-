(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setupCarousel(root, prefix) {
    const track = root.querySelector(`.${prefix}__track`);
    const slides = Array.from(root.querySelectorAll(`.${prefix}__slide`));
    const btnPrev = root.querySelector(`.${prefix}__btn.prev`);
    const btnNext = root.querySelector(`.${prefix}__btn.next`);
    const dotsHost = root.querySelector(`.${prefix}__dots`);
    const position = root.querySelector(".carousel-position");
    const viewport = root.querySelector(`.${prefix}__viewport`);
    const status = root.querySelector(".carousel-status");
    if (!track || !viewport || slides.length === 0) return;

    let index = 0;
    let autoplayTimer = null;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let suppressClick = false;
    let autoplayDirection = 1;
    const threshold = 40;

    slides.forEach((slide, slideIndex) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${slideIndex + 1} de ${slides.length}`);
    });

    const update = (announce = false) => {
      track.style.transform = `translate3d(${-index * 100}%,0,0)`;
      slides.forEach((slide, slideIndex) => slide.setAttribute("aria-hidden", String(slideIndex !== index)));
      if (dotsHost) {
        dotsHost.querySelectorAll(`.${prefix}__dot`).forEach((dot, dotIndex) => {
          const active = dotIndex === index;
          dot.classList.toggle("is-active", active);
          dot.setAttribute("aria-selected", String(active));
          dot.tabIndex = active ? 0 : -1;
        });
      }
      if (btnPrev) btnPrev.disabled = index === 0;
      if (btnNext) btnNext.disabled = index === slides.length - 1;
      if (position) position.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      if (prefix === "flyer-carousel") {
        root.closest(".schedule-section")?.querySelectorAll(".schedule-item").forEach((item, itemIndex) => {
          const active = itemIndex === index;
          item.classList.toggle("is-active", active);
          if (active) item.setAttribute("aria-current", "true");
          else item.removeAttribute("aria-current");
        });
      }
      if (announce && status) status.textContent = `Item ${index + 1} de ${slides.length}`;
      root.dispatchEvent(new CustomEvent("bluechip:slide-change", {
        detail: { index, total: slides.length }
      }));
    };

    const goTo = (nextIndex, announce = true) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex));
      autoplayDirection = clamped < index ? -1 : clamped > index ? 1 : autoplayDirection;
      index = clamped;
      update(announce);
    };

    if (dotsHost) {
      dotsHost.innerHTML = "";
      slides.forEach((_, slideIndex) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `${prefix}__dot`;
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", `Mostrar item ${slideIndex + 1}`);
        dot.addEventListener("click", () => goTo(slideIndex));
        dotsHost.appendChild(dot);
      });
    }

    const stopAutoplay = () => {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (root.dataset.autoplay !== "true" || slides.length <= 1 || reduceMotion.matches || document.hidden) return;
      const interval = Number.parseInt(root.dataset.interval || "4500", 10);
      autoplayTimer = window.setInterval(() => {
        if (index === slides.length - 1) autoplayDirection = -1;
        if (index === 0) autoplayDirection = 1;
        goTo(index + autoplayDirection, false);
      }, Number.isFinite(interval) ? interval : 4500);
    };

    btnPrev?.addEventListener("click", () => goTo(index - 1));
    btnNext?.addEventListener("click", () => goTo(index + 1));
    root.addEventListener("bluechip:go-to", (event) => {
      const targetIndex = Number(event.detail?.index);
      if (Number.isInteger(targetIndex)) {
        goTo(targetIndex);
        stopAutoplay();
      }
    });

    const onDown = (x) => {
      isDragging = true;
      suppressClick = false;
      startX = x;
      currentX = x;
      track.classList.add("is-dragging");
      stopAutoplay();
    };

    const onMove = (x) => {
      if (!isDragging) return;
      currentX = x;
      const delta = currentX - startX;
      if (Math.abs(delta) > 8) suppressClick = true;
      track.style.transform = `translate3d(calc(${-index * 100}% + ${delta * 0.15}px),0,0)`;
    };

    const onUp = () => {
      if (!isDragging) return;
      isDragging = false;
      track.classList.remove("is-dragging");
      const delta = currentX - startX;
      if (Math.abs(delta) >= threshold) goTo(index + (delta < 0 ? 1 : -1));
      else update(false);
      startAutoplay();
      window.setTimeout(() => { suppressClick = false; }, 0);
    };

    viewport.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      viewport.setPointerCapture?.(event.pointerId);
      onDown(event.clientX);
    });
    viewport.addEventListener("pointermove", (event) => onMove(event.clientX));
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); goTo(index + 1); }
    });
    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);
    root.addEventListener("focusin", stopAutoplay);
    root.addEventListener("focusout", startAutoplay);
    document.addEventListener("visibilitychange", () => document.hidden ? stopAutoplay() : startAutoplay());
    reduceMotion.addEventListener?.("change", startAutoplay);

    update(false);
    startAutoplay();
  }

  window.addEventListener("bluechip:data-ready", () => {
    document.querySelectorAll(".dish-carousel").forEach((element) => setupCarousel(element, "dish-carousel"));
    document.querySelectorAll(".flyer-carousel").forEach((element) => setupCarousel(element, "flyer-carousel"));
  }, { once: true });
})();
