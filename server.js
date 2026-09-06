require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { dbAsync, initDatabase } = require('./database/db');
const { sendTicketEmail } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'spring_fashion_super_secret_key_2026';

// dLocal Go Configuration
const DLOCAL_ENV = process.env.DLOCAL_ENV || 'production';
const DLOCAL_BASE_URL = DLOCAL_ENV === 'production' 
  ? 'https://api.dlocalgo.com/v1' 
  : 'https://api-sbx.dlocalgo.com/v1';
const DLOCAL_API_KEY = process.env.DLOCAL_API_KEY || '';
const DLOCAL_API_SECRET = process.env.DLOCAL_API_SECRET || '';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Directorio para uploads estáticos
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'sf-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Middleware de Autenticación Admin
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token requerido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// 1. ENDPOINTS DE AUTENTICACIÓN ADMIN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
    }

    const admin = await dbAsync.get(`SELECT * FROM admin_users WHERE username = ?`, [username]);
    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      message: 'Autenticación exitosa',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor al autenticar.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const admin = await dbAsync.get(`SELECT id, username, role, created_at FROM admin_users WHERE id = ?`, [req.user.id]);
    if (!admin) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: admin });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sesión.' });
  }
});

// ==========================================
// 2. ENDPOINTS DE EVENTO Y CONFIGURACIÓN
// ==========================================
app.get('/api/events/active', async (req, res) => {
  try {
    const event = await dbAsync.get(`SELECT * FROM events ORDER BY id ASC LIMIT 1`);
    if (!event) {
      return res.status(404).json({ error: 'No hay eventos configurados.' });
    }
    // Proteger credenciales privadas para que NUNCA viajen en la respuesta pública
    const safeEvent = { ...event };
    safeEvent.has_dlocal_configured = !!(event.dlocal_api_key && event.dlocal_api_secret);
    delete safeEvent.dlocal_api_key;
    delete safeEvent.dlocal_api_secret;

    res.json({ event: safeEvent });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar evento activo.' });
  }
});

// Endpoint seguro y autenticado para obtener configuración en el Backoffice
app.get('/api/events/admin-config', authenticateToken, async (req, res) => {
  try {
    const event = await dbAsync.get(`SELECT * FROM events ORDER BY id ASC LIMIT 1`);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado.' });

    const adminEvent = { ...event };
    if (adminEvent.dlocal_api_secret) {
      adminEvent.dlocal_api_secret_masked = '••••••••••••••••' + (adminEvent.dlocal_api_secret.slice(-4) || '');
      adminEvent.has_dlocal_secret = true;
    }
    if (adminEvent.dlocal_api_key && adminEvent.dlocal_api_key.length > 8) {
      adminEvent.dlocal_api_key_masked = adminEvent.dlocal_api_key.substring(0, 4) + '••••••••' + adminEvent.dlocal_api_key.slice(-4);
      adminEvent.has_dlocal_key = true;
    }
    delete adminEvent.dlocal_api_secret;

    res.json({ event: adminEvent });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar configuración de administración.' });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, type, tagline, date, location, currency, hero_video_url, banner_url, 
      status, description, show_experiences, show_lineup, mediakit_file_url, 
      mediakit_download_link, dlocal_env, dlocal_api_key, dlocal_api_secret 
    } = req.body;

    const existing = await dbAsync.get(`SELECT * FROM events WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'Evento no encontrado.' });

    // Preservar la clave secreta actual si el input vino enmascarado o vacío
    let finalSecret = existing.dlocal_api_secret;
    if (dlocal_api_secret && !dlocal_api_secret.includes('••') && dlocal_api_secret.trim() !== '') {
      finalSecret = dlocal_api_secret.trim();
    }

    // Preservar la API key si vino enmascarada o vacía
    let finalApiKey = existing.dlocal_api_key;
    if (dlocal_api_key && !dlocal_api_key.includes('••') && dlocal_api_key.trim() !== '') {
      finalApiKey = dlocal_api_key.trim();
    }

    await dbAsync.run(
      `UPDATE events 
       SET title = ?, type = ?, tagline = ?, date = ?, location = ?, currency = ?,
           hero_video_url = ?, banner_url = ?, status = ?, description = ?,
           show_experiences = COALESCE(?, show_experiences, 1),
           show_lineup = COALESCE(?, show_lineup, 1),
           mediakit_file_url = COALESCE(?, mediakit_file_url),
           mediakit_download_link = COALESCE(?, mediakit_download_link),
           dlocal_env = COALESCE(?, dlocal_env, 'production'),
           dlocal_api_key = ?,
           dlocal_api_secret = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title, type, tagline, date, location, currency || 'ARS', hero_video_url, banner_url, 
        status, description, show_experiences, show_lineup, mediakit_file_url, 
        mediakit_download_link, dlocal_env, finalApiKey, finalSecret, id
      ]
    );

    const updated = await dbAsync.get(`SELECT * FROM events WHERE id = ?`, [id]);
    const safeUpdated = { ...updated };
    delete safeUpdated.dlocal_api_secret;
    res.json({ success: true, message: 'Evento actualizado correctamente', event: safeUpdated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración del evento.' });
  }
});

