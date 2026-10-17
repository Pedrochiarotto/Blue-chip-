(() => {
  const text = (id, value) => {
    const element = document.getElementById(id);
    if (element && value != null) element.textContent = value;
  };

  const safeExternalUrl = (value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const renderCarousel = (kind, cards) => {
    const prefix = kind === "schedule" ? "flyer-carousel" : "dish-carousel";
    const root = document.querySelector(`.${prefix}`);
    const track = root?.querySelector(`.${prefix}__track`);
    if (!root || !track) return;
    const visibleCards = cards.filter((card) => card.carousel === kind);
    track.innerHTML = "";
    root.classList.toggle("is-empty", visibleCards.length === 0);

    if (visibleCards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "carousel-empty";
      empty.textContent = kind === "schedule"
        ? "A programação será publicada em breve. Fale com a equipe para saber o que acontece hoje."
        : "Os destaques do restaurante serão publicados em breve.";
      track.appendChild(empty);
      return;
    }

    visibleCards.forEach((card, cardIndex) => {
      const figure = document.createElement("figure");
      figure.className = `${prefix}__slide`;
      const media = card.image_url ? document.createElement("img") : document.createElement("div");
      if (card.image_url) {
        media.src = card.image_url;
        media.alt = card.title;
        media.loading = cardIndex === 0 ? "eager" : "lazy";
        if (cardIndex === 0) media.fetchPriority = "high";
        media.width = 1200;
        media.height = 700;
      } else {
        media.className = "carousel-placeholder";
        media.setAttribute("aria-hidden", "true");
      }
      const caption = document.createElement("figcaption");
      if (kind === "schedule" && card.tag) {
        const tag = document.createElement("div");
        tag.className = "flyer-tag";
        tag.textContent = card.tag;
        caption.appendChild(tag);
      }
      const title = document.createElement("strong");
      title.textContent = card.title;
      const description = document.createElement("span");
      description.textContent = card.description;
      caption.append(title, description);
      const linkUrl = kind === "restaurant" ? safeExternalUrl(card.link_url) : "";
      if (linkUrl && card.image_url) {
        figure.classList.add("is-linked");
        const mediaLink = document.createElement("a");
        mediaLink.className = "dish-carousel__media-link";
        mediaLink.href = linkUrl;
        mediaLink.target = "_blank";
        mediaLink.rel = "noopener noreferrer";
        mediaLink.setAttribute("aria-label", `Abrir detalhes de ${card.title} em uma nova aba`);
        const linkLabel = document.createElement("span");
        linkLabel.className = "dish-carousel__link-label";
        linkLabel.innerHTML = 'Ver detalhes <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg>';
        mediaLink.append(media, linkLabel);
        figure.append(mediaLink, caption);
      } else {
        figure.append(media, caption);
      }
      track.appendChild(figure);
    });
  };

  const renderScheduleList = (cards) => {
    const host = document.getElementById("scheduleList");
    if (!host) return;
    const scheduleCards = cards.filter((card) => card.carousel === "schedule");
    host.innerHTML = "";

    if (scheduleCards.length === 0) {
      const message = document.createElement("p");
      message.className = "schedule-list__message";
      message.textContent = "A próxima agenda será publicada em breve.";
      host.appendChild(message);
      return;
    }

    scheduleCards.forEach((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "schedule-item";
      button.dataset.slideIndex = String(index);
      button.setAttribute("aria-label", `Ver ${card.title}`);

      const day = document.createElement("span");
      day.className = "schedule-item__day";
      day.textContent = card.tag || "Agenda";

      const content = document.createElement("span");
      content.className = "schedule-item__content";
      const title = document.createElement("strong");
      title.textContent = card.title;
      const description = document.createElement("span");
      description.textContent = card.description;
      content.append(title, description);

      const action = document.createElement("span");
      action.className = "schedule-item__action";
      action.textContent = "Ver destaque";
      button.append(day, content, action);
      button.addEventListener("click", () => {
        renderScheduleFeature(scheduleCards, index);
        document.querySelector(".flyer-carousel")?.dispatchEvent(new CustomEvent("bluechip:go-to", {
          detail: { index }
        }));
      });
      host.appendChild(button);
    });
  };

  const renderScheduleFeature = (cards, index = 0) => {
    const scheduleCards = cards.filter((card) => card.carousel === "schedule");
    const card = scheduleCards[index];
    if (!card) {
      text("scheduleFeatureTitle", "Programação em breve");
      text("scheduleFeatureDescription", "Acompanhe esta página ou fale com a equipe para saber os próximos jogos.");
      text("scheduleFeatureTag", "Em atualização");
      text("scheduleFeatureInfo", "Consulte a equipe da casa.");
      return;
    }
    text("scheduleFeatureTitle", card.title || "Programação em destaque");
    text("scheduleFeatureDescription", card.description || "Consulte a equipe para mais informações.");
    text("scheduleFeatureTag", card.tag || "Agenda");
    text("scheduleFeatureInfo", card.description || "Consulte a equipe da casa.");
  };

  const formatWhatsapp = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("55")) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    return value;
  };

  fetch("/api/public")
    .then((response) => {
      if (!response.ok) throw new Error("Não foi possível carregar as informações do clube.");
      return response.json();
    })
    .then(({ content, cards }) => {
      document.title = content.site_name || "Blue Chip Poker Club";
      text("brandName", content.site_name?.replace(/\s+poker\s+club\s*$/i, "") || content.site_name);
      text("kickerText", content.kicker);
      text("heroTitle", content.hero_title);
      text("heroDescription", content.hero_description);
      text("todayTitle", content.today_title);
      text("todayDescription", content.today_description);
      text("todayNote", content.today_note);
      text("scheduleTitle", content.schedule_title);
      text("scheduleDescription", content.schedule_description);
      text("restaurantTitle", content.restaurant_title);
      text("restaurantHeading", content.restaurant_heading);
      text("restaurantDescription", content.restaurant_description);
      text("contactTitle", content.contact_title);
      text("contactDescription", content.contact_description);
      text("contactAddress", content.address);
      text("contactWhatsapp", formatWhatsapp(content.whatsapp));
      text("contactEmail", content.email);

      const whatsapp = String(content.whatsapp || "").replace(/\D/g, "");
      document.querySelectorAll("[data-whatsapp]").forEach((link) => {
        link.href = whatsapp ? `https://wa.me/${whatsapp}` : "#localizacao";
      });
      const email = document.getElementById("contactEmail");
      if (email) email.href = content.email ? `mailto:${content.email}` : "#localizacao";
      const map = document.getElementById("mapFrame");
      if (map && content.map_url) map.src = content.map_url;

      renderCarousel("schedule", cards);
      renderScheduleList(cards);
      renderScheduleFeature(cards);
      document.querySelector(".flyer-carousel")?.addEventListener("bluechip:slide-change", (event) => {
        renderScheduleFeature(cards, event.detail?.index || 0);
      });
      renderCarousel("restaurant", cards);
    })
    .catch(() => {
      document.querySelectorAll(".dish-carousel, .flyer-carousel").forEach((root) => {
        root.classList.add("is-empty");
        const track = root.querySelector("[class$='__track']");
        if (track) track.innerHTML = '<p class="carousel-empty">Não foi possível carregar esta seção. Tente novamente mais tarde.</p>';
      });
      document.querySelectorAll(".carousel-status").forEach((status) => {
        status.textContent = "Não foi possível atualizar esta seção. Tente novamente mais tarde.";
      });
      const scheduleList = document.getElementById("scheduleList");
      if (scheduleList) scheduleList.innerHTML = '<p class="schedule-list__message">Não foi possível carregar a agenda. Tente novamente mais tarde.</p>';
      renderScheduleFeature([]);
    })
    .finally(() => window.dispatchEvent(new Event("bluechip:data-ready")));
})();
