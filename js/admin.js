const labels = {
  site_name: "Nome do site",
  kicker: "Chamada principal",
  hero_title: "Título principal",
  hero_description: "Descrição principal",
  today_title: "Título do destaque",
  today_description: "Descrição do destaque",
  today_note: "Nota do destaque",
  schedule_title: "Título da programação",
  schedule_description: "Descrição da programação",
  restaurant_title: "Título do restaurante",
  restaurant_heading: "Chamada do restaurante",
  restaurant_description: "Descrição do restaurante",
  contact_title: "Título do contato",
  contact_description: "Descrição do contato",
  address: "Endereço",
  whatsapp: "WhatsApp com DDI",
  email: "E-mail",
  map_url: "URL incorporada do mapa"
};

const longFields = new Set([
  "hero_title", "hero_description", "today_description", "today_note",
  "schedule_description", "restaurant_description", "contact_description", "map_url"
]);

let state = { content: {}, cards: [] };
let current = "content";

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    },
    ...options
  });
  if (response.status === 401) {
    window.location.href = "/admin";
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  if (!response.ok) {
    let data = {};
    try { data = await response.json(); } catch {}
    throw new Error(data.detail || "Não foi possível concluir a ação. Tente novamente.");
  }
  return response.status === 204 ? null : response.json();
};

let notificationTimer;
const notify = (message, error = false) => {
  const element = document.getElementById("status");
  window.clearTimeout(notificationTimer);
  element.textContent = message;
  element.classList.toggle("is-error", error);
  notificationTimer = window.setTimeout(() => {
    if (element.textContent === message) element.textContent = "";
  }, 4500);
};

const setButtonBusy = (button, busy, busyLabel, idleLabel) => {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
};

function renderContent() {
  const host = document.getElementById("contentFields");
  host.innerHTML = "";
  const groups = [
    ["Identidade e apresentação", "Nome e mensagem de boas-vindas da página inicial.", ["site_name", "kicker", "hero_title", "hero_description"]],
    ["Destaque da casa", "Informações do bloco “Hoje no Blue Chip”.", ["today_title", "today_description", "today_note"]],
    ["Agenda e restaurante", "Títulos e descrições que apresentam a programação e o restaurante.", ["schedule_title", "schedule_description", "restaurant_title", "restaurant_heading", "restaurant_description"]],
    ["Localização e contato", "Canais de atendimento e endereço exibidos aos visitantes.", ["contact_title", "contact_description", "address", "whatsapp", "email", "map_url"]]
  ];
  const hosts = {};
  groups.forEach(([title, description, keys]) => {
    const group = document.createElement("fieldset");
    group.className = "content-group";
    const legend = document.createElement("legend");
    legend.textContent = title;
    const help = document.createElement("p");
    help.className = "muted";
    help.textContent = description;
    const grid = document.createElement("div");
    grid.className = "field-grid";
    group.append(legend, help, grid);
    host.appendChild(group);
    keys.forEach(key => { hosts[key] = grid; });
  });
  Object.entries(labels).forEach(([key, labelText]) => {
    const label = document.createElement("label");
    if (longFields.has(key)) label.className = "wide";
    const labelCopy = document.createElement("span");
    labelCopy.textContent = labelText;
    const field = document.createElement(longFields.has(key) ? "textarea" : "input");
    field.name = key;
    field.value = state.content[key] || "";
    if (field.tagName === "TEXTAREA") field.rows = key === "hero_title" ? 3 : 4;
    label.append(labelCopy, field);
    (hosts[key] || host).appendChild(label);
  });
  host.setAttribute("aria-busy", "false");
}

function renderCards() {
  const cards = state.cards.filter((card) => card.carousel === current);
  const title = current === "schedule" ? "Cards da programação" : "Cards do restaurante";
  document.getElementById("cardsTitle").textContent = title;
  const host = document.getElementById("cardsList");
  host.innerHTML = "";

  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = current === "schedule"
      ? "Nenhum item de programação cadastrado. Use “Novo card” para publicar o primeiro."
      : "Nenhum destaque do restaurante cadastrado. Use “Novo card” para publicar o primeiro.";
    host.appendChild(empty);
    return;
  }

  cards.forEach((card) => {
    const row = document.createElement("article");
    row.className = "admin-card";
    const media = card.image_url
      ? Object.assign(document.createElement("img"), { src: card.image_url, alt: "" })
      : Object.assign(document.createElement("div"), { className: "image-placeholder", textContent: "Sem imagem" });
    const copy = document.createElement("div");
    const meta = document.createElement("span");
    meta.className = "tag";
    meta.textContent = [card.tag, `ORDEM ${card.position}`, card.active ? "" : "OCULTO"].filter(Boolean).join(" · ");
    const heading = document.createElement("strong");
    heading.textContent = card.title;
    const description = document.createElement("p");
    description.textContent = card.description || "Sem descrição";
    copy.append(meta, heading, description);
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ghost";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openDialog(card));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => removeCard(card, remove));
    actions.append(edit, remove);
    row.append(media, copy, actions);
    host.appendChild(row);
  });
}