// Endpoint directo para alternar visibilidad de secciones (Experiencias o Artistas/Lineup)
app.put('/api/events/toggle-section/:section', authenticateToken, async (req, res) => {
  try {
    const { section } = req.params;
    const event = await dbAsync.get(`SELECT id, show_experiences, show_lineup FROM events ORDER BY id ASC LIMIT 1`);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado.' });

    let updatedValue = 1;
    let field = '';
    let sectionName = '';

    if (section === 'lineup' || section === 'artists') {
      field = 'show_lineup';
      sectionName = 'Speakers & Artistas Invitados';
      updatedValue = event.show_lineup === 1 ? 0 : 1;
    } else if (section === 'experiences') {
      field = 'show_experiences';
      sectionName = 'Una Experiencia Multisensorial';
      updatedValue = event.show_experiences === 1 ? 0 : 1;
    } else {
      return res.status(400).json({ error: 'Sección no válida.' });
    }

    await dbAsync.run(`UPDATE events SET ${field} = ? WHERE id = ?`, [updatedValue, event.id]);
    res.json({ 
      success: true, 
      section, 
      is_visible: updatedValue === 1, 
      message: `Sección '${sectionName}' ahora está ${updatedValue === 1 ? 'visible' : 'oculta'} en la web pública.` 
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar visibilidad de sección.' });
  }
});

// ==========================================
// 2.1 EXPERIENCIAS MULTISENSORIALES (CRUD)
// ==========================================
app.get('/api/experiences', async (req, res) => {
  try {
    const event = await dbAsync.get(`SELECT show_experiences FROM events ORDER BY id ASC LIMIT 1`);
    if (event && event.show_experiences === 0) {
      return res.json({ experiences: [], is_hidden: true });
    }
    const experiences = await dbAsync.all(`SELECT * FROM event_experiences WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`);
    res.json({ experiences, is_hidden: false });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener experiencias.' });
  }
});

app.get('/api/experiences/all', authenticateToken, async (req, res) => {
  try {
    const experiences = await dbAsync.all(`SELECT * FROM event_experiences ORDER BY sort_order ASC, id ASC`);
    res.json({ experiences });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener lista completa de experiencias.' });
  }
});

app.post('/api/experiences', authenticateToken, async (req, res) => {
  try {
    const { title, description, icon, image_url, sort_order, is_active } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Título y descripción son obligatorios.' });
    }
    const result = await dbAsync.run(
      `INSERT INTO event_experiences (event_id, title, description, icon, image_url, sort_order, is_active)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [title, description, icon || 'bi-stars', image_url || '', sort_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );
    res.json({ success: true, message: 'Experiencia creada con éxito', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear experiencia.' });
  }
});

app.put('/api/experiences/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, icon, image_url, sort_order, is_active } = req.body;
    await dbAsync.run(
      `UPDATE event_experiences 
       SET title = ?, description = ?, icon = ?, image_url = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [title, description, icon, image_url, sort_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
    );
    res.json({ success: true, message: 'Experiencia actualizada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar experiencia.' });
  }
});

app.delete('/api/experiences/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM event_experiences WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Experiencia eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar experiencia.' });
  }
});

// ==========================================
// 2.2 TALENTO & LINEUP / ARTISTAS INVITADOS (CRUD)
// ==========================================
app.get('/api/artists', async (req, res) => {
  try {
    const event = await dbAsync.get(`SELECT show_lineup FROM events ORDER BY id ASC LIMIT 1`);
    if (event && event.show_lineup === 0) {
      return res.json({ artists: [], is_hidden: true });
    }
    const artists = await dbAsync.all(`SELECT * FROM event_artists WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`);
    res.json({ artists, is_hidden: false });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener artistas.' });
  }
});

app.get('/api/artists/all', authenticateToken, async (req, res) => {
  try {
    const artists = await dbAsync.all(`SELECT * FROM event_artists ORDER BY sort_order ASC, id ASC`);
    res.json({ artists });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener lista de artistas.' });
  }
});

app.post('/api/artists', authenticateToken, async (req, res) => {
  try {
    const { name, role_title, category, bio, image_url, instagram_url, sort_order, is_active } = req.body;
    if (!name || !role_title) {
      return res.status(400).json({ error: 'Nombre y rol del artista son obligatorios.' });
    }
    const result = await dbAsync.run(
      `INSERT INTO event_artists (event_id, name, role_title, category, bio, image_url, instagram_url, sort_order, is_active)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, role_title, category || 'artista', bio || '', image_url || '', instagram_url || '', sort_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );
    res.json({ success: true, message: 'Artista/Talento añadido con éxito', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear artista.' });
  }
});

app.put('/api/artists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role_title, category, bio, image_url, instagram_url, sort_order, is_active } = req.body;
    await dbAsync.run(
      `UPDATE event_artists 
       SET name = ?, role_title = ?, category = ?, bio = ?, image_url = ?, instagram_url = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [name, role_title, category || 'artista', bio || '', image_url || '', instagram_url || '', sort_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
    );
    res.json({ success: true, message: 'Artista/Talento actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar artista.' });
  }
});

app.delete('/api/artists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM event_artists WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Artista eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar artista.' });
  }
});

// ==========================================
// 3. ENDPOINTS DE TICKETS Y TIERS EDITABLES
// ==========================================
app.get('/api/tickets/tiers', async (req, res) => {
  try {
    // Para la landing: sólo mostrar las que no estén ocultas (tier_status != 'oculta')
    const tiers = await dbAsync.all(`
      SELECT * FROM ticket_tiers 
      WHERE is_active = 1 AND (tier_status IS NULL OR tier_status != 'oculta')
      ORDER BY price ASC
    `);
    const formatted = tiers.map(t => {
      let parsedFeatures = [];
      try {
        parsedFeatures = JSON.parse(t.features_json);
      } catch (e) {
        parsedFeatures = [t.features_json];
      }
      return { ...t, features: parsedFeatures };
    });
    res.json({ tiers: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pases de entrada.' });
  }
});

app.get('/api/tickets/tiers/all', authenticateToken, async (req, res) => {
  try {
    const tiers = await dbAsync.all(`SELECT * FROM ticket_tiers ORDER BY id ASC`);
    res.json({ tiers });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener lista completa de tickets.' });
  }
});

app.put('/api/tickets/tiers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, badge, price, stock, tier_status, is_active, features } = req.body;
    
    let featuresJson = features;
    if (Array.isArray(features)) {
      featuresJson = JSON.stringify(features);
    }

    await dbAsync.run(
      `UPDATE ticket_tiers 
       SET name = ?, badge = ?, price = ?, stock = ?, tier_status = ?, is_active = ?, features_json = COALESCE(?, features_json)
       WHERE id = ?`,
      [name, badge, parseFloat(price), parseInt(stock), tier_status || 'activa', is_active !== undefined ? (is_active ? 1 : 0) : 1, featuresJson, id]
    );

    res.json({ success: true, message: 'Nivel de ticket actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tier de ticket.' });
  }
});

