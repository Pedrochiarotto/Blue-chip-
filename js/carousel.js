(() => {
  function setupCarousel(root, prefix) {
    const track = root.querySelector(`.${prefix}__track`);
    const slides = Array.from(root.querySelectorAll(`.${prefix}__slide`));
    const btnPrev = root.querySelector(`.${prefix}__btn.prev`);
    const btnNext = root.querySelector(`.${prefix}__btn.next`);
    const dotsHost = root.querySelector(`.${prefix}__dots`);
    const viewport = root.querySelector(`.${prefix}__viewport`);

    if (!track || slides.length === 0) return;

    let index = 0;
    let autoplayTimer = null;

    // swipe/drag
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    const threshold = 40;

    function clamp(n) {
      return Math.max(0, Math.min(slides.length - 1, n));
    }

    function update() {
      track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
      if (!dotsHost) return;

      const dots = Array.from(dotsHost.querySelectorAll(`.${prefix}__dot`));
      dots.forEach((d, i) => {
        const active = i === index;
        d.classList.toggle("is-active", active);
        d.setAttribute("aria-current", active ? "true" : "false");
      });
    }

    function goTo(i) {
      index = clamp(i);
      update();
    }
    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    // dots
    if (dotsHost) {
      dotsHost.innerHTML = "";
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `${prefix}__dot`;
        dot.setAttribute("aria-label", `Ir para o slide ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dotsHost.appendChild(dot);
      });
    }

    // botões
    if (btnNext) btnNext.addEventListener("click", next);
    if (btnPrev) btnPrev.addEventListener("click", prev);

    // drag handlers
    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      const wantsAutoplay = root.dataset.autoplay === "true";
      const interval = parseInt(root.dataset.interval || "4500", 10);
      if (!wantsAutoplay || slides.length <= 1) return;

      stopAutoplay();
      autoplayTimer = setInterval(() => {
        index = (index + 1) % slides.length;
        update();
      }, Number.isFinite(interval) ? interval : 4500);
    }

    function onDown(x) {
      isDragging = true;
      startX = x;
      currentX = x;
      track.classList.add("is-dragging");
      stopAutoplay();
    }

    function onMove(x) {
      if (!isDragging) return;
      currentX = x;
      const dx = currentX - startX;
      track.style.transform = `translate3d(${-index * 100}%, 0, 0) translateX(${dx * 0.15}px)`;
    }

    function onUp() {
      if (!isDragging) return;
      isDragging = false;
      track.classList.remove("is-dragging");

      const dx = currentX - startX;
      if (Math.abs(dx) >= threshold) dx < 0 ? next() : prev();
      else update();

      startAutoplay();
    }

    if (viewport) {
      viewport.addEventListener("touchstart", (e) => onDown(e.touches[0].clientX), { passive: true });
      viewport.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX), { passive: true });
      viewport.addEventListener("touchend", onUp);

      viewport.addEventListener("mousedown", (e) => { e.preventDefault(); onDown(e.clientX); });
      window.addEventListener("mousemove", (e) => onMove(e.clientX));
      window.addEventListener("mouseup", onUp);
    }

    // teclado
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    });

    // pausa no hover (desktop)
    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);

    update();
    startAutoplay();
  }

  document.querySelectorAll(".dish-carousel").forEach((el) => setupCarousel(el, "dish-carousel"));
  document.querySelectorAll(".flyer-carousel").forEach((el) => setupCarousel(el, "flyer-carousel"));
})();
