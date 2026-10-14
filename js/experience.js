(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const targets = [
    ".hero-copy",
    ".hero-stage",
    ".tournament-section .section-head",
    ".tournament-board",
    ".tournament-empty",
    ".schedule-board",
    ".flyer-carousel",
    ".restaurant-section .section-head",
    ".restaurant-copy",
    ".restaurant-gallery",
    ".contact-section .section-head",
    ".contact-grid"
  ].flatMap((selector) => [...document.querySelectorAll(selector)]);

  targets.forEach((target) => target.dataset.reveal = "");

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("reveal-ready");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

  targets.forEach((target) => observer.observe(target));
})();
