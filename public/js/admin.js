/**
 * LÓGICA DEL PANEL DE ADMINISTRACIÓN / BACKOFFICE (SPRING FASHION)
 * Con Roadmap primero, Finanzas, Tiers editables, Escáner QR, Vendedores con links directos,
 * Gestión de Experiencias Multisensoriales, Talento & Lineup, Media Kit PDF y dLocal Go.
 */

const AdminApp = {
  currentUser: null,
  activeEvent: null,
  categories: [],
  providers: [],
  filteredProviders: [],
  roadmapSteps: [],
  ticketTiers: [],
  sponsors: [],
  sales: [],
  promoters: [],
  feedbackList: [],
  experiences: [],
  artists: [],

  async init() {
    this.initAuthListeners();
    this.initTabNavigation();
    this.initFormHandlers();
    this.initQRScannerHandlers();
    this.initProvidersFilterHandlers();
    this.initFileUploadHandlers();
    
    if (API.getToken()) {
      await this.checkSession();
    }
  },

  // ==========================================
  // HELPERS UNIVERSALES PARA MODALES
  // ==========================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // ==========================================
  // 1. AUTENTICACIÓN Y SESIÓN
  // ==========================================
  initAuthListeners() {
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('admin-user-input')?.value?.trim() || '';
        const p = document.getElementById('admin-pass-input')?.value?.trim() || '';

        const btn = loginForm.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Verificando...';
        }

        try {
          const res = await API.auth.login(u, p);
          if (res.token) {
            API.setToken(res.token);
            this.currentUser = res.user;
            window.Toast.success(`¡Bienvenido al panel, ${res.user.username}!`);
            this.closeModal('admin-login-modal');
            this.showAdminPanel();
            await this.loadAllAdminData();
          }
        } catch (err) {
          window.Toast.error(err.message || 'Error de autenticación. Verifica usuario y clave.');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Ingresar al Backoffice';
          }
        }
      });
    }

    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    const openLoginBtns = document.querySelectorAll('.open-admin-btn');
    openLoginBtns.forEach(b => {
      b.addEventListener('click', () => {
        if (API.getToken()) {
          this.showAdminPanel();
        } else {
          this.openModal('admin-login-modal');
        }
      });
    });
  },

  async checkSession() {
    try {
      const res = await API.auth.me();
      if (res.user) {
        this.currentUser = res.user;
        const authBadge = document.getElementById('admin-auth-status-badge');
        if (authBadge) {
          authBadge.innerHTML = `<i class="bi bi-shield-check text-green"></i> Conectado: <strong>${res.user.username}</strong>`;
        }
      }
    } catch (err) {
      API.removeToken();
    }
  },

  logout() {
    API.removeToken();
    this.currentUser = null;
    window.Toast.info('Sesión cerrada.');
    this.hideAdminPanel();
  },

  showAdminPanel() {
    const portal = document.getElementById('admin-portal-view');
    const landing = document.getElementById('public-landing-view');
    if (portal && landing) {
      portal.style.display = 'block';
      landing.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.loadAllAdminData();
    }
  },

  hideAdminPanel() {
    const portal = document.getElementById('admin-portal-view');
    const landing = document.getElementById('public-landing-view');
    if (portal && landing) {
      portal.style.display = 'none';
      landing.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.LandingApp) window.LandingApp.init();
    }
  },

  initTabNavigation() {
    const tabs = document.querySelectorAll('.admin-tab-btn');
    const panes = document.querySelectorAll('.admin-tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const activePane = document.getElementById(target);
        if (activePane) activePane.classList.add('active');

        if (target === 'tab-adm-scanner') {
          this.loadAccessStats();
        }
      });
    });
  },

  // ==========================================
  // 2. CARGA COMPLETA DE DATOS
  // ==========================================
  async loadAllAdminData() {
    await Promise.all([
      this.loadRoadmapAdmin(),
      this.loadFinancialStats(),
      this.loadEventConfig(),
      this.loadTicketTiersAdmin(),
      this.loadExperiencesAdmin(),
      this.loadArtistsAdmin(),
      this.loadPromotersAdmin(),
      this.loadCategoriesAndProviders(),
      this.loadAccessStats(),
      this.loadSponsorsAdmin(),
      this.loadGalleryAdmin(),
      this.loadSalesCRM(),
      this.loadFeedbackCRM()
    ]);
  },

  // ==========================================
  // TAB 1: ROADMAP SECUENCIAL DE PRODUCCIÓN
  // ==========================================
  async loadRoadmapAdmin() {
    try {
      const res = await API.roadmap.getSteps();
      if (!res || !res.steps) return;

      this.roadmapSteps = res.steps;
      const listContainer = document.getElementById('admin-roadmap-list');
      const progressFill = document.getElementById('admin-roadmap-progress-fill');
      const progressText = document.getElementById('admin-roadmap-progress-text');

      if (!listContainer) return;

      const completedCount = res.steps.filter(s => s.is_completed).length;
      const totalCount = res.steps.length;
      const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `${pct}% Completado (${completedCount}/${totalCount} Hitos)`;

      listContainer.innerHTML = res.steps.map(step => {
        const isLocked = !step.is_unlocked && !step.is_completed;
        return `
          <div class="roadmap-step-item ${step.is_completed ? 'completed' : (step.is_unlocked ? 'unlocked' : 'locked')}">
            <div class="step-info-col">
              <div class="step-number-badge">
                ${step.is_completed ? '<i class="bi bi-check-lg"></i>' : (isLocked ? '<i class="bi bi-lock-fill"></i>' : step.step_order)}
              </div>
              <div>
                <h4 class="step-title" style="margin:0 0 0.25rem 0;">${step.title}</h4>
                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">${step.description || ''}</p>
                ${step.completed_at ? `<small style="color:var(--status-green);"><i class="bi bi-calendar-check"></i> Completado el ${new Date(step.completed_at).toLocaleDateString()}</small>` : ''}
              </div>
            </div>
            <div>
              ${isLocked ? `
                <span class="badge" style="background:var(--bg-input); color:var(--text-muted);"><i class="bi bi-lock"></i> Bloqueado</span>
              ` : `
                <button class="btn btn-sm ${step.is_completed ? 'btn-gold' : 'btn-primary'}" onclick="AdminApp.toggleRoadmapStep(${step.id})">
                  <i class="bi ${step.is_completed ? 'bi-arrow-counterclockwise' : 'bi-check-circle-fill'}"></i> ${step.is_completed ? 'Desmarcar' : 'Completar Paso'}
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando roadmap:', err);
    }
  },

  async toggleRoadmapStep(id) {
    try {
      const res = await API.roadmap.toggleStep(id);
      if (res.success) {
        window.Toast.success('Progreso del Roadmap actualizado.');
        await this.loadRoadmapAdmin();
      }
    } catch (err) {
      window.Toast.error('Error al actualizar paso del roadmap.');
    }
  },

  // ==========================================
  // TAB 2: FINANZAS & RENTABILIDAD
  // ==========================================
  async loadFinancialStats() {
    try {
      const data = await API.stats.getFinancial();
      if (!data || !data.financials) return;

      const f = data.financials;
      const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';

      const opCostEl = document.getElementById('kpi-operational-cost');
      if (opCostEl) opCostEl.textContent = `$${f.total_operational_cost.toLocaleString('es-AR')} ${currency}`;

      const paidCostEl = document.getElementById('kpi-paid-cost');
      if (paidCostEl) paidCostEl.textContent = `$${f.total_paid_cost.toLocaleString('es-AR')}`;

      const pendingCostEl = document.getElementById('kpi-pending-cost');
      if (pendingCostEl) pendingCostEl.textContent = `$${f.total_pending_cost.toLocaleString('es-AR')}`;

      const grossRevEl = document.getElementById('kpi-gross-revenue');
      if (grossRevEl) grossRevEl.textContent = `$${f.total_gross_revenue.toLocaleString('es-AR')} ${currency}`;

      const ticketsCountEl = document.getElementById('kpi-tickets-count');
      if (ticketsCountEl) ticketsCountEl.textContent = `${f.total_tickets_sold} tickets vendidos (${f.total_promoter_tickets || 0} por RRPP)`;

      const netEl = document.getElementById('kpi-net-profit');
      if (netEl) {
        netEl.textContent = `$${f.real_net_profit.toLocaleString('es-AR')} ${currency}`;
        if (f.real_net_profit >= 0) {
          netEl.style.color = 'var(--status-green)';
        } else {
          netEl.style.color = 'var(--status-red)';
        }
      }

      const marginPctEl = document.getElementById('kpi-margin-pct');
      if (marginPctEl) marginPctEl.textContent = `${f.profit_margin_percentage}%`;

      const commEl = document.getElementById('kpi-promoters-commission');
      if (commEl) {
        commEl.textContent = `$${(f.total_commission_to_pay || 0).toLocaleString('es-AR')} ${currency}`;
      }

      const bulb = document.getElementById('traffic-bulb-indicator');
      const statusText = document.getElementById('traffic-status-text');
      if (bulb && statusText) {
        bulb.className = `traffic-light-bulb ${f.semaforo}`;
        statusText.textContent = f.status_text;
        statusText.style.color = f.semaforo === 'green' ? 'var(--status-green)' : (f.semaforo === 'red' ? 'var(--status-red)' : 'var(--status-yellow)');
      }

      const breakdownContainer = document.getElementById('category-cost-breakdown-list');
      if (breakdownContainer && f.category_breakdown) {
        breakdownContainer.innerHTML = f.category_breakdown.map(cat => {
          const pct = f.total_operational_cost > 0 ? ((cat.category_total / f.total_operational_cost) * 100).toFixed(1) : 0;
          return `
            <div style="margin-bottom: 1rem;">
              <div style="display:flex; justify-content:space-between; font-size: 0.88rem; margin-bottom: 0.35rem;">
                <span><strong>${cat.category_name}</strong> (${cat.providers_count} proveedores)</span>
                <span>$${cat.category_total.toLocaleString('es-AR')} ${currency} (${pct}%)</span>
              </div>
              <div style="height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow:hidden;">
                <div style="height: 100%; width: ${pct}%; background: var(--accent-sunset);"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Error cargando finanzas:', err);
    }
  },

  // ==========================================
  // TAB 3: FORMATO, EVENTO & TIERS EDITABLES
  // ==========================================
  async loadEventConfig() {
    try {
      const data = await API.events.getAdminConfig().catch(() => API.events.getActive());
      if (data && data.event) {
        this.activeEvent = data.event;
        const ev = data.event;

        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = val !== undefined && val !== null ? val : '';
        };

        const setCheck = (id, checked) => {
          const el = document.getElementById(id);
          if (el) el.checked = !!checked;
        };

        setVal('cfg-event-title', ev.title);
        setVal('cfg-event-type', ev.type);
        setVal('cfg-event-tagline', ev.tagline);
        setVal('cfg-event-date', ev.date);
        setVal('cfg-event-location', ev.location);
        setVal('cfg-event-currency', ev.currency || 'ARS');
        setVal('cfg-event-video', ev.hero_video_url);
        setVal('cfg-event-banner', ev.banner_url);
        setVal('cfg-event-status', ev.status);
        setVal('cfg-event-description', ev.description);

        // Secciones Visibilidad
        setCheck('cfg-show-experiences', ev.show_experiences !== 0);
        setCheck('cfg-show-lineup', ev.show_lineup !== 0);

        // Media Kit
        setVal('cfg-mediakit-link', ev.mediakit_download_link);
        setVal('cfg-mediakit-file', ev.mediakit_file_url);
        const fileStatus = document.getElementById('cfg-mediakit-file-status');
        if (fileStatus) {
          fileStatus.textContent = ev.mediakit_file_url ? `PDF cargado: ${ev.mediakit_file_url.split('/').pop()}` : 'Ningún archivo subido aún';
        }

        // dLocal Go (Enmascarado y Protegido)
        setVal('cfg-dlocal-env', ev.dlocal_env || 'production');
        setVal('cfg-dlocal-key', ev.dlocal_api_key_masked || ev.dlocal_api_key || '');
        setVal('cfg-dlocal-secret', ev.dlocal_api_secret_masked || (ev.has_dlocal_secret ? '••••••••••••••••' : ''));
      }
    } catch (err) {
      console.error('Error cargando config evento:', err);
    }
  },

  async loadTicketTiersAdmin() {
    try {
      const data = await API.tickets.getAllTiersAdmin();
      if (!data || !data.tiers) return;

      this.ticketTiers = data.tiers;
      const container = document.getElementById('admin-tiers-editor-container');
      if (!container) return;

      const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';

      container.innerHTML = data.tiers.map(t => `
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.25rem; border: 1px solid var(--border-color);">
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 1rem; align-items: flex-end; margin-bottom: 1rem;">
            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">Nombre del Pase / Entrada:</label>
              <input type="text" id="tier-name-${t.id}" class="form-control" value="${t.name}">
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">Precio (${currency}):</label>
              <input type="number" id="tier-price-${t.id}" class="form-control" value="${t.price}" step="100">
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">Cupos / Stock:</label>
              <input type="number" id="tier-stock-${t.id}" class="form-control" value="${t.stock}">
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">Badge / Etiqueta:</label>
              <input type="text" id="tier-badge-${t.id}" class="form-control" value="${t.badge || ''}">
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">Estado del Pase:</label>
              <select id="tier-status-${t.id}" class="form-control">
                <option value="activa" ${t.tier_status === 'activa' || !t.tier_status ? 'selected' : ''}>🟢 Activa / Disponible</option>
                <option value="agotada" ${t.tier_status === 'agotada' ? 'selected' : ''}>🔴 Agotada (Sold Out)</option>
                <option value="oculta" ${t.tier_status === 'oculta' ? 'selected' : ''}>⚪ Oculta (No visible)</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.85rem; color:var(--text-secondary);">
              Vendidos: <strong>${t.sold_count}</strong> pases | Disponibles: <strong>${t.stock - t.sold_count}</strong>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-gold btn-sm" onclick="AdminApp.saveTierPrice(${t.id})">
                <i class="bi bi-check-lg"></i> Guardar Cambios
              </button>
              <button class="btn btn-outline btn-sm text-red" onclick="AdminApp.deleteTier(${t.id})">
                <i class="bi bi-trash"></i> Eliminar
              </button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error cargando tiers admin:', err);
    }
  },

  async saveTierPrice(tierId) {
    const name = document.getElementById(`tier-name-${tierId}`)?.value?.trim() || '';
    const price = document.getElementById(`tier-price-${tierId}`)?.value || 0;
    const stock = document.getElementById(`tier-stock-${tierId}`)?.value || 0;
    const badge = document.getElementById(`tier-badge-${tierId}`)?.value?.trim() || '';
    const tier_status = document.getElementById(`tier-status-${tierId}`)?.value || 'activa';

    const tier = this.ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    try {
      await API.tickets.updateTier(tierId, {
        name: name || tier.name,
        price: parseFloat(price) || 0,
        stock: parseInt(stock) || 0,
        badge,
        tier_status,
        is_active: tier_status !== 'oculta' ? 1 : 0,
        features: tier.features_json
      });
      window.Toast.success(`Pase '${name || tier.name}' actualizado.`);
      await this.loadFinancialStats();
      await this.loadTicketTiersAdmin();
      if (window.LandingApp) window.LandingApp.loadTicketTiers();
    } catch (err) {
      window.Toast.error('Error al actualizar pase.');
    }
  },

  openNewTierModal() {
    this.openModal('new-tier-modal');
  },

  async deleteTier(id) {
    if (!confirm('¿Eliminar este tipo de entrada?')) return;
    try {
      await API.request(`/api/tickets/tiers/${id}`, { method: 'DELETE' });
      window.Toast.success('Tipo de entrada eliminado.');
      await this.loadTicketTiersAdmin();
      await this.loadFinancialStats();
      if (window.LandingApp) window.LandingApp.loadTicketTiers();
    } catch (err) {
      window.Toast.error('Error al eliminar pase.');
    }
  },

  // ==========================================
  // EXPERIENCIAS MULTISENSORIALES (CRUD)
  // ==========================================
    async loadExperiencesAdmin() {
    try {
      const [res, evRes] = await Promise.all([
        API.experiences.getAllAdmin(),
        API.events.getActive()
      ]);
      this.experiences = res.experiences || [];
      const isVisible = evRes.event ? evRes.event.show_experiences !== 0 : true;
      const container = document.getElementById('admin-experiences-container');
      if (!container) return;

      const headerBar = `
        <div style="background: var(--bg-secondary); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <span style="font-size:0.9rem; font-weight:600;">Estado en la Web Pública:</span>
            <span class="badge ${isVisible ? 'badge-green' : 'badge-red'}" style="margin-left:0.5rem; font-size:0.85rem;">
              <i class="bi ${isVisible ? 'bi-eye-fill' : 'bi-eye-slash-fill'}"></i> ${isVisible ? '🟢 SECCIÓN VISIBLE' : '⚪ SECCIÓN OCULTA'}
            </span>
          </div>
          <button class="btn btn-sm ${isVisible ? 'btn-outline text-yellow' : 'btn-gold'}" onclick="AdminApp.toggleSectionVisibility('experiences')">
            <i class="bi ${isVisible ? 'bi-eye-slash' : 'bi-eye'}"></i> ${isVisible ? 'Ocultar Sección Completa de la Web' : 'Habilitar Sección en la Web'}
          </button>
        </div>
      `;

      if (this.experiences.length === 0) {
        container.innerHTML = `
          ${headerBar}
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            <i class="bi bi-stars" style="font-size:2rem; opacity:0.5; display:block; margin-bottom:0.5rem;"></i>
            No hay experiencias cargadas. Haz clic en "+ Nueva Experiencia" para agregar una.
          </div>
        `;
        return;
      }

      container.innerHTML = `
        ${headerBar}
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
          ${this.experiences.map(exp => `
            <div class="glass-panel" style="padding: 1rem; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="height: 120px; border-radius: var(--radius-sm); overflow:hidden; margin-bottom: 0.75rem; background: var(--bg-secondary);">
                  <img src="${exp.image_url || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80'}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                  <h4 style="margin:0; font-size:1rem;"><i class="bi ${exp.icon || 'bi-stars'} text-gold"></i> ${exp.title}</h4>
                  <span class="badge ${exp.is_active ? 'badge-green' : 'badge-gold'}">${exp.is_active ? 'Activa' : 'Oculta'}</span>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${exp.description}</p>
                <small style="color:var(--text-muted); font-size:0.75rem;">Orden: ${exp.sort_order}</small>
              </div>

              <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border-color);">
                <button class="btn btn-outline btn-sm" onclick="AdminApp.openEditExperienceModal(${exp.id})">
                  <i class="bi bi-pencil-fill text-gold"></i> Editar
                </button>
                <button class="btn btn-outline btn-sm text-red" onclick="AdminApp.deleteExperience(${exp.id})">
                  <i class="bi bi-trash-fill"></i> Eliminar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Error cargando experiencias admin:', err);
    }
  },

  openNewExperienceModal() {
    const form = document.getElementById('form-add-experience');
    if (form) form.reset();
    this.openModal('new-experience-modal');
  },

  openEditExperienceModal(id) {
    const exp = this.experiences.find(e => e.id === id);
    if (!exp) return;

    const setVal = (inputKey, val) => {
      const el = document.getElementById(inputKey);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('edit-exp-id', exp.id);
    setVal('edit-exp-title', exp.title);
    setVal('edit-exp-desc', exp.description);
    setVal('edit-exp-icon', exp.icon || 'bi-stars');
    setVal('edit-exp-order', exp.sort_order || 0);
    setVal('edit-exp-image', exp.image_url || '');

    this.openModal('edit-experience-modal');
  },

  async deleteExperience(id) {
    if (!confirm('¿Eliminar esta experiencia multisensorial?')) return;
    try {
      await API.experiences.delete(id);
      window.Toast.success('Experiencia eliminada.');
      await this.loadExperiencesAdmin();
      if (window.LandingApp) window.LandingApp.loadExperiences();
    } catch (err) {
      window.Toast.error('Error al eliminar experiencia.');
    }
  },

  // ==========================================
  // TALENTO & LINEUP / SPEAKERS (CRUD)
  // ==========================================
    async loadArtistsAdmin() {
    try {
      const [artRes, evRes] = await Promise.all([
        API.artists.getAllAdmin(),
        API.events.getActive()
      ]);
      this.artists = artRes.artists || [];
      const isVisible = evRes.event ? evRes.event.show_lineup !== 0 : true;
      const container = document.getElementById('admin-artists-container');
      if (!container) return;

      const headerBar = `
        <div style="background: var(--bg-secondary); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <span style="font-size:0.9rem; font-weight:600;">Estado en la Web Pública:</span>
            <span class="badge ${isVisible ? 'badge-green' : 'badge-red'}" style="margin-left:0.5rem; font-size:0.85rem;">
              <i class="bi ${isVisible ? 'bi-eye-fill' : 'bi-eye-slash-fill'}"></i> ${isVisible ? '🟢 SECCIÓN VISIBLE' : '⚪ SECCIÓN OCULTA'}
            </span>
          </div>
          <button class="btn btn-sm ${isVisible ? 'btn-outline text-yellow' : 'btn-gold'}" onclick="AdminApp.toggleSectionVisibility('lineup')">
            <i class="bi ${isVisible ? 'bi-eye-slash' : 'bi-eye'}"></i> ${isVisible ? 'Ocultar Sección Completa de la Web' : 'Habilitar Sección en la Web'}
          </button>
        </div>
      `;

      if (this.artists.length === 0) {
        container.innerHTML = `
          ${headerBar}
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            <i class="bi bi-people" style="font-size:2rem; opacity:0.5; display:block; margin-bottom:0.5rem;"></i>
            No hay artistas ni speakers cargados. Haz clic en "+ Nuevo Artista / Speaker" para agregar uno.
          </div>
        `;
        return;
      }

      container.innerHTML = `
        ${headerBar}
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
          ${this.artists.map(art => `
            <div class="glass-panel" style="padding: 1rem; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; gap:1rem; align-items:center; margin-bottom:0.75rem;">
                  <img src="${art.image_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}" style="width:55px; height:55px; border-radius:50%; object-fit:cover; border:2px solid var(--accent-gold);">
                  <div>
                    <h4 style="margin:0; font-size:1rem;">${art.name}</h4>
                    <span class="badge badge-sunset" style="font-size:0.72rem;">${art.role_title}</span>
                  </div>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${art.bio || 'Sin biografía.'}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted);">
                  <span>Cat: <strong>${art.category}</strong></span>
                  ${art.instagram_url ? `<a href="${art.instagram_url}" target="_blank" style="color:var(--accent-gold);"><i class="bi bi-instagram"></i> Perfil</a>` : ''}
                </div>
              </div>

              <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border-color);">
                <button class="btn btn-outline btn-sm" onclick="AdminApp.openEditArtistModal(${art.id})">
                  <i class="bi bi-pencil-fill text-gold"></i> Editar
                </button>
                <button class="btn btn-outline btn-sm text-red" onclick="AdminApp.deleteArtist(${art.id})">
                  <i class="bi bi-trash-fill"></i> Eliminar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Error cargando artistas admin:', err);
    }
  },

  openNewArtistModal() {
    const form = document.getElementById('form-add-artist');
    if (form) form.reset();
    this.openModal('new-artist-modal');
  },

  openEditArtistModal(id) {
    const art = this.artists.find(a => a.id === id);
    if (!art) return;

    const setVal = (inputKey, val) => {
      const el = document.getElementById(inputKey);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('edit-art-id', art.id);
    setVal('edit-art-name', art.name);
    setVal('edit-art-role', art.role_title);
    setVal('edit-art-cat', art.category || 'diseñador');
    setVal('edit-art-bio', art.bio || '');
    setVal('edit-art-ig', art.instagram_url || '');
    setVal('edit-art-order', art.sort_order || 0);
    setVal('edit-art-image', art.image_url || '');

    this.openModal('edit-artist-modal');
  },

  
  async toggleSectionVisibility(section) {
    try {
      const res = await API.events.toggleSection(section);
      if (res && res.success) {
        window.Toast.success(res.message || 'Visibilidad actualizada.');
        if (section === 'lineup' || section === 'artists') {
          await this.loadArtistsAdmin();
          if (window.LandingApp) await window.LandingApp.loadArtists();
        } else if (section === 'experiences') {
          await this.loadExperiencesAdmin();
          if (window.LandingApp) await window.LandingApp.loadExperiences();
        }
      } else {
        window.Toast.error(res?.error || 'No se pudo alternar la visibilidad.');
      }
    } catch (err) {
      console.error('Error alternando visibilidad:', err);
      window.Toast.error('Error al actualizar visibilidad de la sección.');
    }
  },

  async deleteArtist(id) {
    if (!confirm('¿Eliminar este artista/speaker del lineup?')) return;
    try {
      await API.artists.delete(id);
      window.Toast.success('Artista eliminado.');
      await this.loadArtistsAdmin();
      if (window.LandingApp) window.LandingApp.loadArtists();
    } catch (err) {
      window.Toast.error('Error al eliminar artista.');
    }
  },

  // ==========================================
  // TAB 4: VENDEDORES & RRPP (LINKS DIRECTOS /LUCAS)
  // ==========================================
  async loadPromotersAdmin() {
    try {
      const res = await API.promoters.getAll();
      this.promoters = res.promoters || [];
      const body = document.getElementById('promoters-table-body');
      if (!body) return;

      if (this.promoters.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">No hay vendedores registrados.</td></tr>`;
        return;
      }

      const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';

      body.innerHTML = this.promoters.map(p => {
        const slug = p.slug || p.promo_code.toLowerCase();
        const friendlyLink = `${window.location.origin}/${slug}`;
        return `
          <tr>
            <td>
              <strong>${p.name}</strong><br>
              <small class="text-muted">${p.email || ''} ${p.phone ? '• ' + p.phone : ''}</small>
            </td>
            <td>
              <strong style="color:var(--accent-gold);">${p.promo_code}</strong>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <code style="background:var(--bg-secondary); padding:0.25rem 0.6rem; border-radius:4px; font-size:0.85rem; color:var(--accent-gold);">${friendlyLink}</code>
                <button class="btn btn-sm btn-gold" title="Copiar Enlace Directo" onclick="AdminApp.copyAffiliateLink('${slug}')">
                  <i class="bi bi-copy"></i> Copiar
                </button>
              </div>
            </td>
            <td><strong style="color:var(--status-green);">${p.commission_percentage}%</strong></td>
            <td>${p.total_sales_count} entradas</td>
            <td><strong style="color:var(--accent-gold);">$${p.total_commission_earned.toLocaleString('es-AR')} ${currency}</strong></td>
            <td>
              <div class="table-actions">
                <button class="btn-icon" title="Eliminar" onclick="AdminApp.deletePromoter(${p.id})">
                  <i class="bi bi-trash-fill text-red"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando promotores:', err);
    }
  },

  copyAffiliateLink(slug) {
    const link = `${window.location.origin}/${slug}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        window.Toast.success(`¡Enlace copiado! ${link}`);
      }).catch(() => {
        prompt('Copia este enlace de vendedor:', link);
      });
    } else {
      prompt('Copia este enlace de vendedor:', link);
    }
  },

  openNewPromoterModal() {
    this.openModal('new-promoter-modal');
  },

  async deletePromoter(id) {
    if (!confirm('¿Eliminar este vendedor/promotor?')) return;
    try {
      await API.promoters.delete(id);
      window.Toast.success('Promotor eliminado.');
      await this.loadPromotersAdmin();
      await this.loadFinancialStats();
    } catch (err) {
      window.Toast.error('Error al eliminar promotor');
    }
  },

  // ==========================================
  // TAB 5: ESCÁNER QR & ACREDITACIONES EN PUERTA
  // ==========================================
  
  // Escáner interactivo con Cámara en Vivo & Feedback Sonoro
  html5QrScanner: null,
  isCameraScanning: false,
  isProcessingQr: false,

  playAudioBeep(type = 'success') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.setValueAtTime(120, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.log('Audio feedback:', e);
    }
  },

  async startQrCamera() {
    const readerEl = document.getElementById('qr-camera-reader');
    const startBtn = document.getElementById('btn-start-camera');
    const stopBtn = document.getElementById('btn-stop-camera');
    const selectWrap = document.getElementById('qr-camera-select-wrap');
    const cameraSelect = document.getElementById('qr-camera-select');
    const placeholder = document.getElementById('qr-camera-placeholder');

    if (typeof Html5Qrcode === 'undefined') {
      window.Toast.error('Cargando motor de cámara. Reintenta en 2 segundos.');
      return;
    }

    try {
      if (placeholder) placeholder.style.display = 'none';
      if (!this.html5QrScanner) {
        this.html5QrScanner = new Html5Qrcode('qr-camera-reader');
      }

      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        window.Toast.error('No se detectaron cámaras disponibles.');
        if (placeholder) placeholder.style.display = 'block';
        return;
      }

      if (cameraSelect && devices.length > 0) {
        cameraSelect.innerHTML = devices.map(d => `<option value="${d.id}">${d.label || 'Cámara ' + d.id}</option>`).join('');
        if (selectWrap) selectWrap.style.display = 'block';
      }

      const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;
      if (cameraSelect) cameraSelect.value = cameraId;

      await this.html5QrScanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (this.isProcessingQr) return;
          this.isProcessingQr = true;
          await this.validateQRCode(decodedText);
          setTimeout(() => { this.isProcessingQr = false; }, 2500);
        },
        () => {}
      );

      this.isCameraScanning = true;
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      window.Toast.success('Cámara activada. Enfoca el código QR.');
    } catch (err) {
      console.error('Error iniciando cámara:', err);
      window.Toast.error('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      if (placeholder) placeholder.style.display = 'block';
    }
  },

  async stopQrCamera() {
    const startBtn = document.getElementById('btn-start-camera');
    const stopBtn = document.getElementById('btn-stop-camera');
    const selectWrap = document.getElementById('qr-camera-select-wrap');
    const placeholder = document.getElementById('qr-camera-placeholder');

    if (this.html5QrScanner && this.isCameraScanning) {
      try {
        await this.html5QrScanner.stop();
        this.isCameraScanning = false;
      } catch (e) {
        console.error('Error stopping camera:', e);
      }
    }

    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (selectWrap) selectWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
  },

  async switchQrCamera(cameraId) {
    if (!this.html5QrScanner || !this.isCameraScanning) return;
    try {
      await this.html5QrScanner.stop();
      await this.html5QrScanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (this.isProcessingQr) return;
          this.isProcessingQr = true;
          await this.validateQRCode(decodedText);
          setTimeout(() => { this.isProcessingQr = false; }, 2500);
        },
        () => {}
      );
    } catch (e) {
      console.error('Error switching camera:', e);
    }
  },

  async resendTicketEmail(ticketCode) {
    try {
      window.Toast.info(`Reenviando correo con voucher y QR (${ticketCode})...`);
      const res = await API.request(`/api/tickets/resend-email/${encodeURIComponent(ticketCode)}`, {
        method: 'POST'
      });
      if (res && res.success) {
        window.Toast.success(res.message || 'Correo reenviado exitosamente.');
      } else {
        window.Toast.error(res?.error || 'Error al reenviar correo.');
      }
    } catch (err) {
      console.error('Error reenviando correo:', err);
      window.Toast.error(err.message || 'Error al reenviar correo.');
    }
  },

  initQRScannerHandlers() {
    const qrForm = document.getElementById('qr-scanner-input-form');
    if (qrForm) {
      qrForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('qr-manual-code-input');
        const code = codeInput?.value?.trim() || '';
        if (!code) return;

        await this.validateQRCode(code);
        if (codeInput) codeInput.value = '';
      });
    }
  },

    async validateQRCode(code) {
    const resultBox = document.getElementById('qr-scan-result-card');
    if (!resultBox) return;

    resultBox.style.display = 'block';
    resultBox.className = 'glass-panel';
    resultBox.innerHTML = '<div style="text-align:center; padding:1.5rem;"><i class="bi bi-arrow-repeat spin"></i> Verificando entrada en la base de datos...</div>';

    try {
      const res = await API.request('/api/tickets/validate-qr', {
        method: 'POST',
        body: JSON.stringify({ code })
      });

      if (res.status === 'valid') {
        const s = res.sale;
        this.playAudioBeep('success');
        resultBox.style.border = '2px solid var(--status-green)';
        resultBox.style.background = 'rgba(16, 185, 129, 0.12)';
        resultBox.innerHTML = `
          <div style="text-align:center; padding:1.5rem;">
            <div style="font-size:3.2rem; color:var(--status-green);"><i class="bi bi-check-circle-fill"></i></div>
            <h2 style="color:var(--status-green); margin:0.5rem 0;">¡ACCESO PERMITIDO!</h2>
            <div style="font-size:1.3rem; font-weight:700;">${s.buyer_name}</div>
            <div style="color:var(--accent-gold); font-weight:600; font-size:1.05rem; margin:0.25rem 0;">${s.tier_name} (${s.quantity} pase/s)</div>
            <div style="font-family:var(--font-mono); margin-top:0.5rem; color:var(--text-muted); font-size:0.9rem;">Código: ${s.ticket_code}</div>
            <small style="color:var(--text-secondary); display:block; margin-top:0.6rem;">Acreditado a las ${new Date().toLocaleTimeString()} hs</small>
          </div>
        `;
        window.Toast.success(`Acceso Permitido: ${s.buyer_name}`);
      } else if (res.status === 'already_used') {
        const s = res.sale;
        this.playAudioBeep('error');
        resultBox.style.border = '2px solid var(--status-red)';
        resultBox.style.background = 'rgba(239, 68, 68, 0.15)';
        resultBox.innerHTML = `
          <div style="text-align:center; padding:1.5rem;">
            <div style="font-size:3.2rem; color:var(--status-red);"><i class="bi bi-exclamation-triangle-fill"></i></div>
            <h2 style="color:var(--status-red); margin:0.5rem 0;">⛔ ENTRADA YA UTILIZADA</h2>
            <div style="font-size:1.2rem; font-weight:700;">${s.buyer_name}</div>
            <div style="color:var(--text-secondary); font-size:1rem;">${s.tier_name} (${s.quantity} pase/s)</div>
            <div style="margin-top:0.6rem; color:var(--status-red); font-weight:600;">
              Ingresó el: ${new Date(s.used_at || s.created_at).toLocaleString()}
            </div>
          </div>
        `;
        window.Toast.error('¡Entrada ya utilizada anteriormente!');
      }

      await this.loadAccessStats();
      await this.loadSalesCRM();
    } catch (err) {
      this.playAudioBeep('error');
      resultBox.style.border = '2px solid var(--status-red)';
      resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
      resultBox.innerHTML = `
        <div style="text-align:center; padding:1.5rem;">
          <div style="font-size:3.2rem; color:var(--status-red);"><i class="bi bi-x-circle-fill"></i></div>
          <h2 style="color:var(--status-red); margin:0.5rem 0;">❌ ENTRADA INVÁLIDA</h2>
          <p style="color:var(--text-secondary);">${err.message || 'El código no existe en la base de datos.'}</p>
        </div>
      `;
      window.Toast.error(err.message || 'Código QR no válido.');
    }
  },

  async loadAccessStats() {
    try {
      const res = await API.request('/api/tickets/access-stats');
      if (res && res.stats) {
        const s = res.stats;
        const scannedEl = document.getElementById('stats-qr-scanned');
        const totalEl = document.getElementById('stats-qr-total');
        const remainingEl = document.getElementById('stats-qr-remaining');

        if (scannedEl) scannedEl.textContent = s.total_scanned;
        if (totalEl) totalEl.textContent = s.total_sold;
        if (remainingEl) remainingEl.textContent = s.remaining;
      }
    } catch (e) {}
  },

  // ==========================================
  // TAB 6: RUBROS & STAFF CON BÚSQUEDA Y FILTROS
  // ==========================================
  initProvidersFilterHandlers() {
    const searchInput = document.getElementById('providers-search-input');
    const filterCat = document.getElementById('providers-category-filter');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.applyProvidersFilter());
    }
    if (filterCat) {
      filterCat.addEventListener('change', () => this.applyProvidersFilter());
    }
  },

  async loadCategoriesAndProviders() {
    try {
      const [catsRes, provsRes] = await Promise.all([
        API.expenses.getCategories().catch(() => ({ categories: [] })),
        API.expenses.getProviders().catch(() => ({ providers: [] }))
      ]);

      this.categories = catsRes.categories || [];
      this.providers = provsRes.providers || [];
      this.filteredProviders = this.providers;

      const catSelect = document.getElementById('provider-category-select');
      const catFilter = document.getElementById('providers-category-filter');
      const editCatSelect = document.getElementById('edit-provider-category-select');

      const optionsHtml = this.categories.length > 0 
        ? this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')
        : '<option value="Producción General">Producción General</option><option value="Ambientación & Pasarela">Ambientación & Pasarela</option><option value="Sonido & Iluminación">Sonido & Iluminación</option>';

      if (catSelect) catSelect.innerHTML = optionsHtml;
      if (editCatSelect) editCatSelect.innerHTML = optionsHtml;
      if (catFilter) {
        catFilter.innerHTML = '<option value="todos">Todos los Rubros</option>' + (this.categories.length > 0 ? this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('') : '');
      }

      this.renderProvidersTable();
    } catch (err) {
      console.error('Error cargando rubros/proveedores:', err);
    }
  },

  applyProvidersFilter() {
    const search = document.getElementById('providers-search-input')?.value?.toLowerCase()?.trim() || '';
    const cat = document.getElementById('providers-category-filter')?.value || 'todos';

    this.filteredProviders = this.providers.filter(p => {
      const matchesCat = cat === 'todos' || p.category_name === cat;
      const matchesSearch = !search || 
        (p.provider_name && p.provider_name.toLowerCase().includes(search)) || 
        (p.contact && p.contact.toLowerCase().includes(search)) ||
        (p.notes && p.notes.toLowerCase().includes(search));
      return matchesCat && matchesSearch;
    });

    this.renderProvidersTable();
  },

  renderProvidersTable() {
    const tableBody = document.getElementById('providers-table-body');
    if (!tableBody) return;

    if (this.filteredProviders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No se encontraron proveedores o staff con los filtros actuales.</td></tr>`;
      return;
    }

    const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';

    tableBody.innerHTML = this.filteredProviders.map(p => `
      <tr>
        <td><span class="badge badge-gold">${p.category_name}</span></td>
        <td><strong>${p.provider_name}</strong></td>
        <td>${p.contact || '<span class="text-muted">N/A</span>'}</td>
        <td><strong style="color:var(--accent-gold);">$${p.cost_agreed.toLocaleString('es-AR')} ${currency}</strong></td>
        <td>
          <button class="btn btn-sm ${p.is_paid ? 'btn-gold' : 'btn-outline'}" onclick="AdminApp.toggleProviderPaid(${p.id})">
            <i class="bi ${p.is_paid ? 'bi-check2-circle' : 'bi-clock-history'}"></i> ${p.is_paid ? 'Abonado' : 'Pendiente'}
          </button>
        </td>
        <td><small style="color:var(--text-muted);">${p.notes || '-'}</small></td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" title="Editar Completo" onclick="AdminApp.openEditProviderModal(${p.id})">
              <i class="bi bi-pencil-fill text-gold"></i>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="AdminApp.deleteProvider(${p.id})">
              <i class="bi bi-trash-fill text-red"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  openEditProviderModal(id) {
    const p = this.providers.find(item => item.id === id);
    if (!p) return;

    const setVal = (inputKey, val) => {
      const el = document.getElementById(inputKey);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('edit-provider-id', p.id);
    setVal('edit-provider-category-select', p.category_name);
    setVal('edit-provider-name-input', p.provider_name);
    setVal('edit-provider-contact-input', p.contact || '');
    setVal('edit-provider-cost-input', p.cost_agreed);
    const paidCheck = document.getElementById('edit-provider-paid-check');
    if (paidCheck) paidCheck.checked = p.is_paid === 1;
    setVal('edit-provider-notes-input', p.notes || '');

    this.openModal('edit-provider-modal');
  },

  async toggleProviderPaid(id) {
    const prov = this.providers.find(p => p.id === id);
    if (!prov) return;

    try {
      await API.expenses.updateProvider(id, {
        category_name: prov.category_name,
        provider_name: prov.provider_name,
        contact: prov.contact,
        cost_agreed: prov.cost_agreed,
        is_paid: prov.is_paid ? 0 : 1,
        notes: prov.notes
      });
      window.Toast.success('Estado de pago actualizado');
      await this.loadCategoriesAndProviders();
      await this.loadFinancialStats();
    } catch (err) {
      window.Toast.error('Error actualizando pago.');
    }
  },

  async deleteProvider(id) {
    if (!confirm('¿Estás seguro de eliminar este ítem y presupuesto?')) return;
    try {
      await API.expenses.deleteProvider(id);
      window.Toast.success('Proveedor eliminado');
      await this.loadCategoriesAndProviders();
      await this.loadFinancialStats();
    } catch (err) {
      window.Toast.error('Error al eliminar proveedor');
    }
  },

  openNewCategoryModal() {
    this.openModal('new-category-modal');
  },

  openNewProviderModal() {
    this.openModal('new-provider-modal');
  },

  // ==========================================
  // TAB 7: CRM DE COMPRADORES
  // ==========================================
  async loadSalesCRM() {
    try {
      const res = await API.tickets.getSales();
      this.sales = res.sales || [];
      const body = document.getElementById('sales-crm-table-body');
      if (!body) return;

      if (this.sales.length === 0) {
        body.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">Aún no hay compras registradas.</td></tr>`;
        return;
      }

      body.innerHTML = this.sales.map(s => `
                <tr>
          <td><strong style="font-family:var(--font-mono); color:var(--accent-gold);">${s.ticket_code || 'SF-2026'}</strong></td>
          <td><strong>${s.buyer_name}</strong><br><small class="text-muted">${s.email} | ${s.phone || ''}</small></td>
          <td><span class="badge badge-sunset">${s.tier_name || 'Pass'}</span></td>
          <td>${s.quantity}</td>
          <td><strong>${s.total_paid.toLocaleString('es-AR')}</strong></td>
          <td>${s.promoter_code ? `<span class="badge badge-purple">${s.promoter_code}</span>` : '<span class="text-muted">Directo</span>'}</td>
          <td>
            <span class="badge ${s.is_used ? 'badge-green' : 'badge-gold'}">
              ${s.is_used ? 'Ingresado' : 'Sin Usar'}
            </span>
          </td>
          <td><span class="badge badge-gold">${s.payment_method}</span></td>
          <td><small>${new Date(s.created_at).toLocaleString('es-AR')}</small></td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="AdminApp.resendTicketEmail('${s.ticket_code}')" title="Reenviar Voucher y QR por Email">
              <i class="bi bi-envelope-arrow-up"></i> Reenviar
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error ventas CRM:', err);
    }
  },

  exportSalesCSV() {
    if (this.sales.length === 0) {
      window.Toast.info('No hay ventas registradas para exportar.');
      return;
    }

    const headers = ['Codigo', 'Comprador', 'Email', 'Telefono', 'Pase', 'Cantidad', 'Total ARS', 'Vendedor', 'Acreditado', 'Fecha'];
    const rows = this.sales.map(s => [
      s.ticket_code,
      `"${s.buyer_name}"`,
      s.email,
      s.phone || '',
      `"${s.tier_name || ''}"`,
      s.quantity,
      s.total_paid,
      s.promoter_code || 'Directo',
      s.is_used ? 'SI' : 'NO',
      new Date(s.created_at).toISOString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `spring_fashion_ventas_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.Toast.success('Ventas exportadas a CSV con éxito.');
  },

  async loadFeedbackCRM() {
    try {
      const res = await API.feedback.getAllAdmin();
      this.feedbackList = res.comments || [];
      const body = document.getElementById('feedback-crm-table-body');
      if (!body) return;

      if (this.feedbackList.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay opiniones de usuarios aún.</td></tr>`;
        return;
      }

      body.innerHTML = this.feedbackList.map(c => `
        <tr>
          <td><strong>${c.user_name}</strong><br><small class="text-muted">${c.email}</small></td>
          <td><span style="color:var(--accent-gold);">${'★'.repeat(c.rating)}</span></td>
          <td><p style="margin:0; font-size:0.88rem; max-width:320px;">"${c.comment_text}"</p></td>
          <td><span class="badge ${c.is_approved ? 'badge-green' : 'badge-red'}">${c.is_approved ? 'Visible en Carrusel' : 'Pendiente / Oculto'}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm ${c.is_approved ? 'btn-outline' : 'btn-gold'}" onclick="AdminApp.toggleFeedbackStatus(${c.id}, ${c.is_approved ? 0 : 1})">
                <i class="bi ${c.is_approved ? 'bi-eye-slash' : 'bi-check2'}"></i> ${c.is_approved ? 'Ocultar' : 'Aprobar'}
              </button>
              <button class="btn-icon" title="Eliminar" onclick="AdminApp.deleteFeedback(${c.id})">
                <i class="bi bi-trash text-red"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error feedback CRM:', err);
    }
  },

  async toggleFeedbackStatus(id, newStatus) {
    try {
      await API.feedback.updateStatus(id, newStatus);
      window.Toast.success('Estado del comentario actualizado');
      await this.loadFeedbackCRM();
      if (window.LandingApp) window.LandingApp.loadTestimonials();
    } catch (err) {
      window.Toast.error('Error al moderar comentario');
    }
  },

  async deleteFeedback(id) {
    if (!confirm('¿Eliminar comentario?')) return;
    try {
      await API.feedback.delete(id);
      window.Toast.success('Comentario eliminado');
      await this.loadFeedbackCRM();
    } catch (err) {
      window.Toast.error('Error al eliminar comentario');
    }
  },

  // ==========================================
  // TAB 8: SPONSORS Y GALERÍA
  // ==========================================
  async loadSponsorsAdmin() {
    try {
      const res = await API.sponsors.getAllAdmin();
      this.sponsors = res.sponsors || [];
      const list = document.getElementById('admin-sponsors-table-body');
      if (!list) return;

      if (this.sponsors.length === 0) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay sponsors cargados.</td></tr>`;
        return;
      }

      list.innerHTML = this.sponsors.map(sp => `
        <tr>
          <td><img src="${sp.logo_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=150&q=80'}" style="height:36px; max-width:80px; object-fit:contain;"></td>
          <td><strong>${sp.company_name}</strong></td>
          <td>${sp.contact_name || '-'}<br><small class="text-muted">${sp.email || ''}</small></td>
          <td><span class="badge badge-sunset">${sp.tier}</span></td>
          <td><span class="badge ${sp.status === 'aprobado' ? 'badge-green' : 'badge-gold'}">${sp.status}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" title="Eliminar" onclick="AdminApp.deleteSponsor(${sp.id})">
                <i class="bi bi-trash-fill text-red"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error cargando sponsors admin:', err);
    }
  },

  async deleteSponsor(id) {
    if (!confirm('¿Eliminar sponsor?')) return;
    try {
      await API.sponsors.delete(id);
      window.Toast.success('Sponsor eliminado');
      await this.loadSponsorsAdmin();
    } catch (err) {
      window.Toast.error('Error al eliminar sponsor');
    }
  },

  async loadGalleryAdmin() {
    try {
      const res = await API.gallery.getItems();
      const container = document.getElementById('admin-gallery-preview-grid');
      if (!container) return;

      container.innerHTML = (res.items || []).map(m => `
        <div style="position:relative; height:120px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
          <img src="${m.thumbnail_url || m.media_url}" style="width:100%; height:100%; object-fit:cover;">
          <button style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.7); border:none; color:#fff; border-radius:4px; padding:2px 6px; cursor:pointer;" onclick="AdminApp.deleteGalleryMedia(${m.id})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error galería admin:', err);
    }
  },

  async deleteGalleryMedia(id) {
    if (!confirm('¿Eliminar de galería?')) return;
    try {
      await API.gallery.delete(id);
      window.Toast.success('Elemento eliminado');
      await this.loadGalleryAdmin();
    } catch (err) {
      window.Toast.error('Error al eliminar');
    }
  },

  // ==========================================
  // FILE UPLOAD LISTENERS
  // ==========================================
  initFileUploadHandlers() {
    // Media Kit PDF
    const mediakitFileInput = document.getElementById('admin-mediakit-file-upload');
    if (mediakitFileInput) {
      mediakitFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo documento Media Kit PDF...');
          const res = await API.uploadFile(file);
          const hiddenInput = document.getElementById('cfg-mediakit-file');
          if (hiddenInput) hiddenInput.value = res.url;
          const status = document.getElementById('cfg-mediakit-file-status');
          if (status) status.textContent = `PDF subido: ${file.name}`;
          window.Toast.success('PDF subido correctamente. Guarda los cambios del evento para confirmar.');
        } catch (err) {
          window.Toast.error(err.message || 'Error al subir Media Kit PDF.');
        }
      });
    }

    // Logo Sponsor
    const fileSponsorInput = document.getElementById('admin-sp-file-upload');
    if (fileSponsorInput) {
      fileSponsorInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo logo...');
          const res = await API.uploadFile(file);
          const logoInput = document.getElementById('admin-sp-logo');
          if (logoInput) logoInput.value = res.url;
          window.Toast.success('Logo subido y URL configurada.');
        } catch (err) {
          window.Toast.error('Error al subir imagen.');
        }
      });
    }

    // Media Galería
    const fileGalleryInput = document.getElementById('admin-gal-file-upload');
    if (fileGalleryInput) {
      fileGalleryInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo archivo...');
          const res = await API.uploadFile(file);
          const urlInput = document.getElementById('admin-gal-url');
          if (urlInput) urlInput.value = res.url;
          window.Toast.success('Archivo subido con éxito.');
        } catch (err) {
          window.Toast.error('Error al subir archivo.');
        }
      });
    }

    // Nueva Experiencia Imagen
    const newExpFileInput = document.getElementById('new-exp-file-upload');
    if (newExpFileInput) {
      newExpFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo imagen de experiencia...');
          const res = await API.uploadFile(file);
          const urlInput = document.getElementById('new-exp-image');
          if (urlInput) urlInput.value = res.url;
          window.Toast.success('Imagen subida con éxito.');
        } catch (err) {
          window.Toast.error('Error al subir imagen.');
        }
      });
    }

    // Editar Experiencia Imagen
    const editExpFileInput = document.getElementById('edit-exp-file-upload');
    if (editExpFileInput) {
      editExpFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo nueva imagen...');
          const res = await API.uploadFile(file);
          const urlInput = document.getElementById('edit-exp-image');
          if (urlInput) urlInput.value = res.url;
          window.Toast.success('Imagen subida con éxito.');
        } catch (err) {
          window.Toast.error('Error al subir imagen.');
        }
      });
    }

    // Nuevo Artista Foto
    const newArtFileInput = document.getElementById('new-art-file-upload');
    if (newArtFileInput) {
      newArtFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo foto del artista...');
          const res = await API.uploadFile(file);
          const urlInput = document.getElementById('new-art-image');
          if (urlInput) urlInput.value = res.url;
          window.Toast.success('Foto subida con éxito.');
        } catch (err) {
          window.Toast.error('Error al subir foto.');
        }
      });
    }

    // Editar Artista Foto
    const editArtFileInput = document.getElementById('edit-art-file-upload');
    if (editArtFileInput) {
      editArtFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          window.Toast.info('Subiendo nueva foto...');
          const res = await API.uploadFile(file);
          const urlInput = document.getElementById('edit-art-image');
          if (urlInput) urlInput.value = res.url;
          window.Toast.success('Foto subida con éxito.');
        } catch (err) {
          window.Toast.error('Error al subir foto.');
        }
      });
    }
  },

  // ==========================================
  // FORM HANDLERS
  // ==========================================
  initFormHandlers() {
    // Configuración General del Evento
    const eventConfigForm = document.getElementById('admin-event-config-form');
    if (eventConfigForm) {
      eventConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const getV = (id) => document.getElementById(id)?.value?.trim() || '';
        const getC = (id) => document.getElementById(id)?.checked ? 1 : 0;

        const title = getV('cfg-event-title');
        const type = document.getElementById('cfg-event-type')?.value || 'Desfile Show / Sunset';
        const tagline = getV('cfg-event-tagline');
        const date = getV('cfg-event-date');
        const location = getV('cfg-event-location');
        const currency = document.getElementById('cfg-event-currency')?.value || 'ARS';
        const hero_video_url = getV('cfg-event-video');
        const banner_url = getV('cfg-event-banner');
        const status = document.getElementById('cfg-event-status')?.value || 'activo';
        const description = getV('cfg-event-description');

        // Secciones Visibilidad & Media Kit & dLocal
        const show_experiences = getC('cfg-show-experiences');
        const show_lineup = getC('cfg-show-lineup');
        const mediakit_download_link = getV('cfg-mediakit-link');
        const mediakit_file_url = getV('cfg-mediakit-file');
        const dlocal_env = document.getElementById('cfg-dlocal-env')?.value || 'sandbox';
        const dlocal_api_key = getV('cfg-dlocal-key');
        const dlocal_api_secret = getV('cfg-dlocal-secret');

        try {
          const res = await API.events.update(this.activeEvent ? this.activeEvent.id : 1, {
            title,
            type,
            tagline,
            date,
            location,
            currency,
            hero_video_url,
            banner_url,
            status,
            description,
            show_experiences,
            show_lineup,
            mediakit_download_link,
            mediakit_file_url,
            dlocal_env,
            dlocal_api_key,
            dlocal_api_secret
          });

          window.Toast.success('Configuración del evento y pasarela actualizadas.');
          this.activeEvent = res.event;
          await this.loadFinancialStats();
          if (window.LandingApp) {
            window.LandingApp.loadEventData();
            window.LandingApp.loadExperiences();
            window.LandingApp.loadArtists();
          }
        } catch (err) {
          window.Toast.error('Error al actualizar configuración.');
        }
      });
    }

    // Nuevo Tipo de Entrada
    const newTierForm = document.getElementById('form-add-tier');
    if (newTierForm) {
      newTierForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('add-tier-name') || document.getElementById('new-tier-name'))?.value?.trim() || '';
        const price = (document.getElementById('add-tier-price') || document.getElementById('new-tier-price'))?.value || 0;
        const stock = (document.getElementById('add-tier-stock') || document.getElementById('new-tier-stock'))?.value || 100;
        const badge = (document.getElementById('add-tier-badge') || document.getElementById('new-tier-badge'))?.value?.trim() || '';
        const tier_status = (document.getElementById('add-tier-status') || document.getElementById('new-tier-status'))?.value || 'activa';
        const rawBenefits = (document.getElementById('add-tier-benefits') || document.getElementById('new-tier-benefits'))?.value?.trim() || '';
        
        let features = ['Acceso general al desfile show', 'Copa de bienvenida', 'Música en vivo & Sunset'];
        if (rawBenefits) {
          features = rawBenefits.split('\n').map(b => b.trim()).filter(Boolean);
        }

        if (!name) {
          window.Toast.error('Por favor ingresa el nombre de la entrada / pase.');
          return;
        }

        try {
          await API.tickets.createTier({
            name,
            price: parseFloat(price) || 0,
            stock: parseInt(stock) || 100,
            badge: badge || 'General',
            tier_status: tier_status || 'activa',
            features
          });
          window.Toast.success(`Nuevo pase '${name}' creado con éxito.`);
          newTierForm.reset();
          this.closeModal('new-tier-modal');
          await this.loadTicketTiersAdmin();
          await this.loadFinancialStats();
          if (window.LandingApp) window.LandingApp.loadTicketTiers();
        } catch (err) {
          window.Toast.error(err.message || 'Error al crear tipo de entrada.');
        }
      });
    }

    // Nueva Experiencia Multisensorial
    const newExpForm = document.getElementById('form-add-experience');
    if (newExpForm) {
      newExpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = (document.getElementById('add-exp-title') || document.getElementById('new-exp-title'))?.value?.trim() || '';
        const description = (document.getElementById('add-exp-desc') || document.getElementById('new-exp-desc'))?.value?.trim() || '';
        const icon = (document.getElementById('add-exp-icon') || document.getElementById('new-exp-icon'))?.value?.trim() || 'bi-stars';
        const sort_order = parseInt((document.getElementById('add-exp-order') || document.getElementById('new-exp-order'))?.value) || 0;
        const image_url = (document.getElementById('add-exp-image') || document.getElementById('new-exp-image'))?.value?.trim() || '';

        try {
          await API.experiences.create({
            title,
            description,
            icon,
            sort_order,
            image_url,
            is_active: 1
          });
          window.Toast.success(`Experiencia '${title}' creada.`);
          newExpForm.reset();
          this.closeModal('new-experience-modal');
          await this.loadExperiencesAdmin();
          if (window.LandingApp) window.LandingApp.loadExperiences();
        } catch (err) {
          window.Toast.error(err.message || 'Error al crear experiencia.');
        }
      });
    }

    // Editar Experiencia Multisensorial
    const editExpForm = document.getElementById('form-edit-experience');
    if (editExpForm) {
      editExpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-exp-id')?.value;
        const title = document.getElementById('edit-exp-title')?.value?.trim() || '';
        const description = document.getElementById('edit-exp-desc')?.value?.trim() || '';
        const icon = document.getElementById('edit-exp-icon')?.value?.trim() || 'bi-stars';
        const sort_order = parseInt(document.getElementById('edit-exp-order')?.value) || 0;
        const image_url = document.getElementById('edit-exp-image')?.value?.trim() || '';

        try {
          await API.experiences.update(id, {
            title,
            description,
            icon,
            sort_order,
            image_url,
            is_active: 1
          });
          window.Toast.success('Experiencia actualizada.');
          this.closeModal('edit-experience-modal');
          await this.loadExperiencesAdmin();
          if (window.LandingApp) window.LandingApp.loadExperiences();
        } catch (err) {
          window.Toast.error(err.message || 'Error al actualizar experiencia.');
        }
      });
    }

    // Nuevo Artista / Speaker
    const newArtForm = document.getElementById('form-add-artist');
    if (newArtForm) {
      newArtForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('add-art-name') || document.getElementById('new-art-name'))?.value?.trim() || '';
        const role_title = (document.getElementById('add-art-role') || document.getElementById('new-art-role'))?.value?.trim() || '';
        const category = (document.getElementById('add-art-cat') || document.getElementById('new-art-cat'))?.value || 'DJ';
        const bio = (document.getElementById('add-art-bio') || document.getElementById('new-art-bio'))?.value?.trim() || '';
        const instagram_url = (document.getElementById('add-art-insta') || document.getElementById('new-art-ig') || document.getElementById('new-art-insta'))?.value?.trim() || '';
        const sort_order = parseInt((document.getElementById('add-art-order') || document.getElementById('new-art-order'))?.value) || 0;
        const image_url = (document.getElementById('add-art-image') || document.getElementById('new-art-image'))?.value?.trim() || '';

        try {
          await API.artists.create({
            name,
            role_title,
            category,
            bio,
            instagram_url,
            sort_order,
            image_url,
            is_active: 1
          });
          window.Toast.success(`Artista/Speaker '${name}' agregado al lineup.`);
          newArtForm.reset();
          this.closeModal('new-artist-modal');
          await this.loadArtistsAdmin();
          if (window.LandingApp) window.LandingApp.loadArtists();
        } catch (err) {
          window.Toast.error(err.message || 'Error al crear artista.');
        }
      });
    }

    // Editar Artista / Speaker
    const editArtForm = document.getElementById('form-edit-artist');
    if (editArtForm) {
      editArtForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-art-id')?.value;
        const name = document.getElementById('edit-art-name')?.value?.trim() || '';
        const role_title = document.getElementById('edit-art-role')?.value?.trim() || '';
        const category = document.getElementById('edit-art-cat')?.value || 'artista';
        const bio = document.getElementById('edit-art-bio')?.value?.trim() || '';
        const instagram_url = document.getElementById('edit-art-ig')?.value?.trim() || '';
        const sort_order = parseInt(document.getElementById('edit-art-order')?.value) || 0;
        const image_url = document.getElementById('edit-art-image')?.value?.trim() || '';

        try {
          await API.artists.update(id, {
            name,
            role_title,
            category,
            bio,
            instagram_url,
            sort_order,
            image_url,
            is_active: 1
          });
          window.Toast.success('Artista/Lineup actualizado con éxito.');
          this.closeModal('edit-artist-modal');
          await this.loadArtistsAdmin();
          if (window.LandingApp) window.LandingApp.loadArtists();
        } catch (err) {
          window.Toast.error(err.message || 'Error al actualizar artista.');
        }
      });
    }

    // Editar Proveedor / Gasto
    const editProvForm = document.getElementById('form-edit-provider');
    if (editProvForm) {
      editProvForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-provider-id')?.value;
        const category_name = document.getElementById('edit-provider-category-select')?.value || 'Producción General';
        const provider_name = document.getElementById('edit-provider-name-input')?.value?.trim() || '';
        const contact = document.getElementById('edit-provider-contact-input')?.value?.trim() || '';
        const cost_agreed = document.getElementById('edit-provider-cost-input')?.value || 0;
        const is_paid = document.getElementById('edit-provider-paid-check')?.checked ? 1 : 0;
        const notes = document.getElementById('edit-provider-notes-input')?.value?.trim() || '';

        try {
          await API.expenses.updateProvider(id, {
            category_name,
            provider_name,
            contact,
            cost_agreed: parseFloat(cost_agreed) || 0,
            is_paid,
            notes
          });
          window.Toast.success('Datos del proveedor actualizados con éxito.');
          this.closeModal('edit-provider-modal');
          await this.loadCategoriesAndProviders();
          await this.loadFinancialStats();
        } catch (err) {
          window.Toast.error(err.message || 'Error al actualizar proveedor.');
        }
      });
    }

    // Nuevo Promotor
    const promoterForm = document.getElementById('form-add-promoter');
    if (promoterForm) {
      promoterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('add-prom-name') || document.getElementById('new-promo-name'))?.value?.trim() || '';
        const email = (document.getElementById('add-prom-email') || document.getElementById('new-promo-email'))?.value?.trim() || '';
        const phone = (document.getElementById('add-prom-phone') || document.getElementById('new-promo-phone'))?.value?.trim() || '';
        let slug = (document.getElementById('add-prom-slug') || document.getElementById('new-promo-slug'))?.value?.trim() || '';
        slug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        const promo_code = (document.getElementById('add-prom-code') || document.getElementById('new-promo-code'))?.value?.trim()?.toUpperCase() || slug.toUpperCase();
        const split_code = (document.getElementById('add-prom-split-code') || document.getElementById('new-promo-split-code'))?.value?.trim() || '';
        const commission_percentage = parseFloat((document.getElementById('add-prom-commission') || document.getElementById('new-promo-comm'))?.value) || 10.00;

        if (!name || !email) {
          window.Toast.error('Por favor ingresa nombre y email del vendedor.');
          return;
        }

        try {
          await API.promoters.create({
            name,
            email,
            phone,
            slug,
            promo_code,
            split_code,
            commission_percentage
          });
          window.Toast.success(`¡Vendedor '${name}' registrado! Link: ${window.location.origin}/${slug}`);
          promoterForm.reset();
          this.closeModal('new-promoter-modal');
          await this.loadPromotersAdmin();
          await this.loadFinancialStats();
        } catch (err) {
          window.Toast.error(err.message || 'Error al registrar vendedor.');
        }
      });
    }

    // Nuevo Rubro
    const catForm = document.getElementById('form-add-category');
    if (catForm) {
      catForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('add-cat-name') || document.getElementById('new-cat-name'))?.value?.trim() || '';
        const color = (document.getElementById('add-cat-color') || document.getElementById('new-cat-color'))?.value || '#f59e0b';

        if (!name) return;

        try {
          await API.expenses.createCategory({ name, color });
          window.Toast.success(`Nuevo rubro '${name}' añadido.`);
          catForm.reset();
          this.closeModal('new-category-modal');
          await this.loadCategoriesAndProviders();
        } catch (err) {
          window.Toast.error(err.message || 'Error al crear rubro');
        }
      });
    }

    // Nuevo Proveedor
    const provForm = document.getElementById('form-add-provider');
    if (provForm) {
      provForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category_name = document.getElementById('provider-category-select')?.value || 'Producción General';
        const provider_name = (document.getElementById('add-prov-name') || document.getElementById('provider-name-input'))?.value?.trim() || '';
        const contact = (document.getElementById('add-prov-contact') || document.getElementById('provider-contact-input'))?.value?.trim() || '';
        const cost_agreed = (document.getElementById('add-prov-cost') || document.getElementById('provider-cost-input'))?.value || 0;
        const is_paid = (document.getElementById('add-prov-is-paid') || document.getElementById('provider-paid-check'))?.checked ? 1 : 0;
        const notes = (document.getElementById('add-prov-notes') || document.getElementById('provider-notes-input'))?.value?.trim() || '';

        if (!provider_name) {
          window.Toast.error('Por favor ingresa el nombre del proveedor.');
          return;
        }

        try {
          await API.expenses.createProvider({
            category_name,
            provider_name,
            contact,
            cost_agreed: parseFloat(cost_agreed) || 0,
            is_paid,
            notes
          });
          window.Toast.success('Proveedor registrado con éxito.');
          provForm.reset();
          this.closeModal('new-provider-modal');
          await this.loadCategoriesAndProviders();
          await this.loadFinancialStats();
        } catch (err) {
          window.Toast.error(err.message || 'Error al guardar proveedor.');
        }
      });
    }

    // Nuevo Sponsor
    const sponsorForm = document.getElementById('admin-add-sponsor-form');
    if (sponsorForm) {
      sponsorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const company_name = document.getElementById('admin-sp-name')?.value?.trim() || '';
        const tier = document.getElementById('admin-sp-tier')?.value || 'Gold';
        const logo_url = document.getElementById('admin-sp-logo')?.value?.trim() || '';
        const website_url = document.getElementById('admin-sp-web')?.value?.trim() || '';
        const proposal = document.getElementById('admin-sp-prop')?.value?.trim() || '';

        try {
          await API.sponsors.create({
            company_name,
            tier,
            logo_url,
            website_url,
            proposal,
            status: 'aprobado'
          });
          window.Toast.success('Sponsor agregado al listado y grilla pública.');
          sponsorForm.reset();
          await this.loadSponsorsAdmin();
          if (window.LandingApp) window.LandingApp.loadSponsors();
        } catch (err) {
          window.Toast.error('Error al agregar sponsor.');
        }
      });
    }

    // Nueva Media Galería
    const galleryForm = document.getElementById('admin-add-gallery-form');
    if (galleryForm) {
      galleryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('admin-gal-title')?.value?.trim() || '';
        const media_type = document.getElementById('admin-gal-type')?.value || 'image';
        const category = document.getElementById('admin-gal-cat')?.value || 'desfile';
        const media_url = document.getElementById('admin-gal-url')?.value?.trim() || '';

        try {
          await API.gallery.create({
            title,
            media_type,
            category,
            media_url
          });
          window.Toast.success('Elemento agregado a la galería multimedia.');
          galleryForm.reset();
          await this.loadGalleryAdmin();
          if (window.LandingApp) window.LandingApp.loadGallery();
        } catch (err) {
          window.Toast.error('Error al agregar a galería.');
        }
      });
    }
  }
};

window.AdminApp = AdminApp;