app.post('/api/tickets/tiers', authenticateToken, async (req, res) => {
  try {
    const { event_id, name, badge, price, stock, tier_status, features } = req.body;
    const featuresJson = Array.isArray(features) ? JSON.stringify(features) : JSON.stringify([features || 'Acceso general al evento']);
    
    const result = await dbAsync.run(
      `INSERT INTO ticket_tiers (event_id, name, badge, price, stock, sold_count, features_json, tier_status, is_active)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)`,
      [event_id || 1, name, badge || 'General', parseFloat(price) || 0, parseInt(stock) || 100, featuresJson, tier_status || 'activa']
    );

    res.json({ success: true, message: 'Nuevo tipo de entrada creado.', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error creando nuevo pase de entrada.' });
  }
});

app.delete('/api/tickets/tiers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM ticket_tiers WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Pase de entrada eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar pase.' });
  }
});

// ==========================================
// 4. INTEGRACIÓN DLOCAL GO CON SPLIT PAYMENTS & CHECKOUT
// ==========================================

// Validar promotor por código o slug
app.get('/api/promoters/validate/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const clean = query.trim().toUpperCase();
    const cleanSlug = query.trim().toLowerCase();

    const promoter = await dbAsync.get(
      `SELECT id, name, promo_code, slug, split_code, commission_percentage 
       FROM promoters 
       WHERE (UPPER(promo_code) = ? OR LOWER(slug) = ?) AND is_active = 1`,
      [clean, cleanSlug]
    );

    if (!promoter) {
      return res.status(404).json({ valid: false, message: 'Vendedor no encontrado o inactivo.' });
    }

    res.json({
      valid: true,
      promoter: {
        id: promoter.id,
        name: promoter.name,
        code: promoter.promo_code,
        slug: promoter.slug || promoter.promo_code.toLowerCase(),
        commission_percentage: promoter.commission_percentage,
        has_split_code: !!promoter.split_code
      },
      message: `¡Vendedor asociado: ${promoter.name} (${promoter.commission_percentage}% comisión asignada)!`
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al validar promotor.' });
  }
});