function openDialog(card = null) {
  const form = document.getElementById("cardForm");
  form.reset();
  form.elements.carousel.value = current;
  form.elements.active.checked = true;
  const preview = document.getElementById("preview");
  preview.classList.add("hidden");
  document.getElementById("dialogError").textContent = "";
  if (card) {
    ["id", "carousel", "tag", "title", "description", "image_url", "position"].forEach((key) => {
      form.elements[key].value = card[key];
    });
    form.elements.active.checked = Boolean(card.active);
    if (card.image_url) {
      preview.src = card.image_url;
      preview.classList.remove("hidden");
    }
  }
  document.getElementById("dialogTitle").textContent = card ? "Editar card" : "Novo card";
  document.getElementById("cardDialog").showModal();
}

async function removeCard(card, button) {
  if (!window.confirm(`Excluir o card “${card.title}”? Esta ação não pode ser desfeita.`)) return;
  setButtonBusy(button, true, "Excluindo…", "Excluir");
  try {
    await request(`/api/admin/cards/${card.id}`, { method: "DELETE" });
    await load();
    notify("Card excluído.");
  } catch (exception) {
    notify(exception.message, true);
    setButtonBusy(button, false, "Excluindo…", "Excluir");
  }
}

async function load() {
  state = await request("/api/admin/data");
  renderContent();
  if (current === "schedule" || current === "restaurant") renderCards();
}

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("keydown", (event) => {
    const tabs = [...document.querySelectorAll(".tabs button")];
    let next = tabs.indexOf(button);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (next + 1) % tabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (next - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
  button.addEventListener("click", () => {
    current = button.dataset.tab;
    document.querySelectorAll(".tabs button").forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const isContent = current === "content";
    document.getElementById("contentPanel").classList.toggle("hidden", !isContent);
    const isCards = current === "schedule" || current === "restaurant";
    document.getElementById("cardsPanel").classList.toggle("hidden", !isCards);
    document.getElementById("tournamentPanel").classList.toggle("hidden", current !== "tournament");
    document.getElementById("cardsPanel").setAttribute("aria-labelledby", `tab-${current}`);
    if (isCards) renderCards();
  });
});

document.getElementById("contentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  const content = Object.fromEntries(new FormData(event.currentTarget));
  setButtonBusy(button, true, "Salvando…", "Salvar conteúdo");
  try {
    await request("/api/admin/content", { method: "PUT", body: JSON.stringify({ content }) });
    state.content = content;
    notify("Conteúdo salvo com sucesso.");
  } catch (exception) {
    notify(exception.message, true);
  } finally {
    setButtonBusy(button, false, "Salvando…", "Salvar conteúdo");
  }
});

document.getElementById("newCard").addEventListener("click", () => openDialog());
document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("cardDialog").close());
document.getElementById("cancelDialog").addEventListener("click", () => document.getElementById("cardDialog").close());

document.getElementById("imageFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const error = document.getElementById("dialogError");
  error.textContent = "";
  event.target.disabled = true;
  const data = new FormData();
  data.append("file", file);
  try {
    const result = await request("/api/admin/upload", { method: "POST", body: data });
    document.getElementById("cardForm").elements.image_url.value = result.url;
    const preview = document.getElementById("preview");
    preview.src = result.url;
    preview.classList.remove("hidden");
  } catch (exception) {
    error.textContent = exception.message;
  } finally {
    event.target.disabled = false;
  }
});

document.getElementById("cardForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;
  const id = fields.id.value;
  const button = form.querySelector("button[type='submit']");
  const payload = {
    carousel: fields.carousel.value,
    tag: fields.tag.value,
    title: fields.title.value,
    description: fields.description.value,
    image_url: fields.image_url.value,
    position: Number(fields.position.value),
    active: fields.active.checked
  };
  setButtonBusy(button, true, "Salvando…", "Salvar card");
  try {
    await request(id ? `/api/admin/cards/${id}` : "/api/admin/cards", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    document.getElementById("cardDialog").close();
    await load();
    notify("Card salvo com sucesso.");
  } catch (exception) {
    document.getElementById("dialogError").textContent = exception.message;
  } finally {
    setButtonBusy(button, false, "Salvando…", "Salvar card");
  }
});

document.getElementById("logout").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  setButtonBusy(button, true, "Saindo…", "Sair");
  try {
    await request("/api/logout", { method: "POST" });
    window.location.href = "/admin";
  } catch (exception) {
    notify(exception.message, true);
    setButtonBusy(button, false, "Saindo…", "Sair");
  }
});

load().catch((exception) => notify(exception.message, true));
