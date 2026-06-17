(() => {
  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  const icon = toggle.querySelector(".theme-toggle__icon");
  const text = toggle.querySelector(".theme-toggle__text");

  function applyTheme(theme) {
    const isLight = theme === "light";
    root.setAttribute("data-theme", isLight ? "light" : "dark");
    localStorage.setItem("bluechip-theme", isLight ? "light" : "dark");

    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.setAttribute("aria-label", isLight ? "Mudar para versão dark" : "Mudar para versão light");
    if (icon) icon.textContent = isLight ? "☾" : "☀";
    if (text) text.textContent = isLight ? "Dark" : "Light";
  }

  applyTheme(localStorage.getItem("bluechip-theme") || root.getAttribute("data-theme") || "dark");

  toggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(current === "light" ? "dark" : "light");
  });
})();