// Checkout con dLocal Go
app.post('/api/payments/dlocal/create-checkout', async (req, res) => {
  try {
    const { buyer_name, email, phone, tier_id, quantity, promo_code, payment_method } = req.body;

    if (!buyer_name || !email || !tier_id || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Por favor completa todos los campos requeridos.' });
    }

    const tier = await dbAsync.get(`SELECT * FROM ticket_tiers WHERE id = ?`, [tier_id]);
    if (!tier || tier.tier_status === 'oculta') {
      return res.status(404).json({ error: 'El pase seleccionado no está disponible.' });
    }

    if (tier.tier_status === 'agotada' || tier.sold_count + quantity > tier.stock) {
      return res.status(400).json({ error: `Este pase se encuentra agotado.` });
    }

    const event = await dbAsync.get(`SELECT * FROM events WHERE id = ?`, [tier.event_id]) || { currency: 'ARS' };
    const currency = event.currency || 'ARS';
    const totalAmount = tier.price * quantity;
    const ticketCode = 'SF-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Date.now().toString().slice(-4);
    const qrData = `SPRINGFASHION:2026:CODE:${ticketCode}:BUYER:${buyer_name}:TIER:${tier.name}:QTY:${quantity}`;

    // Buscar si hay promotor / vendedor
    let promoter = null;
    let splitCodeToSend = null;
    if (promo_code) {
      promoter = await dbAsync.get(
        `SELECT * FROM promoters WHERE (UPPER(promo_code) = UPPER(?) OR LOWER(slug) = LOWER(?)) AND is_active = 1`,
        [promo_code.trim(), promo_code.trim()]
      );
      if (promoter && promoter.split_code) {
        splitCodeToSend = promoter.split_code;
      }
    }

    const countryMap = { 'ARS': 'AR', 'BRL': 'BR', 'CLP': 'CL', 'MXN': 'MX', 'UYU': 'UY', 'USD': 'US' };
    const countryCode = countryMap[currency] || 'AR';

    // Payload dLocal Go
    const dlocalPayload = {
      amount: totalAmount,
      currency: currency,
      country: countryCode,
      order_id: ticketCode,
      description: `Spring Fashion 2026 - ${tier.name} (${quantity} entrada/s)`,
      success_url: `${APP_URL}/payment-success.html?code=${ticketCode}`,
      back_url: `${APP_URL}/#entradas`,
      notification_url: `${APP_URL}/api/payments/dlocal/notification`
    };

    if (splitCodeToSend) {
      dlocalPayload.split_code = splitCodeToSend;
    }

    const activeApiKey = (event.dlocal_api_key && event.dlocal_api_key.trim()) || DLOCAL_API_KEY;
    const activeApiSecret = (event.dlocal_api_secret && event.dlocal_api_secret.trim()) || DLOCAL_API_SECRET;
    const isProductionEnv = (event.dlocal_env === 'production') || (DLOCAL_ENV === 'production');
    const dlocalEndpointUrl = isProductionEnv ? 'https://api.dlocalgo.com/v1' : 'https://api-sbx.dlocalgo.com/v1';

    let redirectUrl = null;
    let dlocalPaymentId = null;

    // Llamar a dLocal Go API oficial si hay API Keys configuradas
    if (activeApiKey && activeApiKey.length > 3 && activeApiSecret && activeApiSecret.length > 3) {
      try {
        console.log(`[dLocal Go] Conectando a ${dlocalEndpointUrl}/payments para orden ${ticketCode}...`);
        let apiRes = await fetch(`${dlocalEndpointUrl}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeApiKey}:${activeApiSecret}`
          },
          body: JSON.stringify(dlocalPayload)
        });

        let dlocalRes = await apiRes.json();
        console.log('[dLocal Go API Respuesta]:', dlocalRes);

        // Si el código de split no está registrado en dLocal Go del comercio, reintentar cobro directo
        if (!apiRes.ok && dlocalRes.message && dlocalRes.message.includes('Collaboration not found') && dlocalPayload.split_code) {
          console.log('[dLocal Go] Split code no registrado en cuenta dLocal. Reintentando cobro directo...');
          delete dlocalPayload.split_code;
          apiRes = await fetch(`${dlocalEndpointUrl}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeApiKey}:${activeApiSecret}`
            },
            body: JSON.stringify(dlocalPayload)
          });
          dlocalRes = await apiRes.json();
          console.log('[dLocal Go API Reintento Respuesta]:', dlocalRes);
        }

        if (apiRes.ok && dlocalRes.redirect_url) {
          redirectUrl = dlocalRes.redirect_url;
          dlocalPaymentId = dlocalRes.id || ('DP-' + Date.now());
        } else {
          console.warn('[dLocal Go API Advertencia]:', dlocalRes.message || dlocalRes.error || dlocalRes);
        }
      } catch (apiErr) {
        console.error('Error conectando con dLocal Go API:', apiErr.message);
      }
    }

    // Si no hay keys reales o sandbox de prueba
    if (!redirectUrl) {
      redirectUrl = `${APP_URL}/dlocal-checkout.html?code=${ticketCode}&amount=${totalAmount}&currency=${currency}&tier=${encodeURIComponent(tier.name)}&buyer=${encodeURIComponent(buyer_name)}&qty=${quantity}`;
      dlocalPaymentId = 'DP-' + Math.floor(10000 + Math.random() * 90000);
    }

    // Insertar venta en base de datos
    const result = await dbAsync.run(
      `INSERT INTO ticket_sales (
        event_id, buyer_name, email, phone, tier_id, quantity, unit_price, total_paid, 
        payment_method, ticket_code, qr_code, promoter_id, promoter_code, split_code, 
        dlocal_payment_id, dlocal_redirect_url, is_used, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'confirmado')`,
      [
        tier.event_id, buyer_name, email, phone || '', tier_id, quantity, tier.price, totalAmount,
        payment_method || 'dLocal Go', ticketCode, qrData, 
        promoter ? promoter.id : null,
        promoter ? promoter.promo_code : null,
        splitCodeToSend,
        dlocalPaymentId,
        redirectUrl
      ]
    );

    // Incrementar entradas vendidas
    await dbAsync.run(
      `UPDATE ticket_tiers SET sold_count = sold_count + ? WHERE id = ?`,
      [quantity, tier_id]
    );

    // Actualizar comisiones de promotor
    if (promoter) {
      const commissionAmount = (totalAmount * (promoter.commission_percentage || 10)) / 100;
      await dbAsync.run(
        `UPDATE promoters 
         SET total_sales_count = total_sales_count + ?, 
             total_commission_earned = total_commission_earned + ?
         WHERE id = ?`,
        [quantity, commissionAmount, promoter.id]
      );
    }

    // Registrar lead para mailing
    const existingLead = await dbAsync.get(`SELECT id FROM feedback_comments WHERE email = ?`, [email]);
    if (!existingLead) {
      await dbAsync.run(
        `INSERT INTO feedback_comments (user_name, email, comment_text, rating, avatar_url, edition_tag, is_approved)
         VALUES (?, ?, ?, 5, '', 'Comprador 2026', 0)`,
        [buyer_name, email, 'Registro de compra anticipada / Newsletter lead']
      );
    }

    // Enviar correo con ticket y código QR al comprador
    sendTicketEmail({
      buyer_name,
      email,
      ticket_code: ticketCode,
      tier_name: tier.name,
      quantity,
      total_paid: totalAmount,
      event_currency: currency,
      event_title: event.title || 'SPRING FASHION 2026',
      event_date: event.date || '21 de Noviembre 2026 • 17:30 HS',
      event_location: event.location || 'Bodega Monteviejo, Valle de Uco, Mendoza',
      qr_code: qrData
    }).catch(e => console.error('Error enviando email checkout:', e.message));

    res.json({
      success: true,
      message: '¡Orden de pago dLocal Go generada con éxito!',
      redirect_url: redirectUrl,
      dlocal_payment_id: dlocalPaymentId,
      sale: {
        id: result.lastID,
        ticket_code: ticketCode,
        buyer_name,
        email,
        tier_name: tier.name,
        quantity,
        total_paid: totalAmount,
        currency,
        promoter_code: promoter ? promoter.promo_code : null,
        split_code: splitCodeToSend,
        payment_method: 'dLocal Go',
        qr_data: qrData,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error checkout:', err);
    res.status(500).json({ error: 'Error procesando la compra de tickets.' });
  }
});

