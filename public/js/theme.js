/**
 * MOTOR DE TEMA DÍA / NOCHE PERSISTENTE (SUNSET LUXURY)
 * Guarda la preferencia del usuario en localStorage y respeta el tema del sistema
 */

const ThemeManager = {
  THEME_KEY: 'spring_fashion_theme',

  init() {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Por defecto modo noche / sunset dark
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'dark');
    this.setTheme(initialTheme, false);

    // Escuchar cambios en los botones de cambio de tema
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleTheme());
    });
  },

  setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      localStorage.setItem(this.THEME_KEY, theme);
    }
    this.updateIcons(theme);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme, true);
    if (window.Toast) {
      window.Toast.info(`Modo ${newTheme === 'dark' ? 'Noche (Sunset Dark)' : 'Día (Golden Light)'} activado`);
    }
  },

  updateIcons(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) {
        if (theme === 'dark') {
          icon.className = 'bi bi-sun-fill text-gold';
          btn.setAttribute('title', 'Cambiar a Modo Día');
        } else {
          icon.className = 'bi bi-moon-stars-fill';
          btn.setAttribute('title', 'Cambiar a Modo Noche');
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
});
