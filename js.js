// Ano automático no footer
    document.getElementById("year").textContent = new Date().getFullYear();

    // Menu mobile (hamburger)
    (function () {
      const hamburger = document.getElementById("hamburger");
      const navLinks = document.getElementById("navLinks");
      if (!hamburger || !navLinks) return;

      function closeMenu() {
        navLinks.classList.remove("open");
        hamburger.classList.remove("active");
        hamburger.setAttribute("aria-label", "Abrir menu");
      }

      hamburger.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        hamburger.classList.toggle("active", isOpen);
        hamburger.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
      });

      navLinks.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", closeMenu);
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth > 920) closeMenu();
      });
    })();

    // Carrossel de pratos (setas + dots + swipe + autoplay opcional)
    (function () {
      const carousels = document.querySelectorAll(".dish-carousel");
      if (!carousels.length) return;

      function setupCarousel(root) {
        const track = root.querySelector(".dish-carousel__track");
        const slides = Array.from(root.querySelectorAll(".dish-carousel__slide"));
        const btnPrev = root.querySelector(".dish-carousel__btn.prev");
        const btnNext = root.querySelector(".dish-carousel__btn.next");
        const dotsHost = root.querySelector(".dish-carousel__dots");

        if (!track || slides.length === 0) return;

        let index = 0;
        let autoplayTimer = null;
        let isDragging = false;
        let startX = 0;
        let currentX = 0;

        // Dots
        if (dotsHost) {
          dotsHost.innerHTML = "";
          slides.forEach((_, i) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "dish-carousel__dot";
            dot.setAttribute("aria-label", `Ir para o prato ${i + 1}`);
            dot.addEventListener("click", () => goTo(i));
            dotsHost.appendChild(dot);
          });
        }

        function clamp(n) {
          return Math.max(0, Math.min(slides.length - 1, n));
        }

        function update() {
          slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
          if (dotsHost) {
            const dots = Array.from(dotsHost.querySelectorAll(".dish-carousel__dot"));
            dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
          }
          const pct = -(index * 100);
          track.style.transform = `translate3d(${pct}%, 0, 0)`;
        }

        function goTo(i) {
          index = clamp(i);
          update();
        }

        function next() {
          goTo(index + 1);
        }

        function prev() {
          goTo(index - 1);
        }

        // Buttons
        if (btnNext) btnNext.addEventListener("click", next);
        if (btnPrev) btnPrev.addEventListener("click", prev);

        // Touch / drag
        const viewport = root.querySelector(".dish-carousel__viewport");
        const threshold = 40;

        function onDown(clientX) {
          isDragging = true;
          startX = clientX;
          currentX = clientX;
          track.classList.add("is-dragging");
          stopAutoplay();
        }

        function onMove(clientX) {
          if (!isDragging) return;
          currentX = clientX;
          const dx = currentX - startX;
          // efeito leve de "puxar" sem sair do layout
          track.style.transform = `translate3d(${-(index * 100)}%, 0, 0) translateX(${dx * 0.15}px)`;
        }

        function onUp() {
          if (!isDragging) return;
          isDragging = false;
          track.classList.remove("is-dragging");

          const dx = currentX - startX;
          if (Math.abs(dx) >= threshold) {
            if (dx < 0) next();
            else prev();
          } else {
            update();
          }
          startAutoplay();
        }

        if (viewport) {
          viewport.addEventListener("touchstart", (e) => onDown(e.touches[0].clientX), { passive: true });
          viewport.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX), { passive: true });
          viewport.addEventListener("touchend", onUp);

          viewport.addEventListener("mousedown", (e) => {
            e.preventDefault();
            onDown(e.clientX);
          });
          window.addEventListener("mousemove", (e) => onMove(e.clientX));
          window.addEventListener("mouseup", onUp);
        }

        // Autoplay
        const wantsAutoplay = root.dataset.autoplay === "true";
        const interval = parseInt(root.dataset.interval || "4500", 10);

        function startAutoplay() {
          if (!wantsAutoplay) return;
          stopAutoplay();
          autoplayTimer = setInterval(() => {
            index = (index + 1) % slides.length;
            update();
          }, Number.isFinite(interval) ? interval : 4500);
        }

        function stopAutoplay() {
          if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
          }
        }

        root.addEventListener("mouseenter", stopAutoplay);
        root.addEventListener("mouseleave", startAutoplay);

        // Keyboard
        root.addEventListener("keydown", (e) => {
          if (e.key === "ArrowLeft") prev();
          if (e.key === "ArrowRight") next();
        });

        // Init
        update();
        startAutoplay();
      }

      carousels.forEach(setupCarousel);
    })();

     (function () {
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

      function clamp(n) {
        return Math.max(0, Math.min(slides.length - 1, n));
      }

      function update() {
        if (dotsHost) {
          const dots = Array.from(dotsHost.querySelectorAll(`.${prefix}__dot`));
          dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
        }
        track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
      }

      function goTo(i) {
        index = clamp(i);
        update();
      }

      function next() {
        goTo(index + 1);
      }

      function prev() {
        goTo(index - 1);
      }

      if (btnNext) btnNext.addEventListener("click", next);
      if (btnPrev) btnPrev.addEventListener("click", prev);

      // drag handlers
      const threshold = 40;

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
        if (Math.abs(dx) >= threshold) {
          dx < 0 ? next() : prev();
        } else {
          update();
        }
        startAutoplay();
      }

      if (viewport) {
        viewport.addEventListener("touchstart", (e) => onDown(e.touches[0].clientX), { passive: true });
        viewport.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX), { passive: true });
        viewport.addEventListener("touchend", onUp);

        viewport.addEventListener("mousedown", (e) => {
          e.preventDefault();
          onDown(e.clientX);
        });
        window.addEventListener("mousemove", (e) => onMove(e.clientX));
        window.addEventListener("mouseup", onUp);
      }

      // autoplay
      const wantsAutoplay = root.dataset.autoplay === "true";
      const interval = parseInt(root.dataset.interval || "4500", 10);

      function startAutoplay() {
        if (!wantsAutoplay || slides.length <= 1) return;
        stopAutoplay();
        autoplayTimer = setInterval(() => {
          index = (index + 1) % slides.length;
          update();
        }, Number.isFinite(interval) ? interval : 4500);
      }

      function stopAutoplay() {
        if (autoplayTimer) {
          clearInterval(autoplayTimer);
          autoplayTimer = null;
        }
      }

      root.addEventListener("mouseenter", stopAutoplay);
      root.addEventListener("mouseleave", startAutoplay);

      // teclado
      root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      });

      update();
      startAutoplay();
    }

    document.querySelectorAll(".flyer-carousel").forEach((el) => setupCarousel(el, "flyer-carousel"));
  })();