// Webhook de dLocal Go
app.post('/api/payments/dlocal/notification', async (req, res) => {
  try {
    const { order_id, status, id } = req.body;
    if (order_id) {
      const isPaid = status === 'PAID' || status === 'COMPLETED';
      await dbAsync.run(
        `UPDATE ticket_sales 
         SET status = ?, dlocal_payment_id = COALESCE(?, dlocal_payment_id) 
         WHERE ticket_code = ?`,
        [isPaid ? 'confirmado' : status.toLowerCase(), id, order_id]
      );
    }
    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Error procesando notificación' });
  }
});

// ==========================================
// 5. ESCÁNER QR & VALIDACIÓN DE ACCESOS EN PUERTA
// ==========================================
app.post('/api/tickets/validate-qr', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Código QR no proporcionado.' });
    }

    // Extraer código si viene como URL, payload estructurado o texto libre
    let searchCode = code.trim();
    if (searchCode.startsWith('http://') || searchCode.startsWith('https://')) {
      try {
        const parsedUrl = new URL(searchCode);
        const urlCode = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('order_id');
        if (urlCode) {
          searchCode = urlCode.trim();
        }
      } catch (e) {
        const match = searchCode.match(/[?&](code|order_id)=([^&#]+)/i);
        if (match && match[2]) {
          searchCode = decodeURIComponent(match[2]).trim();
        }
      }
    }
    if (searchCode.includes('CODE:')) {
      const parts = searchCode.split('CODE:');
      if (parts[1]) {
        searchCode = parts[1].split(':')[0].trim();
      }
    }

    const sale = await dbAsync.get(`
      SELECT s.*, t.name as tier_name, e.title as event_title, e.location as event_location
      FROM ticket_sales s
      LEFT JOIN ticket_tiers t ON s.tier_id = t.id
      LEFT JOIN events e ON s.event_id = e.id
      WHERE UPPER(s.ticket_code) = UPPER(?) OR s.qr_code = ?
    `, [searchCode, code]);

    if (!sale) {
      return res.status(404).json({
        status: 'invalid',
        message: '❌ Entrada No Válida: El código no existe en el sistema.'
      });
    }

    if (sale.status !== 'confirmado') {
      return res.status(400).json({
        status: 'pending_payment',
        sale,
        message: `⚠️ Entrada con pago pendiente (${sale.status}).`
      });
    }

    if (sale.is_used === 1) {
      return res.json({
        status: 'already_used',
        sale,
        message: `⛔ ¡ALERTA! Esta entrada ya fue utilizada el ${new Date(sale.used_at || sale.created_at).toLocaleTimeString()} hs.`
      });
    }

    // Marcar como ingresado / usado en tiempo real
    const now = new Date().toISOString();
    await dbAsync.run(
      `UPDATE ticket_sales SET is_used = 1, used_at = ? WHERE id = ?`,
      [now, sale.id]
    );

    const updatedSale = { ...sale, is_used: 1, used_at: now };

    // Estadísticas de ingreso en puerta
    const stats = await dbAsync.get(`
      SELECT 
        COUNT(id) as total_sold,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as total_scanned
      FROM ticket_sales
      WHERE status = 'confirmado'
    `);

    res.json({
      status: 'valid',
      sale: updatedSale,
      message: '✅ ¡ENTRADA VÁLIDA - ACCESO PERMITIDO!',
      stats: {
        total_sold: stats.total_sold || 0,
        total_scanned: stats.total_scanned || 0,
        remaining: (stats.total_sold || 0) - (stats.total_scanned || 0)
      }
    });
  } catch (err) {
    console.error('Error validando QR:', err);
    res.status(500).json({ error: 'Error validando código QR.' });
  }
});

// Estadísticas de ingresos en puerta

// Reenviar email con voucher y QR al comprador
app.post('/api/tickets/resend-email/:ticketCode', authenticateToken, async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const saleInfo = await dbAsync.get(`
      SELECT s.*, t.name as tier_name, e.title as event_title, e.location as event_location, e.date as event_date, e.currency as event_currency
      FROM ticket_sales s
      LEFT JOIN ticket_tiers t ON s.tier_id = t.id
      LEFT JOIN events e ON s.event_id = e.id
      WHERE UPPER(s.ticket_code) = UPPER(?)
    `, [ticketCode.trim()]);

    if (!saleInfo) {
      return res.status(404).json({ error: 'Ticket no encontrado en el sistema.' });
    }

    const emailRes = await sendTicketEmail(saleInfo);
    res.json({
      success: true,
      message: emailRes.simulated
        ? `Comprobante simulado en consola para ${saleInfo.email}. (Configura SMTP en .env para envíos reales).`
        : `¡Correo con voucher y QR reenviado exitosamente a ${saleInfo.email}!`,
      details: emailRes
    });
  } catch (err) {
    console.error('Error reenviando email:', err);
    res.status(500).json({ error: 'Error al reenviar el correo.' });
  }
});

