/**
 * SISTEMA GLOBAL DE NOTIFICACIONES TOAST & BOOTSTRAP DE LA APLICACIÓN
 */

const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'bi-info-circle-fill text-gold';
    if (type === 'success') icon = 'bi-check-circle-fill text-green';
    if (type === 'error') icon = 'bi-exclamation-triangle-fill text-red';

    toast.innerHTML = `
      <i class="bi ${icon}" style="font-size: 1.2rem;"></i>
      <span style="flex-grow: 1;">${message}</span>
      <button style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;" onclick="this.parentElement.remove()">
        <i class="bi bi-x"></i>
      </button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); }
};

window.Toast = Toast;

// Inicializar Apps al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();

  if (window.LandingApp) {
    window.LandingApp.init();
  }

  if (window.AdminApp) {
    window.AdminApp.init();
  }

  // Mobile menu toggle
  const menuBtn = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });

    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
      });
    });
  }
});
