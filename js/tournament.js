(() => {
  const get = (id) => document.getElementById(id);
  const number = new Intl.NumberFormat("pt-BR");
  const labels = {running:"Em andamento",paused:"Pausado",break:"Intervalo",ended:"Encerrado"};
  let snapshot = null, received = 0, connected = false, busy = false;
  const set = (id, value) => { get(id).textContent = value; };
  function tick() {
    if (!snapshot || snapshot.status === "idle") return;
    const counting = ["running", "break"].includes(snapshot.status);
    const remaining = Math.max(0, Math.ceil(snapshot.remaining_seconds - (counting ? (performance.now() - received) / 1000 : 0)));
    set("tournamentClock", connected ? `${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(remaining % 60).padStart(2,"0")}` : "—");
    set("tournamentNotice", !connected ? "Reconectando para confirmar o tempo." : snapshot.status === "ended" ? "Torneio encerrado pela organização." : snapshot.status === "paused" ? "Relógio pausado pela organização." : remaining === 0 ? "Tempo esgotado. Aguardando atualização da organização." : snapshot.status === "break" ? "Os jogadores estão em intervalo." : "Acompanhe as informações da mesa de organização.");
  }
  async function sync() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const response = await fetch("/api/tournament", {cache:"no-store", signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error();
      snapshot = await response.json();
      received = performance.now();
      connected = true;
      const idle = snapshot.status === "idle";
      get("tournamentEmpty").hidden = !idle;
      get("tournamentBoard").hidden = idle;
      get("tournamentRetry").hidden = true;
      set("tournamentConnection", idle ? "Aguardando publicação da organização." : "Conectado · atualização automática");
      if (!idle) {
        set("tournamentName", snapshot.name);
        set("tournamentState", labels[snapshot.status]);
        set("tournamentClockLabel", snapshot.status === "break" ? "Tempo restante no intervalo" : "Tempo restante no nível");
        set("tournamentLevel", `Nível ${snapshot.level}`);
        set("tournamentBlinds", `${number.format(snapshot.small_blind)} / ${number.format(snapshot.big_blind)}`);
        set("tournamentAnte", number.format(snapshot.ante));
        set("tournamentPlayers", `${number.format(snapshot.players)} / ${number.format(snapshot.entries)}`);
        set("tournamentAverage", snapshot.average_stack ? number.format(snapshot.average_stack) : "Não informado");
        set("tournamentNote", snapshot.note);
        set("tournamentUpdated", `Publicado pela organização em ${new Date(snapshot.updated_at * 1000).toLocaleString("pt-BR")}`);
      }
    } catch {
      connected = false;
      if (!snapshot) get("tournamentEmpty").hidden = true;
      set("tournamentConnection", "Conexão indisponível. Tentando novamente; os últimos dados podem estar desatualizados.");
      get("tournamentRetry").hidden = false;
    } finally { busy = false; tick(); }
  }
  get("tournamentRetry").addEventListener("click", sync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { connected = false; tick(); sync(); } });
  window.addEventListener("online", sync);
  window.addEventListener("offline", () => { connected = false; set("tournamentConnection", "Sem conexão. Os últimos dados podem estar desatualizados."); tick(); });
  setInterval(tick,1000);
  setInterval(sync,5000);
  sync();
})();