app.get('/api/tickets/access-stats', authenticateToken, async (req, res) => {
  try {
    const stats = await dbAsync.get(`
      SELECT 
        COUNT(id) as total_sold,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as total_scanned
      FROM ticket_sales
      WHERE status = 'confirmado'
    `);
    res.json({
      stats: {
        total_sold: stats.total_sold || 0,
        total_scanned: stats.total_scanned || 0,
        remaining: (stats.total_sold || 0) - (stats.total_scanned || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar accesos.' });
  }
});

// Verificar voucher (público)
app.get('/api/tickets/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const sale = await dbAsync.get(`
      SELECT s.*, t.name as tier_name, e.title as event_title, e.location as event_location, e.date as event_date, e.currency as event_currency
      FROM ticket_sales s
      LEFT JOIN ticket_tiers t ON s.tier_id = t.id
      LEFT JOIN events e ON s.event_id = e.id
      WHERE UPPER(s.ticket_code) = UPPER(?)
    `, [code]);

    if (!sale) {
      return res.status(404).json({ error: 'Voucher no encontrado.' });
    }

    res.json({ sale });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar voucher.' });
  }
});

// Ventas CRM
app.get('/api/tickets/sales', authenticateToken, async (req, res) => {
  try {
    const sales = await dbAsync.all(`
      SELECT s.*, t.name as tier_name, p.name as promoter_name
      FROM ticket_sales s
      LEFT JOIN ticket_tiers t ON s.tier_id = t.id
      LEFT JOIN promoters p ON s.promoter_id = p.id
      ORDER BY s.created_at DESC
    `);
    res.json({ sales });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar ventas.' });
  }
});

// ==========================================
// 6. GESTOR DE PROMOTORES / VENDEDORES (LINKS DIRECTOS /LUCAS)
// ==========================================
app.get('/api/promoters', authenticateToken, async (req, res) => {
  try {
    const promoters = await dbAsync.all(`SELECT * FROM promoters ORDER BY total_commission_earned DESC`);
    res.json({ promoters });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar promotores.' });
  }
});

app.post('/api/promoters', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, promo_code, slug, split_code, commission_percentage } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    const cleanCode = (promo_code || name.split(' ')[0] + '2026').trim().toUpperCase();
    const cleanSlug = (slug || name.split(' ')[0]).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    const result = await dbAsync.run(
      `INSERT INTO promoters (event_id, name, email, phone, promo_code, slug, split_code, commission_percentage, total_sales_count, total_commission_earned, is_active)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
      [name, email || '', phone || '', cleanCode, cleanSlug, split_code || '', parseFloat(commission_percentage) || 10.00]
    );

    res.json({ success: true, message: 'Vendedor registrado con éxito', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear promotor (código o enlace ya en uso).' });
  }
});

app.put('/api/promoters/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, promo_code, slug, split_code, commission_percentage, is_active } = req.body;
    const cleanSlug = (slug || name.split(' ')[0]).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    await dbAsync.run(
      `UPDATE promoters 
       SET name = ?, email = ?, phone = ?, promo_code = ?, slug = ?, split_code = ?, commission_percentage = ?, is_active = ?
       WHERE id = ?`,
      [name, email, phone, promo_code.toUpperCase(), cleanSlug, split_code, parseFloat(commission_percentage), is_active ? 1 : 0, id]
    );

    res.json({ success: true, message: 'Vendedor actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar promotor.' });
  }
});

app.delete('/api/promoters/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM promoters WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Vendedor eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar vendedor.' });
  }
});

// ==========================================
// 7. GASTOS, STAFF Y RUBROS (CRUD & FILTROS & BÚSQUEDA)
// ==========================================
app.get('/api/expenses/categories', async (req, res) => {
  try {
    const categories = await dbAsync.all(`SELECT * FROM categories ORDER BY is_custom ASC, name ASC`);
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener rubros.' });
  }
});

app.post('/api/expenses/categories', authenticateToken, async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre del rubro es requerido.' });

    const result = await dbAsync.run(
      `INSERT INTO categories (name, icon, color, is_custom) VALUES (?, ?, ?, 1)`,
      [name, icon || 'bi-bookmark-star-fill', color || '#10b981']
    );
    res.json({ success: true, message: 'Nuevo rubro añadido con éxito', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error o rubro duplicado.' });
  }
});

app.get('/api/expenses/providers', authenticateToken, async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = `SELECT * FROM expenses_providers WHERE 1=1`;
    const params = [];

    if (category && category !== 'todos') {
      sql += ` AND category_name = ?`;
      params.push(category);
    }

    if (search) {
      sql += ` AND (provider_name LIKE ? OR contact LIKE ? OR notes LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY category_name ASC, provider_name ASC`;
    const providers = await dbAsync.all(sql, params);
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener proveedores.' });
  }
});

