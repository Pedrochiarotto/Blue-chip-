(() => {
  async function loadContent() {
    const res = await fetch("/content/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar /content/site.json");
    return res.json();
  }

  function $(id) { return document.getElementById(id); }

  function setText(id, value) {
    const el = $(id);
    if (el && typeof value === "string") el.textContent = value;
  }

  function setHtml(id, value) {
    const el = $(id);
    if (el && typeof value === "string") el.innerHTML = value;
  }

  function buildPills(pills) {
    const host = $("heroPills");
    if (!host) return;
    host.innerHTML = "";

    const items = Array.isArray(pills) ? pills : [];
    const doubled = items.concat(items); // p/ loop do marquee

    doubled.forEach((txt) => {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = txt;
      host.appendChild(span);
    });
  }

  function buildTodayCards(cards) {
    const host = $("todayMiniGrid");
    if (!host) return;
    host.innerHTML = "";

    (Array.isArray(cards) ? cards : []).forEach((c) => {
      const box = document.createElement("div");
      box.className = "mini";
      box.innerHTML = `<strong>${c.label || ""}</strong><span>${c.detailsHtml || ""}</span>`;
      host.appendChild(box);
    });
  }

  function getTodayKeys() {
    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
    const weekday = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][now.getDay()];
    return { localDate, weekday };
  }

  function getFlyerWeekdays(flyer) {
    if (Array.isArray(flyer?.weekdays)) return flyer.weekdays.filter(Boolean);
    if (typeof flyer?.weekday === "string" && flyer.weekday) return [flyer.weekday];
    if (typeof flyer?.tag === "string" && flyer.tag) return [flyer.tag.toLowerCase().slice(0, 3)];
    return [];
  }

  function getActiveFlyers(slides) {
    return (Array.isArray(slides) ? slides : []).filter((s) => s?.enabled !== false && s?.image);
  }

  function findTodayFlyer(slides) {
    const { localDate, weekday } = getTodayKeys();
    const active = getActiveFlyers(slides);

    return active.find((s) => s.eventDate === localDate)
      || active.find((s) => getFlyerWeekdays(s).includes(weekday))
      || null;
  }

  function applyTodayFlyer(flyer, today) {
    const figure = $("todayFlyer");
    const image = $("todayFlyerImage");
    const caption = $("todayFlyerCaption");
    if (!figure || !image || !caption) return;

    if (!flyer) {
      figure.hidden = true;
      image.removeAttribute("src");
      image.alt = "";
      caption.textContent = "";
      return;
    }

    const title = flyer.title || today?.title || "Evento de hoje";
    const subtitle = flyer.subtitle || "";
    const tag = flyer.tag ? `${flyer.tag} - ` : "";

    image.src = flyer.image;
    image.alt = title;
    caption.textContent = `${tag}${title}${subtitle ? ` | ${subtitle}` : ""}`;
    figure.hidden = false;

    setText("todayText", today?.autoText || subtitle || today?.text);
  }

  function buildFlyers(slides) {
    const track = $("flyerTrack");
    if (!track) return;
    track.innerHTML = "";

    getActiveFlyers(slides).forEach((s) => {
      const fig = document.createElement("figure");
      fig.className = "flyer-carousel__slide";
      fig.innerHTML = `
        <img src="${s.image || ""}" alt="${(s.title || "Flyer")}" loading="lazy" />
        <figcaption>
          <div class="flyer-tag">${s.tag || ""}</div>
          <strong>${s.title || ""}</strong>
          <span>${s.subtitle || ""}</span>
        </figcaption>
      `;
      track.appendChild(fig);
    });
  }

  function buildDishes(slides) {
    const track = $("dishTrack");
    if (!track) return;
    track.innerHTML = "";

    (Array.isArray(slides) ? slides : []).forEach((s) => {
      const fig = document.createElement("figure");
      fig.className = "dish-carousel__slide";
      fig.innerHTML = `
        <img src="${s.image || ""}" alt="${(s.title || "Prato")}" loading="lazy" />
        <figcaption>
          <strong>${s.title || ""}</strong>
          <span>${s.subtitle || ""}</span>
        </figcaption>
      `;
      track.appendChild(fig);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const data = await loadContent();

      // HERO
      setText("heroKickerText", data?.hero?.kicker);
      setHtml("heroTitle", data?.hero?.titleHtml);
      setText("heroSub", data?.hero?.sub);
      buildPills(data?.hero?.pills);

      // TODAY
      setText("todayTitle", data?.today?.title);
      setText("todayText", data?.today?.text);
      setText("todayTip", data?.today?.tip);
      buildTodayCards(data?.today?.cards);
      applyTodayFlyer(findTodayFlyer(data?.carousels?.flyers), data?.today);

      // CAROUSELS
      buildFlyers(data?.carousels?.flyers);
      buildDishes(data?.carousels?.dishes);

      // Depois do conteúdo pronto, inicializa os carrosséis
      document.dispatchEvent(new CustomEvent("content:ready"));
    } catch (e) {
      console.error(e);
    }
  });
})();
