export const loginView = document.getElementById("login-view")!;
export const mainView = document.getElementById("main-view")!;
export const btnLogin = document.getElementById("btn-login")!;
export const btnSettings = document.getElementById("btn-settings")!;
export const usernameEl = document.getElementById("username")!;
export const stateContainer = document.getElementById("state-container")!;

export function showView(view: "login" | "main"): void {
  loginView.style.display = view === "login" ? "block" : "none";
  mainView.style.display = view === "main" ? "block" : "none";
}

export function applyTheme(theme: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", theme);
}