app.post('/api/expenses/providers', authenticateToken, async (req, res) => {
  try {
    const { event_id, category_name, provider_name, contact, cost_agreed, is_paid, notes } = req.body;
    if (!category_name || !provider_name) {
      return res.status(400).json({ error: 'Categoría y nombre son requeridos.' });
    }

    const result = await dbAsync.run(
      `INSERT INTO expenses_providers (event_id, category_name, provider_name, contact, cost_agreed, is_paid, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [event_id || 1, category_name, provider_name, contact || '', parseFloat(cost_agreed) || 0, is_paid ? 1 : 0, notes || '']
    );
    res.json({ success: true, message: 'Proveedor registrado', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar proveedor.' });
  }
});

app.put('/api/expenses/providers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, provider_name, contact, cost_agreed, is_paid, notes } = req.body;

    await dbAsync.run(
      `UPDATE expenses_providers 
       SET category_name = ?, provider_name = ?, contact = ?, cost_agreed = ?, is_paid = ?, notes = ?
       WHERE id = ?`,
      [category_name, provider_name, contact, parseFloat(cost_agreed), is_paid ? 1 : 0, notes, id]
    );
    res.json({ success: true, message: 'Proveedor y presupuesto actualizados' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar proveedor.' });
  }
});

app.delete('/api/expenses/providers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM expenses_providers WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Proveedor eliminado del presupuesto' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar proveedor.' });
  }
});

// ==========================================
// 8. SPONSORS Y ALIANZAS B2B
// ==========================================
app.get('/api/sponsors', async (req, res) => {
  try {
    const sponsors = await dbAsync.all(`SELECT * FROM sponsors WHERE status = 'aprobado' ORDER BY tier ASC`);
    res.json({ sponsors });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sponsors.' });
  }
});

app.get('/api/sponsors/all', authenticateToken, async (req, res) => {
  try {
    const sponsors = await dbAsync.all(`SELECT * FROM sponsors ORDER BY created_at DESC`);
    res.json({ sponsors });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar todos los sponsors.' });
  }
});

app.post('/api/sponsors/apply', async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, tier, proposal } = req.body;
    if (!company_name || !email) {
      return res.status(400).json({ error: 'Empresa y email son requeridos.' });
    }

    await dbAsync.run(
      `INSERT INTO sponsors (event_id, company_name, contact_name, email, phone, tier, proposal, status)
       VALUES (1, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [company_name, contact_name || '', email, phone || '', tier || 'Gold', proposal || '']
    );

    res.json({ success: true, message: '¡Propuesta de sponsor enviada con éxito!' });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar propuesta.' });
  }
});

app.post('/api/sponsors', authenticateToken, async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, tier, logo_url, website_url, proposal, status } = req.body;
    const result = await dbAsync.run(
      `INSERT INTO sponsors (event_id, company_name, contact_name, email, phone, tier, logo_url, website_url, proposal, status)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [company_name, contact_name, email, phone, tier || 'Gold', logo_url || '', website_url || '', proposal || '', status || 'aprobado']
    );
    res.json({ success: true, message: 'Sponsor guardado', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear sponsor.' });
  }
});

app.put('/api/sponsors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, contact_name, email, phone, tier, logo_url, website_url, proposal, status } = req.body;
    await dbAsync.run(
      `UPDATE sponsors 
       SET company_name = ?, contact_name = ?, email = ?, phone = ?, tier = ?, logo_url = ?, website_url = ?, proposal = ?, status = ?
       WHERE id = ?`,
      [company_name, contact_name, email, phone, tier, logo_url, website_url, proposal, status, id]
    );
    res.json({ success: true, message: 'Sponsor actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar sponsor.' });
  }
});

app.delete('/api/sponsors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM sponsors WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Sponsor eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar sponsor.' });
  }
});

app.post('/api/b2b/staff-apply', async (req, res) => {
  try {
    const { provider_name, category_name, contact, email, phone, portfolio_url, message } = req.body;
    if (!provider_name || !category_name || !email) {
      return res.status(400).json({ error: 'Nombre, rubro y email son obligatorios.' });
    }

    await dbAsync.run(
      `INSERT INTO expenses_providers (event_id, category_name, provider_name, contact, cost_agreed, is_paid, notes)
       VALUES (1, ?, ?, ?, 0.00, 0, ?)`,
      [category_name, provider_name, `${contact || ''} | ${email} | ${phone || ''}`, `[Postulación Web] Portfolio: ${portfolio_url || 'N/A'} - Mensaje: ${message || ''}`]
    );

    res.json({ success: true, message: '¡Postulación recibida con éxito!' });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar la postulación.' });
  }
});

// ==========================================
// 9. GALERÍA MULTIMEDIA
// ==========================================
app.get('/api/gallery', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `SELECT * FROM gallery_media`;
    const params = [];
    if (category && category !== 'todos') {
      sql += ` WHERE category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY id DESC`;
    const items = await dbAsync.all(sql, params);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener galería multimedia.' });
  }
});

app.post('/api/gallery', authenticateToken, async (req, res) => {
  try {
    const { title, media_type, category, media_url, thumbnail_url, is_featured } = req.body;
    if (!media_url) return res.status(400).json({ error: 'La URL o archivo es requerido.' });

    const result = await dbAsync.run(
      `INSERT INTO gallery_media (event_id, title, media_type, category, media_url, thumbnail_url, is_featured)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [title || '', media_type || 'image', category || 'desfile', media_url, thumbnail_url || media_url, is_featured ? 1 : 0]
    );
    res.json({ success: true, message: 'Elemento agregado a la galería', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar elemento a la galería.' });
  }
});

app.delete('/api/gallery/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM gallery_media WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Elemento eliminado de la galería' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar multimedia.' });
  }
});

// ==========================================
// 10. ROADMAP SECUENCIAL
// ==========================================
app.get('/api/roadmap', async (req, res) => {
  try {
    const steps = await dbAsync.all(`SELECT * FROM roadmap_steps ORDER BY step_order ASC`);
    res.json({ steps });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener roadmap.' });
  }
});

