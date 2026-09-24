export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in <head> before first paint (see app/layout.tsx), so a dark-mode visitor never sees
 * a flash of the light page. It resolves the preference onto `<html data-theme>`
 *
 * Kept as a string: it has to run before any bundle has loaded.
 */
export const themeScript = `(() => {
  const root = document.documentElement;
  const media = matchMedia("(prefers-color-scheme: dark)");
  const stored = () => { try { return localStorage.getItem("${THEME_STORAGE_KEY}"); } catch { return null; } };
  const apply = () => {
    const pref = stored();
    root.dataset.theme = pref === "light" || pref === "dark" ? pref : media.matches ? "dark" : "light";
  };
  apply();
  media.addEventListener("change", apply);
  addEventListener("storage", (event) => { if (event.key === "${THEME_STORAGE_KEY}") apply(); });
})();`;
