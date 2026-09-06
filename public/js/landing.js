/**
 * LÓGICA DE INTERACTIVIDAD DE LA LANDING PÚBLICA (SPRING FASHION)
 * Con soporte de Experiencias y Lineup dinámicos, Carrusel de Galería (3s), Checkout con botón Abonar y Referidos silenciosos.
 */

const LandingApp = {
  activeEvent: null,
  ticketTiers: [],
  selectedTier: null,
  ticketQuantity: 1,
  selectedPaymentMethod: 'Pago Seguro',
  appliedPromoCode: '',

  // Carrusel de Testimonios (5s)
  testimonialInterval: null,
  currentSlideIndex: 0,
  testimonials: [],
  isCarouselPaused: false,

  // Carrusel de Galería Interactiva (3s)
  galleryInterval: null,
  currentGalleryIndex: 0,
  galleryItems: [],
  isGalleryPaused: false,

  async init() {
    this.checkUrlReferral();
    await this.loadEventData();
    await this.loadExperiences();
    await this.loadGallery();
    await this.loadArtists();
    await this.loadSponsors();
    await this.loadTicketTiers();
    await this.loadTestimonials();
    this.initCountdown();
    this.initGalleryFilters();
    this.initFaqAccordion();
    this.initB2BTabs();
    this.initCommunityForm();
    this.initCheckoutHandlers();
  },

  // 1. Detectar enlace de afiliado/promotor silenciosamente (?ref=lucas o /lucas)
  checkUrlReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('promoter') || params.get('rrpp');
    if (ref) {
      this.appliedPromoCode = ref.trim().toUpperCase();
      sessionStorage.setItem('sf_promoter_ref', this.appliedPromoCode);
    } else {
      this.appliedPromoCode = sessionStorage.getItem('sf_promoter_ref') || '';
    }
  },

  // ==========================================
  // 2. CARGA DE DATOS DEL EVENTO Y HERO
  // ==========================================
  async loadEventData() {
    try {
      const data = await API.events.getActive();
      if (data && data.event) {
        this.activeEvent = data.event;
        this.renderEventDetails(data.event);
      }
    } catch (err) {
      console.error('Error cargando evento:', err);
    }
  },

  renderEventDetails(event) {
    const titleEls = document.querySelectorAll('.dynamic-event-title');
    titleEls.forEach(el => el.textContent = event.title);

    const typeEls = document.querySelectorAll('.dynamic-event-type');
    typeEls.forEach(el => el.textContent = event.type);

    const taglineEl = document.getElementById('hero-tagline');
    if (taglineEl) taglineEl.textContent = event.tagline || event.description;

    const locEl = document.getElementById('hero-location');
    if (locEl) locEl.textContent = event.location;

    const descEl = document.getElementById('experience-description');
    if (descEl) descEl.textContent = event.description;

    const videoBg = document.getElementById('hero-video-element');
    if (videoBg && event.hero_video_url) {
      videoBg.src = event.hero_video_url;
    }
  },

  // ==========================================
  // 3. EXPERIENCIAS MULTISENSORIALES DINÁMICAS
  // ==========================================
    async loadExperiences() {
    const section = document.getElementById('experiencia');
    const navLinks = document.querySelectorAll('a[href="#experiencia"]');
    const container = document.getElementById('experiences-grid-container');

    try {
      const data = await API.experiences.getActive();
      
      // Si está oculta por configuración o sin experiencias
      if (data.is_hidden || !data.experiences || data.experiences.length === 0) {
        if (section) section.style.display = 'none';
        navLinks.forEach(link => {
          if (link.parentElement) link.parentElement.style.display = 'none';
        });
        return;
      }

      if (section) section.style.display = '';
      navLinks.forEach(link => {
        if (link.parentElement) link.parentElement.style.display = '';
      });

      if (container) {
        container.innerHTML = data.experiences.map((exp, idx) => {
          const badgeClass = idx % 3 === 0 ? 'badge-sunset' : (idx % 3 === 1 ? 'badge-gold' : 'badge-pink');
          const defaultImg = 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80';
          return `
            <div class="experience-card">
              <div class="experience-img-wrap">
                <img src="${exp.image_url || defaultImg}" alt="${exp.title}" loading="lazy">
                <span class="badge ${badgeClass} experience-badge"><i class="bi ${exp.icon || 'bi-stars'}"></i> Especial</span>
              </div>
              <div class="experience-body">
                <h3>${exp.title}</h3>
                <p>${exp.description}</p>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Error cargando experiencias:', err);
    }
  },

  async loadGallery(category = 'todos') {
    const track = document.getElementById('gallery-slides-track');
    const dotsContainer = document.getElementById('gallery-dots-container');
    if (!track) return;

    try {
      track.innerHTML = '<div style="width:100%; text-align:center; padding: 3rem;"><i class="bi bi-arrow-repeat spin"></i> Cargando galería...</div>';
      const data = await API.gallery.getItems(category === 'todos' ? null : category);
      
      if (!data.items || data.items.length === 0) {
        track.innerHTML = '<div style="width:100%; text-align:center; padding: 3rem; color: var(--text-muted);">No hay fotos o videos en esta categoría.</div>';
        if (dotsContainer) dotsContainer.innerHTML = '';
        if (this.galleryInterval) clearInterval(this.galleryInterval);
        return;
      }

      this.galleryItems = data.items;
      this.currentGalleryIndex = 0;

      track.innerHTML = data.items.map((item, idx) => `
        <div class="gallery-slide-item" onclick="LandingApp.openLightbox('${item.media_url}', '${item.media_type}', '${item.title || 'Spring Fashion'}')">
          <img src="${item.thumbnail_url || item.media_url}" alt="${item.title || 'Foto de Galería'}" loading="lazy">
          ${item.media_type === 'video' ? '<div class="video-play-indicator"><i class="bi bi-play-fill"></i></div>' : ''}
          <div class="gallery-slide-caption">
            <div>
              <h3>${item.title || 'Spring Fashion Experience'}</h3>
              <span>${item.category} • ${item.media_type === 'video' ? 'Video Aftermovie' : 'Fotografía Oficial'}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--accent-gold); font-weight: 600;">
              <i class="bi bi-arrows-fullscreen"></i> Ver Completo
            </div>
          </div>
        </div>
      `).join('');

      if (dotsContainer) {
        dotsContainer.innerHTML = data.items.map((_, idx) => `
          <button class="gallery-dot ${idx === 0 ? 'active' : ''}" onclick="LandingApp.goToGallerySlide(${idx})"></button>
        `).join('');
      }

      this.updateGalleryTrack();
      this.startGalleryTimer();

      // Pausar con hover o toque
      const wrapper = document.getElementById('gallery-carousel-wrapper');
      if (wrapper) {
        wrapper.onmouseenter = () => { this.isGalleryPaused = true; };
        wrapper.onmouseleave = () => { this.isGalleryPaused = false; };
        wrapper.ontouchstart = () => { this.isGalleryPaused = true; };
        wrapper.ontouchend = () => { this.isGalleryPaused = false; };
      }
    } catch (err) {
      track.innerHTML = '<div style="width:100%; text-align:center; color: var(--status-red); padding:2rem;">Error cargando galería.</div>';
    }
  },

  startGalleryTimer() {
    if (this.galleryInterval) clearInterval(this.galleryInterval);
    this.galleryInterval = setInterval(() => {
      if (!this.isGalleryPaused && this.galleryItems.length > 1) {
        this.nextGallerySlide();
      }
    }, 3000);
  },

  nextGallerySlide() {
    if (this.galleryItems.length <= 1) return;
    this.currentGalleryIndex = (this.currentGalleryIndex + 1) % this.galleryItems.length;
    this.updateGalleryTrack();
  },

  prevGallerySlide() {
    if (this.galleryItems.length <= 1) return;
    this.currentGalleryIndex = (this.currentGalleryIndex - 1 + this.galleryItems.length) % this.galleryItems.length;
    this.updateGalleryTrack();
  },

  goToGallerySlide(idx) {
    this.currentGalleryIndex = idx;
    this.updateGalleryTrack();
  },

  updateGalleryTrack() {
    const track = document.getElementById('gallery-slides-track');
    const dots = document.querySelectorAll('.gallery-dot');

    if (track) {
      track.style.transform = `translateX(-${this.currentGalleryIndex * 100}%)`;
    }

    dots.forEach((dot, idx) => {
      if (idx === this.currentGalleryIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  },

  initGalleryFilters() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.getAttribute('data-category');
        this.loadGallery(cat);
      });
    });
  },

  openLightbox(url, type, title) {
    const modal = document.getElementById('lightbox-modal');
    const content = document.getElementById('lightbox-media-container');
    const titleEl = document.getElementById('lightbox-title');

    if (!modal || !content) return;

    if (titleEl) titleEl.textContent = title;
    if (type === 'video') {
      content.innerHTML = `
        <video controls autoplay playsinline style="max-height: 75vh; width: 100%; border-radius: var(--radius-md);">
          <source src="${url}" type="video/mp4">
          Tu navegador no soporta reproducción de video.
        </video>
      `;
    } else {
      content.innerHTML = `
        <img src="${url}" alt="${title}" style="max-height: 75vh; width: auto; max-width: 100%; margin: 0 auto; border-radius: var(--radius-md); object-fit: contain;">
      `;
    }

    modal.classList.add('active');
  },

  closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const content = document.getElementById('lightbox-media-container');
    if (content) content.innerHTML = '';
    if (modal) modal.classList.remove('active');
  },

  // ==========================================
  // 5. TALENTO & LINEUP / ARTISTAS INVITADOS
  // ==========================================
    async loadArtists() {
    const section = document.getElementById('artistas');
    const navLinks = document.querySelectorAll('a[href="#artistas"]');
    const container = document.getElementById('artists-grid-container');

    try {
      const data = await API.artists.getActive();
      
      // Si está oculta por configuración o sin artistas
      if (data.is_hidden || !data.artists || data.artists.length === 0) {
        if (section) section.style.display = 'none';
        navLinks.forEach(link => {
          if (link.parentElement) link.parentElement.style.display = 'none';
        });
        return;
      }

      if (section) section.style.display = '';
      navLinks.forEach(link => {
        if (link.parentElement) link.parentElement.style.display = '';
      });

      if (container) {
        const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
        container.innerHTML = data.artists.map(art => `
          <div class="speaker-card">
            <div class="speaker-photo">
              <img src="${art.image_url || defaultAvatar}" alt="${art.name}" loading="lazy">
            </div>
            <div class="speaker-info">
              <span class="speaker-discipline">${art.role_title}</span>
              <h3 class="speaker-name">${art.name}</h3>
              <p class="speaker-bio">${art.bio || ''}</p>
              <div class="speaker-socials">
                ${art.instagram_url ? `<a href="${art.instagram_url}" target="_blank" title="Instagram"><i class="bi bi-instagram"></i></a>` : ''}
                <a href="#entradas" title="Ver en vivo"><i class="bi bi-ticket-perforated-fill"></i></a>
              </div>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Error cargando artistas:', err);
    }
  },

  async loadSponsors() {
    const container = document.getElementById('sponsors-container');
    if (!container) return;

    try {
      const data = await API.sponsors.getApproved();
      if (!data.sponsors || data.sponsors.length === 0) return;

      const tiers = ['Platinum', 'Gold', 'Silver', 'Media Partner'];
      let html = '';

      tiers.forEach(tierName => {
        const list = data.sponsors.filter(s => s.tier.toLowerCase() === tierName.toLowerCase());
        if (list.length > 0) {
          html += `
            <div class="sponsor-tier-group">
              <div class="sponsor-tier-title">${tierName} Partners</div>
              <div class="sponsors-logo-grid">
                ${list.map(sp => `
                  <div class="sponsor-logo-card" title="${sp.company_name} - ${sp.proposal || ''}">
                    <img src="${sp.logo_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80'}" alt="${sp.company_name}">
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
      });

      container.innerHTML = html;
    } catch (err) {
      console.error('Error cargando sponsors:', err);
    }
  },

  downloadOrOpenMediaKit() {
    const ev = this.activeEvent;
    const fileUrl = ev?.mediakit_file_url || ev?.mediakit_download_link;
    if (fileUrl && fileUrl.trim().length > 3) {
      window.open(fileUrl.trim(), '_blank');
    } else {
      this.openMediaKitModal();
    }
  },

  openMediaKitModal() {
    const modal = document.getElementById('mediakit-modal');
    if (modal) {
      const downloadBtn = document.getElementById('mediakit-modal-download-btn');
      const fileUrl = this.activeEvent?.mediakit_file_url || this.activeEvent?.mediakit_download_link;
      if (downloadBtn) {
        if (fileUrl) {
          downloadBtn.href = fileUrl;
          downloadBtn.style.display = 'inline-flex';
        } else {
          downloadBtn.style.display = 'none';
        }
      }
      modal.classList.add('active');
    }
  },

  // ==========================================
  // 7. TABLA DE TICKETS Y CHECKOUT ELEGANTE
  // ==========================================
  async loadTicketTiers() {
    const grid = document.getElementById('ticket-tiers-container') || document.getElementById('tickets-grid-container');
    if (!grid) return;

    try {
      const data = await API.tickets.getTiers();
      if (!data.tiers || data.tiers.length === 0) {
        grid.innerHTML = '<p class="text-center" style="grid-column:1/-1;">Próximamente tickets a la venta.</p>';
        return;
      }

      this.ticketTiers = data.tiers;
      const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';
      
      grid.innerHTML = data.tiers.map((tier) => {
        const isPopular = tier.badge === 'Más Elegido' || tier.badge === 'Más Popular';
        const isSoldOut = tier.tier_status === 'agotada' || (tier.sold_count >= tier.stock);

        return `
          <div class="ticket-tier-card ${isPopular ? 'featured' : ''}">
            <div class="ticket-tier-header">
              <span class="badge ${isPopular ? 'badge-sunset' : 'badge-gold'}">${tier.badge || 'Pase Oficial'}</span>
              <h3 class="ticket-name">${tier.name}</h3>
              <div class="ticket-price-box">
                <span class="ticket-currency">$</span>
                <span class="ticket-price">${tier.price.toLocaleString('es-AR')}</span>
                <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 0.25rem;">${currency}</span>
              </div>
            </div>
            <ul class="ticket-features">
              ${tier.features.map(f => `<li><i class="bi bi-check-circle-fill"></i> <span>${f}</span></li>`).join('')}
            </ul>
            ${isSoldOut ? `
              <button class="btn btn-outline btn-block" disabled style="opacity:0.6; cursor:not-allowed;">
                <i class="bi bi-x-circle"></i> Agotado (Sold Out)
              </button>
            ` : `
              <button class="btn ${isPopular ? 'btn-primary' : 'btn-outline'} btn-block" onclick="LandingApp.openCheckoutModal(${tier.id})">
                <i class="bi bi-shield-check"></i> Abonar
              </button>
            `}
            <div class="ticket-stock-info">
              <i class="bi bi-fire text-gold"></i> Cupos disponibles: ${Math.max(0, tier.stock - tier.sold_count)} / ${tier.stock}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando tickets:', err);
    }
  },

  openCheckoutModal(tierId) {
    const tier = this.ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    this.selectedTier = tier;
    this.ticketQuantity = 1;
    this.selectedPaymentMethod = 'Pago Seguro';

    const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';
    
    const nameEl = document.getElementById('checkout-tier-name');
    const unitEl = document.getElementById('checkout-unit-price');
    const qtyInput = document.getElementById('checkout-qty-input');
    const promoInput = document.getElementById('checkout-promoter-code');

    if (nameEl) nameEl.textContent = tier.name;
    if (unitEl) unitEl.textContent = `$${tier.price.toLocaleString('es-AR')} ${currency} / unidad`;
    if (qtyInput) qtyInput.value = '1';
    
    // Asignación silenciosa del código de referido
    if (promoInput) {
      promoInput.value = this.appliedPromoCode || '';
    }

    this.updateCheckoutTotals();
    
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.add('active');
  },

  updateCheckoutTotals() {
    if (!this.selectedTier) return;
    const qtyInput = document.getElementById('checkout-qty-input');
    const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1) || 1);
    this.ticketQuantity = qty;

    const subtotal = this.selectedTier.price * qty;
    const total = subtotal;
    const currency = (this.activeEvent && this.activeEvent.currency) ? this.activeEvent.currency : 'ARS';

    const subEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total-price');

    if (subEl) subEl.textContent = `$${subtotal.toLocaleString('es-AR')} ${currency}`;
    if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')} ${currency}`;
  },

  initCheckoutHandlers() {
    const minusBtn = document.getElementById('checkout-qty-minus');
    const plusBtn = document.getElementById('checkout-qty-plus');
    const qtyInput = document.getElementById('checkout-qty-input');

    if (minusBtn && plusBtn && qtyInput) {
      minusBtn.onclick = () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) {
          qtyInput.value = val - 1;
          this.updateCheckoutTotals();
        }
      };

      plusBtn.onclick = () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < 10) {
          qtyInput.value = val + 1;
          this.updateCheckoutTotals();
        }
      };

      qtyInput.onchange = () => this.updateCheckoutTotals();
    }

    // Botones de método de pago
    const paymentBtns = document.querySelectorAll('.payment-method-btn');
    paymentBtns.forEach(btn => {
      btn.onclick = () => {
        paymentBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPaymentMethod = btn.getAttribute('data-method') || 'Pago Seguro';
      };
    });

    // Envío del Formulario de Checkout
    const form = document.getElementById('checkout-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const buyer_name = document.getElementById('buyer-name')?.value?.trim() || '';
        const email = document.getElementById('buyer-email')?.value?.trim() || '';
        const phone = document.getElementById('buyer-phone')?.value?.trim() || '';
        const promo_code = document.getElementById('checkout-promoter-code')?.value?.trim() || this.appliedPromoCode || '';

        if (!buyer_name || !email) {
          if (window.Toast) window.Toast.error('Por favor completa tu nombre y correo electrónico.');
          return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Procesando...';
        }

        try {
          const res = await API.payments.createDLocalCheckout({
            buyer_name,
            email,
            phone,
            tier_id: this.selectedTier.id,
            quantity: this.ticketQuantity,
            promo_code: promo_code,
            payment_method: this.selectedPaymentMethod
          });

          if (res.success) {
            this.closeModal('checkout-modal');
            if (res.redirect_url) {
              if (window.Toast) window.Toast.info('Redirigiendo a la pasarela oficial de pago...');
              window.location.href = res.redirect_url;
            } else {
              if (window.Toast) window.Toast.success('¡Entrada confirmada con éxito!');
              this.showTicketVoucher(res.sale);
              this.loadTicketTiers();
            }
          }
        } catch (err) {
          if (window.Toast) window.Toast.error(err.message || 'Error al procesar la compra.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-shield-check"></i> Abonar';
          }
        }
      };
    }
  },

  showTicketVoucher(sale) {
    const modal = document.getElementById('voucher-modal');
    if (!modal) return;

    const bName = document.getElementById('voucher-buyer-name');
    const tName = document.getElementById('voucher-tier-name');
    const qtyEl = document.getElementById('voucher-quantity');
    const totEl = document.getElementById('voucher-total');
    const codeEl = document.getElementById('voucher-code');
    const methEl = document.getElementById('voucher-method');

    if (bName) bName.textContent = sale.buyer_name;
    if (tName) tName.textContent = sale.tier_name;
    if (qtyEl) qtyEl.textContent = `${sale.quantity} Pase(s)`;
    if (totEl) totEl.textContent = `$${sale.total_paid.toLocaleString('es-AR')} ${sale.currency || 'ARS'}`;
    if (codeEl) codeEl.textContent = sale.ticket_code;
    if (methEl) methEl.textContent = sale.payment_method || 'Pago Seguro';

    const qrContainer = document.getElementById('voucher-qr-code');
    if (qrContainer) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(sale.qr_data || sale.ticket_code)}`;
      qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Ticket Code" style="width: 140px; height: 140px;">`;
    }

    modal.classList.add('active');
  },

  // ==========================================
  // 8. CARRUSEL DE TESTIMONIOS (5S + HOVER PAUSE)
  // ==========================================
  async loadTestimonials() {
    try {
      const data = await API.feedback.getApproved();
      if (!data.reviews || data.reviews.length === 0) return;

      this.testimonials = data.reviews;
      this.renderCarousel();
      this.startCarouselTimer();
    } catch (err) {
      console.error('Error cargando testimonios:', err);
    }
  },

  renderCarousel() {
    const container = document.getElementById('testimonial-slides-box');
    const dotsContainer = document.getElementById('carousel-dots-box');
    if (!container || this.testimonials.length === 0) return;

    container.innerHTML = this.testimonials.map((t, idx) => `
      <div class="testimonial-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
        <div class="testimonial-stars">
          ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}
        </div>
        <p class="testimonial-quote">"${t.comment_text}"</p>
        <div class="testimonial-author">
          <img class="author-avatar" src="${t.avatar_url || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(t.user_name)}`}" alt="${t.user_name}">
          <div class="author-info">
            <h5>${t.user_name}</h5>
            <span>${t.edition_tag || 'Asistente VIP'}</span>
          </div>
        </div>
      </div>
    `).join('');

    if (dotsContainer) {
      dotsContainer.innerHTML = this.testimonials.map((_, idx) => `
        <button class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="LandingApp.goToSlide(${idx})"></button>
      `).join('');
    }

    const wrapper = document.querySelector('.testimonial-slide-container');
    if (wrapper) {
      wrapper.onmouseenter = () => { this.isCarouselPaused = true; };
      wrapper.onmouseleave = () => { this.isCarouselPaused = false; };
      wrapper.ontouchstart = () => { this.isCarouselPaused = true; };
      wrapper.ontouchend = () => { this.isCarouselPaused = false; };
    }
  },

  startCarouselTimer() {
    if (this.testimonialInterval) clearInterval(this.testimonialInterval);
    this.testimonialInterval = setInterval(() => {
      if (!this.isCarouselPaused) {
        this.nextSlide();
      }
    }, 5000);
  },

  nextSlide() {
    if (this.testimonials.length <= 1) return;
    this.currentSlideIndex = (this.currentSlideIndex + 1) % this.testimonials.length;
    this.updateSlideDisplay();
  },

  prevSlide() {
    if (this.testimonials.length <= 1) return;
    this.currentSlideIndex = (this.currentSlideIndex - 1 + this.testimonials.length) % this.testimonials.length;
    this.updateSlideDisplay();
  },

  goToSlide(idx) {
    this.currentSlideIndex = idx;
    this.updateSlideDisplay();
  },

  updateSlideDisplay() {
    const slides = document.querySelectorAll('.testimonial-slide');
    const dots = document.querySelectorAll('.carousel-dot');

    slides.forEach((slide, idx) => {
      if (idx === this.currentSlideIndex) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    dots.forEach((dot, idx) => {
      if (idx === this.currentSlideIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  },

  // ==========================================
  // 9. CUENTA REGRESIVA
  // ==========================================
  initCountdown() {
    const targetDate = new Date('2026-11-21T17:30:00').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      const dEl = document.getElementById('countdown-days');
      const hEl = document.getElementById('countdown-hours');
      const mEl = document.getElementById('countdown-mins');
      const sEl = document.getElementById('countdown-secs');

      if (difference <= 0) {
        if (dEl) dEl.textContent = '00';
        if (hEl) hEl.textContent = '00';
        if (mEl) mEl.textContent = '00';
        if (sEl) sEl.textContent = '00';
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (dEl) dEl.textContent = String(days).padStart(2, '0');
      if (hEl) hEl.textContent = String(hours).padStart(2, '0');
      if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
      if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  },

  // ==========================================
  // 10. MINI FORMULARIO DE COMUNIDAD / LEADS
  // ==========================================
  initCommunityForm() {
    let selectedRating = 5;
    const stars = document.querySelectorAll('#community-star-picker i');
    
    stars.forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.getAttribute('data-rating')) || 5;
        stars.forEach((s, idx) => {
          if (idx < selectedRating) {
            s.className = 'bi bi-star-fill active';
          } else {
            s.className = 'bi bi-star';
          }
        });
      });
    });

    const form = document.getElementById('community-feedback-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('community-name')?.value?.trim() || '';
        const email = document.getElementById('community-email')?.value?.trim() || '';
        const comment = document.getElementById('community-comment')?.value?.trim() || '';

        if (!name || !email || !comment) {
          if (window.Toast) window.Toast.error('Por favor completa todos los campos.');
          return;
        }

        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Enviando...';
        }

        try {
          const res = await API.feedback.submit({
            user_name: name,
            email,
            comment_text: comment,
            rating: selectedRating
          });

          if (res.success) {
            if (window.Toast) window.Toast.success('¡Gracias por tu comentario y por unirte a la preventa!');
            form.reset();
            this.loadTestimonials();
          }
        } catch (err) {
          if (window.Toast) window.Toast.error('Error al enviar opinión.');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-send-fill"></i> Compartir y Registrarme';
          }
        }
      };
    }
  },

  // ==========================================
  // 11. FAQ ACORDEÓN
  // ==========================================
  initFaqAccordion() {
    const items = document.querySelectorAll('.faq-item');
    items.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (question) {
        question.onclick = () => {
          const isActive = item.classList.contains('active');
          items.forEach(i => i.classList.remove('active'));
          if (!isActive) {
            item.classList.add('active');
          }
        };
      }
    });
  },

  // ==========================================
  // 12. PORTAL DE ALIANZAS B2B
  // ==========================================
  initB2BTabs() {
    const tabBtns = document.querySelectorAll('.b2b-tab-btn');
    const tabPanes = document.querySelectorAll('.b2b-tab-pane');

    tabBtns.forEach(btn => {
      btn.onclick = () => {
        const target = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(target);
        if (activePane) activePane.classList.add('active');
      };
    });

    const sponsorForm = document.getElementById('b2b-sponsor-form');
    if (sponsorForm) {
      sponsorForm.onsubmit = async (e) => {
        e.preventDefault();
        const company_name = document.getElementById('sp-company')?.value?.trim() || '';
        const contact_name = document.getElementById('sp-contact')?.value?.trim() || '';
        const email = document.getElementById('sp-email')?.value?.trim() || '';
        const phone = document.getElementById('sp-phone')?.value?.trim() || '';
        const tier = document.getElementById('sp-tier')?.value || 'Gold';
        const proposal = document.getElementById('sp-proposal')?.value?.trim() || '';

        try {
          const res = await API.sponsors.apply({ company_name, contact_name, email, phone, tier, proposal });
          if (window.Toast) window.Toast.success(res.message || 'Postulación enviada con éxito');
          sponsorForm.reset();
        } catch (err) {
          if (window.Toast) window.Toast.error(err.message || 'Error al enviar postulación.');
        }
      };
    }

    const staffForm = document.getElementById('b2b-staff-form');
    if (staffForm) {
      staffForm.onsubmit = async (e) => {
        e.preventDefault();
        const provider_name = document.getElementById('st-name')?.value?.trim() || '';
        const category_name = document.getElementById('st-category')?.value || '';
        const contact = document.getElementById('st-contact')?.value?.trim() || '';
        const email = document.getElementById('st-email')?.value?.trim() || '';
        const phone = document.getElementById('st-phone')?.value?.trim() || '';
        const portfolio_url = document.getElementById('st-portfolio')?.value?.trim() || '';
        const message = document.getElementById('st-message')?.value?.trim() || '';

        try {
          const res = await API.sponsors.staffApply({ provider_name, category_name, contact, email, phone, portfolio_url, message });
          if (window.Toast) window.Toast.success(res.message || 'Postulación recibida con éxito');
          staffForm.reset();
        } catch (err) {
          if (window.Toast) window.Toast.error(err.message || 'Error al enviar propuesta.');
        }
      };
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }
};

window.LandingApp = LandingApp;
