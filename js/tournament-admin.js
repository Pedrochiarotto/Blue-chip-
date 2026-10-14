(() => {
  const setupForm = document.getElementById("automationForm");
  const setupFields = document.getElementById("automationFields");
  const metricsForm = document.getElementById("tournamentMetricsForm");
  const metricsFields = document.getElementById("tournamentMetricsFields");
  const status = document.getElementById("tournamentAdminStatus");
  const reload = document.getElementById("tournamentReload");
  const growthMode = setupForm.elements.blind_growth_mode;
  const growthLabel = document.getElementById("blindGrowthLabel");
  const preview = document.getElementById("structurePreview");
  const previewSummary = document.getElementById("previewSummary");
  const controlTitle = document.getElementById("tournamentControlTitle");
  const controlDetail = document.getElementById("tournamentControlDetail");
  const controlState = document.getElementById("controlState");
  const controlClock = document.getElementById("controlClock");
  const pause = document.getElementById("pauseTournament");
  const resume = document.getElementById("resumeTournament");
  const end = document.getElementById("endTournament");
  const setupSubmit = document.getElementById("automationSubmit");
  const setupIntegerFields = ["level_duration_minutes", "small_blind", "big_blind", "break_every_levels", "break_duration_minutes"];
  const decimalFields = ["blind_growth_value", "ante_percent"];
  const metrics = ["players", "entries", "average_stack"];
  const labels = { running: "Em andamento", break: "Intervalo", paused: "Pausado", ended: "Encerrado" };
  const number = new Intl.NumberFormat("pt-BR");
  let revision = 0;
  let snapshot = null;
  let receivedAt = 0;
  let busy = false;

  const value = (form, name) => Number(form.elements[name].value || 0);
  const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  function updateGrowthLabel() {
    const multiplier = growthMode.value === "multiplier";
    growthLabel.textContent = multiplier ? "Multiplicador por nível" : "Acréscimo em cada blind";
    const input = setupForm.elements.blind_growth_value;
    input.min = multiplier ? "1" : "0";
    input.step = multiplier ? "0.1" : "1";
    if (multiplier && Number(input.value) < 1) input.value = "2";
  }

  function levelValues(level) {
    const small = value(setupForm, "small_blind");
    const big = value(setupForm, "big_blind");
    const growth = value(setupForm, "blind_growth_value");
    const step = level - 1;
    const multiplier = growthMode.value === "multiplier";
    const currentSmall = Math.round(multiplier ? small * growth ** step : small + growth * step);
    const currentBig = Math.round(multiplier ? big * growth ** step : big + growth * step);
    return { small: currentSmall, big: currentBig, ante: Math.round(currentBig * value(setupForm, "ante_percent") / 100) };
  }

  function renderPreview() {
    updateGrowthLabel();
    preview.replaceChildren();
    const duration = value(setupForm, "level_duration_minutes");
    const every = value(setupForm, "break_every_levels");
    const breakMinutes = value(setupForm, "break_duration_minutes");
    previewSummary.textContent = duration ? `${duration} min por nível` : "Defina a duração";
    for (let level = 1; level <= 6; level += 1) {
      const item = document.createElement("li");
      const blinds = levelValues(level);
      item.textContent = `Nível ${level} · ${number.format(blinds.small)} / ${number.format(blinds.big)}${blinds.ante ? ` · ante ${number.format(blinds.ante)}` : ""}`;
      preview.appendChild(item);
      if (every && breakMinutes && level % every === 0 && level < 6) {
        const interval = document.createElement("li");
        interval.className = "is-break";
        interval.textContent = `Intervalo · ${breakMinutes} min`;
        preview.appendChild(interval);
      }
    }
  }

  function setControl(data) {
    const automated = Boolean(data?.automation);
    const state = data?.status;
    const canPause = automated && ["running", "break"].includes(state);
    const canResume = automated && state === "paused";
    const canEnd = automated && state !== "ended";
    pause.disabled = !canPause || busy;
    resume.disabled = !canResume || busy;
    end.disabled = !canEnd || busy;
    pause.classList.toggle("hidden", !canPause);
    resume.classList.toggle("hidden", !canResume);
    end.classList.toggle("hidden", !canEnd);
    if (!automated) {
      controlTitle.textContent = "Aguardando estrutura";
      controlDetail.textContent = "Preencha a estrutura para iniciar o acompanhamento automático.";
      controlState.textContent = "Não iniciado";
      controlClock.textContent = "—";
      return;
    }
    controlTitle.textContent = data.name;
    controlDetail.textContent = state === "break" ? `Intervalo automático após o nível ${data.level}.`
      : state === "paused" ? "O relógio está congelado pela organização."
      : state === "ended" ? "Torneio encerrado pela organização."
      : `Nível ${data.level} em andamento. As blinds sobem no próximo nível.`;
    controlState.textContent = labels[state] || state;
  }

  function tick() {
    if (!snapshot?.automation) return;
    const counting = ["running", "break"].includes(snapshot.status);
    const elapsed = counting ? (performance.now() - receivedAt) / 1000 : 0;
    controlClock.textContent = clock(Math.max(0, Math.ceil(snapshot.remaining_seconds - elapsed)));
  }

  function fillSetup(automation) {
    if (!automation) return;
    setupForm.elements.level_duration_minutes.value = Math.round(automation.level_duration_seconds / 60);
    setupForm.elements.small_blind.value = automation.small_blind;
    setupForm.elements.big_blind.value = automation.big_blind;
    setupForm.elements.blind_growth_mode.value = automation.blind_growth_mode;
    setupForm.elements.blind_growth_value.value = automation.blind_growth_value;
    setupForm.elements.ante_percent.value = automation.ante_percent;
    setupForm.elements.break_every_levels.value = automation.break_every_levels;
    setupForm.elements.break_duration_minutes.value = Math.round(automation.break_duration_seconds / 60);
  }

  function fillMetrics(data) {
    ["players", "entries", "average_stack", "note"].forEach((key) => {
      if (data[key] != null) metricsForm.elements[key].value = data[key];
    });
  }

  function applySnapshot(data, message) {
    snapshot = data.status === "idle" ? null : data;
    revision = data.revision || 0;
    receivedAt = performance.now();
    if (data.automation) {
      setupForm.elements.name.value = data.name;
      fillSetup(data.automation);
      fillMetrics(data);
      metricsFields.disabled = false;
      setupSubmit.textContent = "Reiniciar com esta estrutura";
    } else {
      metricsForm.reset();
      metricsFields.disabled = true;
      setupSubmit.textContent = "Iniciar torneio automático";
    }
    setupFields.disabled = false;
    setControl(snapshot);
    renderPreview();
    tick();
    status.textContent = message || (data.automation
      ? "Estrutura automática ativa. O site recebe as mudanças de nível em até 5 segundos."
      : "Nenhum torneio automático iniciado. Configure a estrutura para começar.");
  }

  async function loadTournament() {
    if (busy) return;
    busy = true;
    setupFields.disabled = true;
    metricsFields.disabled = true;
    reload.disabled = true;
    setControl(snapshot);
    try {
      const data = await request("/api/tournament", { cache: "no-store" });
      applySnapshot(data, data.revision ? undefined : "Nenhum torneio publicado. Você pode iniciar uma estrutura automática.");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      reload.disabled = false;
      if (!setupFields.disabled || snapshot) setControl(snapshot);
    }
  }

  async function withRequest(path, options, success) {
    busy = true;
    setupFields.disabled = true;
    metricsFields.disabled = true;
    reload.disabled = true;
    setControl(snapshot);
    try {
      const data = await request(path, options);
      applySnapshot(data, success);
    } catch (error) {
      status.textContent = error.message;
      setupFields.disabled = false;
      metricsFields.disabled = !snapshot?.automation;
    } finally {
      busy = false;
      reload.disabled = false;
      setControl(snapshot);
    }
  }

  setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (snapshot?.automation && !window.confirm("Isso reiniciará o relógio no nível 1 com esta estrutura. Deseja continuar?")) return;
    const payload = { revision };
    ["name", "blind_growth_mode"].forEach((key) => { payload[key] = setupForm.elements[key].value; });
    setupIntegerFields.forEach((key) => { payload[key] = value(setupForm, key); });
    decimalFields.forEach((key) => { payload[key] = value(setupForm, key); });
    metrics.forEach((key) => { payload[key] = value(metricsForm, key); });
    payload.note = metricsForm.elements.note.value;
    withRequest("/api/admin/tournament/automation", { method: "PUT", body: JSON.stringify(payload) }, "Torneio automático iniciado. O nível 1 já está em contagem.");
  });

  metricsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = { revision, note: metricsForm.elements.note.value };
    metrics.forEach((key) => { payload[key] = value(metricsForm, key); });
    withRequest("/api/admin/tournament/automation/metrics", { method: "PUT", body: JSON.stringify(payload) }, "Dados da mesa publicados. A estrutura segue automática.");
  });

  const runAction = (action, message) => withRequest("/api/admin/tournament/automation/action", { method: "POST", body: JSON.stringify({ revision, action }) }, message);
  pause.addEventListener("click", () => runAction("pause", "Relógio pausado. O nível e as blinds foram preservados."));
  resume.addEventListener("click", () => runAction("resume", "Relógio retomado a partir do tempo preservado."));
  end.addEventListener("click", () => {
    if (window.confirm("Encerrar o torneio publicado? O resultado continuará visível até uma nova estrutura ser iniciada.")) runAction("end", "Torneio encerrado no site público.");
  });
  growthMode.addEventListener("change", renderPreview);
  [...setupForm.querySelectorAll("input")].forEach((input) => input.addEventListener("input", renderPreview));
  reload.addEventListener("click", loadTournament);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadTournament(); });
  setInterval(tick, 1000);
  setInterval(() => { if (!document.hidden && snapshot?.automation) loadTournament(); }, 20000);
  renderPreview();
  loadTournament();
})();
