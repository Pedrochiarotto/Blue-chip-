document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("error");
  const button = form.querySelector("button[type='submit']");
  error.textContent = "";
  form.setAttribute("aria-busy", "true");
  button.disabled = true;
  button.textContent = "Entrando…";

  try {
    const response = await fetch("/api/login", { method: "POST", body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Não foi possível entrar");
    window.location.reload();
  } catch (exception) {
    error.textContent = exception instanceof TypeError
      ? "Não foi possível acessar o servidor. Verifique se o projeto está em execução e tente novamente."
      : exception.message;
    form.removeAttribute("aria-busy");
    button.disabled = false;
    button.textContent = "Entrar";
  }
});