app.put('/api/roadmap/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const currentStep = await dbAsync.get(`SELECT * FROM roadmap_steps WHERE id = ?`, [id]);
    if (!currentStep) return res.status(404).json({ error: 'Paso no encontrado.' });

    const newCompleted = currentStep.is_completed ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;

    await dbAsync.run(
      `UPDATE roadmap_steps SET is_completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newCompleted, completedAt, id]
    );

    if (newCompleted === 1) {
      await dbAsync.run(
        `UPDATE roadmap_steps SET is_unlocked = 1 WHERE step_order = ?`,
        [currentStep.step_order + 1]
      );
    }

    const steps = await dbAsync.all(`SELECT * FROM roadmap_steps ORDER BY step_order ASC`);
    res.json({ success: true, message: 'Progreso del roadmap actualizado', steps });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar roadmap.' });
  }
});

// ==========================================
// 11. TESTIMONIOS Y COMUNIDAD
// ==========================================
app.get('/api/feedback/approved', async (req, res) => {
  try {
    const reviews = await dbAsync.all(`SELECT * FROM feedback_comments WHERE is_approved = 1 ORDER BY id DESC LIMIT 12`);
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar opiniones aprobadas.' });
  }
});

app.get('/api/feedback/all', authenticateToken, async (req, res) => {
  try {
    const comments = await dbAsync.all(`SELECT * FROM feedback_comments ORDER BY created_at DESC`);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener bandeja de comentarios.' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { user_name, email, comment_text, rating } = req.body;
    if (!user_name || !email || !comment_text) {
      return res.status(400).json({ error: 'Por favor completa todos los campos.' });
    }

    const parsedRating = Math.max(1, Math.min(5, parseInt(rating) || 5));
    const avatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(user_name)}`;

    const result = await dbAsync.run(
      `INSERT INTO feedback_comments (user_name, email, comment_text, rating, avatar_url, edition_tag, is_approved)
       VALUES (?, ?, ?, ?, ?, 'Comunidad Spring Fashion', 1)`,
      [user_name, email, comment_text, parsedRating, avatarUrl]
    );

    res.json({
      success: true,
      message: '¡Muchas gracias por tu comentario!',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar comentario.' });
  }
});

app.put('/api/feedback/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;
    await dbAsync.run(`UPDATE feedback_comments SET is_approved = ? WHERE id = ?`, [is_approved ? 1 : 0, id]);
    res.json({ success: true, message: 'Estado de moderación actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al moderar comentario.' });
  }
});

app.delete('/api/feedback/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`DELETE FROM feedback_comments WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Comentario eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar comentario.' });
  }
});

// ==========================================
// 12. CALCULADORA FINANCIERA EN TIEMPO REAL
// ==========================================
app.get('/api/stats/financial', authenticateToken, async (req, res) => {
  try {
    const costStats = await dbAsync.get(`
      SELECT 
        COALESCE(SUM(cost_agreed), 0) as total_cost,
        COALESCE(SUM(CASE WHEN is_paid = 1 THEN cost_agreed ELSE 0 END), 0) as total_paid_cost,
        COALESCE(SUM(CASE WHEN is_paid = 0 THEN cost_agreed ELSE 0 END), 0) as total_pending_cost
      FROM expenses_providers
    `);

    const revenueStats = await dbAsync.get(`
      SELECT 
        COALESCE(SUM(total_paid), 0) as total_revenue,
        COALESCE(SUM(quantity), 0) as total_tickets_sold,
        COUNT(id) as total_transactions
      FROM ticket_sales
      WHERE status = 'confirmado'
    `);

    const promoterStats = await dbAsync.get(`
      SELECT 
        COALESCE(SUM(total_commission_earned), 0) as total_commission_to_pay,
        COALESCE(SUM(total_sales_count), 0) as total_promoter_tickets
      FROM promoters
    `);

    const categoryBreakdown = await dbAsync.all(`
      SELECT 
        category_name,
        COUNT(id) as providers_count,
        COALESCE(SUM(cost_agreed), 0) as category_total,
        COALESCE(SUM(CASE WHEN is_paid = 1 THEN cost_agreed ELSE 0 END), 0) as category_paid
      FROM expenses_providers
      GROUP BY category_name
      ORDER BY category_total DESC
    `);

    const leadsCount = await dbAsync.get(`SELECT COUNT(DISTINCT email) as count FROM feedback_comments`);
    const sponsorsCount = await dbAsync.get(`SELECT COUNT(*) as count FROM sponsors WHERE status = 'aprobado'`);

    const totalCost = costStats.total_cost || 0;
    const totalRevenue = revenueStats.total_revenue || 0;
    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : (totalCost > 0 ? -100 : 0);

    let semaforo = 'green';
    let statusText = 'Rentabilidad Positiva';
    if (netProfit < 0) {
      semaforo = 'red';
      statusText = 'Déficit Operativo Actual (Preventa en curso)';
    } else if (netProfit === 0) {
      semaforo = 'yellow';
      statusText = 'Punto de Equilibrio (Break-even)';
    }

    res.json({
      financials: {
        total_operational_cost: totalCost,
        total_paid_cost: costStats.total_paid_cost || 0,
        total_pending_cost: costStats.total_pending_cost || 0,
        total_gross_revenue: totalRevenue,
        real_net_profit: netProfit,
        profit_margin_percentage: parseFloat(profitMargin.toFixed(2)),
        semaforo,
        status_text: statusText,
        total_tickets_sold: revenueStats.total_tickets_sold || 0,
        total_transactions: revenueStats.total_transactions || 0,
        total_commission_to_pay: promoterStats.total_commission_to_pay || 0,
        total_promoter_tickets: promoterStats.total_promoter_tickets || 0,
        total_leads: leadsCount.count || 0,
        total_sponsors: sponsorsCount.count || 0,
        category_breakdown: categoryBreakdown
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular balance financiero.' });
  }
});

// Subida de archivos (Multer)
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Archivo subido con éxito',
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar subida de archivo.' });
  }
});

// Ruta amigable de promotores (/lucas, /sofia, etc.)
app.get('/:promoterSlug', async (req, res, next) => {
  const { promoterSlug } = req.params;
  
  // Ignorar archivos estáticos
  if (promoterSlug.includes('.') || promoterSlug === 'api') {
    return next();
  }

  try {
    const promoter = await dbAsync.get(
      `SELECT * FROM promoters WHERE LOWER(slug) = LOWER(?) OR LOWER(promo_code) = LOWER(?)`,
      [promoterSlug, promoterSlug]
    );

    if (promoter) {
      // Redirigir a la landing con el parámetro ref para capturar la sesión
      return res.redirect(`/?ref=${promoter.slug || promoter.promo_code}`);
    }
  } catch (e) {}

  next();
});

// Catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar base de datos y arrancar servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Spring Fashion activo en http://localhost:${PORT}`);
  });
});
