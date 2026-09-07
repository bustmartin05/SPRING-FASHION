const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbPath = isVercel
  ? path.join('/tmp', 'spring_fashion.db')
  : path.resolve(__dirname, 'spring_fashion.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error abriendo la base de datos SQLite:', err.message);
  } else {
    console.log('✅ Base de datos SQLite conectada en:', dbPath);
  }
});

const dbAsync = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};

async function initDatabase() {
  try {
    // 1. Crear tablas base
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Desfile Show / Sunset',
        tagline TEXT,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        currency TEXT DEFAULT 'ARS',
        hero_video_url TEXT,
        banner_url TEXT,
        status TEXT NOT NULL DEFAULT 'activo',
        description TEXT,
        show_experiences INTEGER DEFAULT 1,
        show_lineup INTEGER DEFAULT 1,
        mediakit_file_url TEXT,
        mediakit_download_link TEXT,
        dlocal_env TEXT DEFAULT 'production',
        dlocal_api_key TEXT,
        dlocal_api_secret TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        badge TEXT DEFAULT 'General',
        price REAL NOT NULL DEFAULT 0.00,
        stock INTEGER NOT NULL DEFAULT 100,
        sold_count INTEGER NOT NULL DEFAULT 0,
        features_json TEXT,
        tier_status TEXT DEFAULT 'activa',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        buyer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        tier_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        total_paid REAL NOT NULL,
        payment_method TEXT DEFAULT 'dLocal Go',
        ticket_code TEXT UNIQUE,
        qr_code TEXT,
        promoter_id INTEGER,
        promoter_code TEXT,
        split_code TEXT,
        dlocal_payment_id TEXT,
        dlocal_redirect_url TEXT,
        is_used INTEGER DEFAULT 0,
        used_at DATETIME,
        status TEXT DEFAULT 'confirmado',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS promoters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        promo_code TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE,
        split_code TEXT,
        commission_percentage REAL NOT NULL DEFAULT 10.00,
        total_sales_count INTEGER NOT NULL DEFAULT 0,
        total_commission_earned REAL NOT NULL DEFAULT 0.00,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT 'bi-tags',
        color TEXT DEFAULT '#f59e0b',
        is_custom INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS expenses_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        category_name TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        contact TEXT,
        cost_agreed REAL NOT NULL DEFAULT 0.00,
        is_paid INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sponsors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        company_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        tier TEXT DEFAULT 'Platinum',
        logo_url TEXT,
        website_url TEXT,
        proposal TEXT,
        status TEXT DEFAULT 'aprobado',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS gallery_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        title TEXT,
        media_type TEXT DEFAULT 'image',
        category TEXT DEFAULT 'desfile',
        media_url TEXT NOT NULL,
        thumbnail_url TEXT,
        is_featured INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        email TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 5,
        avatar_url TEXT,
        edition_tag TEXT DEFAULT 'Edición Anterior',
        is_approved INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS roadmap_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        step_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        is_completed INTEGER NOT NULL DEFAULT 0,
        is_unlocked INTEGER NOT NULL DEFAULT 0,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'superadmin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_experiences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT DEFAULT 'bi-stars',
        image_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        role_title TEXT NOT NULL,
        category TEXT DEFAULT 'diseñador',
        bio TEXT,
        image_url TEXT,
        instagram_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migraciones de columnas adicionales
    const migrations = [
      `ALTER TABLE events ADD COLUMN currency TEXT DEFAULT 'ARS'`,
      `ALTER TABLE events ADD COLUMN show_experiences INTEGER DEFAULT 1`,
      `ALTER TABLE events ADD COLUMN show_lineup INTEGER DEFAULT 1`,
      `ALTER TABLE events ADD COLUMN mediakit_file_url TEXT`,
      `ALTER TABLE events ADD COLUMN mediakit_download_link TEXT`,
      `ALTER TABLE events ADD COLUMN dlocal_env TEXT DEFAULT 'production'`,
      `ALTER TABLE events ADD COLUMN dlocal_api_key TEXT`,
      `ALTER TABLE events ADD COLUMN dlocal_api_secret TEXT`,
      `ALTER TABLE ticket_sales ADD COLUMN promoter_id INTEGER`,
      `ALTER TABLE ticket_sales ADD COLUMN promoter_code TEXT`,
      `ALTER TABLE ticket_sales ADD COLUMN split_code TEXT`,
      `ALTER TABLE ticket_sales ADD COLUMN dlocal_payment_id TEXT`,
      `ALTER TABLE ticket_sales ADD COLUMN dlocal_redirect_url TEXT`,
      `ALTER TABLE ticket_sales ADD COLUMN is_used INTEGER DEFAULT 0`,
      `ALTER TABLE ticket_sales ADD COLUMN used_at DATETIME`,
      `ALTER TABLE ticket_tiers ADD COLUMN tier_status TEXT DEFAULT 'activa'`,
      `ALTER TABLE promoters ADD COLUMN slug TEXT`
    ];

    for (const mig of migrations) {
      try {
        await dbAsync.run(mig);
      } catch (e) {}
    }

    // 2. Admin inicial por defecto
    const defaultUser = process.env.ADMIN_DEFAULT_USER || 'admin';
    const defaultPass = process.env.ADMIN_DEFAULT_PASS || 'admin123';
    
    const existingAdmin = await dbAsync.get(`SELECT * FROM admin_users WHERE username = ?`, [defaultUser]);
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(defaultPass, salt);
      await dbAsync.run(
        `INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)`,
        [defaultUser, hash, 'superadmin']
      );
      console.log(`🔐 Usuario admin inicial '${defaultUser}' creado.`);
    }

    // 3. Evento Principal con credenciales dLocal Go de Producción
    const dlocalKey = process.env.DLOCAL_API_KEY || '';
    const dlocalSecret = process.env.DLOCAL_API_SECRET || '';

    const event = await dbAsync.get(`SELECT * FROM events ORDER BY id ASC LIMIT 1`);
    let eventId = 1;
    if (!event) {
      const eventResult = await dbAsync.run(
        `INSERT INTO events (
          title, type, tagline, date, location, currency, hero_video_url, banner_url, status, 
          description, show_experiences, show_lineup, dlocal_env, dlocal_api_key, dlocal_api_secret
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'production', ?, ?)`,
        [
          'Spring Fashion 2026',
          'Desfile Show / Sunset',
          'Donde la alta costura se fusiona con el atardecer, la música electrónica de vanguardia y el networking exclusivo.',
          '2026-11-21T17:30:00',
          'Bodega & Viñedos Monteviejo, Valle de Uco, Mendoza',
          'ARS',
          'https://assets.mixkit.co/videos/preview/mixkit-models-walking-on-a-runway-at-a-fashion-show-41846-large.mp4',
          'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1920&q=80',
          'activo',
          'Una experiencia multisensorial única que reúne a diseñadores de renombre, modelos de alta costura, DJs internacionales, gastronomía de autor maridada con vinos de bodega boutique y un espacio de coworking/networking para marcas y creadores.',
          dlocalKey,
          dlocalSecret
        ]
      );
      eventId = eventResult.lastID;
    } else {
      eventId = event.id;
      await dbAsync.run(
        `UPDATE events SET 
          dlocal_env = 'production', 
          dlocal_api_key = COALESCE(dlocal_api_key, ?), 
          dlocal_api_secret = COALESCE(dlocal_api_secret, ?) 
         WHERE id = ?`,
        [dlocalKey, dlocalSecret, eventId]
      );
    }

    // 4. Limpieza para dejar 1 SOLO EJEMPLO LIMPIO DE CADA ENTIDAD (Listo para Producción)
    
    // Categorías (1 principal)
    const catCount = await dbAsync.get(`SELECT COUNT(*) as count FROM categories`);
    if (catCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO categories (name, icon, color, is_custom) VALUES ('Sonido, Luces y Pantallas LED', 'bi-lightning-charge-fill', '#8b5cf6', 0)`
      );
    }

    // Tiers (1 Pase Principal)
    const tierCount = await dbAsync.get(`SELECT COUNT(*) as count FROM ticket_tiers WHERE event_id = ?`, [eventId]);
    if (tierCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO ticket_tiers (event_id, name, badge, price, stock, sold_count, features_json, tier_status, is_active)
         VALUES (?, 'Pase General - Early Bird', 'Preventa Exclusiva', 25000.00, 200, 0, ?, 'activa', 1)`,
        [eventId, JSON.stringify([
          'Acceso general al desfile show y pasarela',
          'Copa de bienvenida de Bodega Monteviejo',
          'Acceso al sector Sunset y música en vivo',
          'Voucher digital con código QR de acreditación'
        ])]
      );
    }

    // Experiencias Multisensoriales (1 Ejemplo)
    const expCount = await dbAsync.get(`SELECT COUNT(*) as count FROM event_experiences WHERE event_id = ?`, [eventId]);
    if (expCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO event_experiences (event_id, title, description, icon, image_url, sort_order, is_active)
         VALUES (?, 'Alta Costura & Runway Show', '24 modelos en pasarela exhibiendo colecciones exclusivas de diseñadores al atardecer.', 'bi-stars', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80', 1, 1)`,
        [eventId]
      );
    }

    // Artistas / Speakers Invitados (1 Ejemplo)
    const artCount = await dbAsync.get(`SELECT COUNT(*) as count FROM event_artists WHERE event_id = ?`, [eventId]);
    if (artCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO event_artists (event_id, name, role_title, category, bio, image_url, instagram_url, sort_order, is_active)
         VALUES (?, 'Camila Rossi', 'Diseñadora de Alta Costura', 'diseñador', 'Referente de la moda de autor con colecciones de vanguardia presentadas en pasarelas internacionales.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', 'https://instagram.com', 1, 1)`,
        [eventId]
      );
    }

    // Sponsors (1 Ejemplo)
    const sponsorCount = await dbAsync.get(`SELECT COUNT(*) as count FROM sponsors WHERE event_id = ?`, [eventId]);
    if (sponsorCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO sponsors (event_id, company_name, contact_name, email, tier, logo_url, website_url, proposal, status)
         VALUES (?, 'Bodega Monteviejo', 'Ignacio Larrea', 'marketing@monteviejo.com', 'Platinum', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=300&q=80', 'https://bodegamonteviejo.com', 'Locación oficial y maridaje de vinos de alta gama', 'aprobado')`,
        [eventId]
      );
    }

    // Promotores / RRPP (1 Ejemplo con link directo /lucas)
    const promoCount = await dbAsync.get(`SELECT COUNT(*) as count FROM promoters`);
    if (promoCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO promoters (event_id, name, email, phone, promo_code, slug, split_code, commission_percentage, total_sales_count, total_commission_earned, is_active)
         VALUES (1, 'Lucas Gómez (RRPP)', 'lucas@springpromoters.com', '+54 9 261 555-0199', 'LUCAS2026', 'lucas', 'c5BsnXQ6NR==', 10.00, 0, 0.00, 1)`
      );
    }

    // Proveedor / Gasto (1 Ejemplo)
    const expenseCount = await dbAsync.get(`SELECT COUNT(*) as count FROM expenses_providers WHERE event_id = ?`, [eventId]);
    if (expenseCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO expenses_providers (event_id, category_name, provider_name, contact, cost_agreed, is_paid, notes)
         VALUES (?, 'Sonido, Luces y Pantallas LED', 'AudioStage Pro Rentals', '+54 9 261 455-8891', 180000.00, 0, 'Seña 50% acordada')`,
        [eventId]
      );
    }

    // Galería (1 Ejemplo)
    const galleryCount = await dbAsync.get(`SELECT COUNT(*) as count FROM gallery_media WHERE event_id = ?`, [eventId]);
    if (galleryCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO gallery_media (event_id, title, media_type, category, media_url, thumbnail_url, is_featured)
         VALUES (?, 'Pasarela Principal al Atardecer', 'image', 'desfile', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80', 1)`,
        [eventId]
      );
    }

    // Feedback / Testimonios (1 Ejemplo)
    const feedbackCount = await dbAsync.get(`SELECT COUNT(*) as count FROM feedback_comments`);
    if (feedbackCount.count === 0) {
      await dbAsync.run(
        `INSERT INTO feedback_comments (user_name, email, comment_text, rating, avatar_url, edition_tag, is_approved)
         VALUES ('Florencia Benítez', 'florencia.b@gmail.com', 'Una experiencia inigualable que combina moda de alta costura, música de primer nivel y un atardecer inolvidable.', 5, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', 'Edición Anterior', 1)`
      );
    }

    // Roadmap Secuencial (6 pasos de producción)
    const roadmapCount = await dbAsync.get(`SELECT COUNT(*) as count FROM roadmap_steps WHERE event_id = ?`, [eventId]);
    if (roadmapCount.count === 0) {
      const stepsSeed = [
        { step_order: 1, title: 'Definición de Fecha, Formato y Locación', description: 'Confirmación de locación en Bodega Monteviejo y habilitaciones.', is_completed: 1, is_unlocked: 1, completed_at: new Date().toISOString() },
        { step_order: 2, title: 'Creación de Identidad Visual y Media Kit', description: 'Lanzamiento de identidad, catálogo B2B y apertura de plataforma.', is_completed: 1, is_unlocked: 1, completed_at: new Date().toISOString() },
        { step_order: 3, title: 'Lanzamiento de Preventa y Captación de Sponsors', description: 'Venta de entradas con dLocal Go y acuerdos con marcas aliadas.', is_completed: 0, is_unlocked: 1, completed_at: null },
        { step_order: 4, title: 'Confirmación Técnica, Artistas y Pasarela', description: 'Rider de iluminación, sonido, 24 modelos y line-up musical.', is_completed: 0, is_unlocked: 0, completed_at: null },
        { step_order: 5, title: 'Montaje, Desfile Show y Acreditaciones', description: 'Apertura de puertas con escáner QR y ejecución del desfile.', is_completed: 0, is_unlocked: 0, completed_at: null }
      ];

      for (const s of stepsSeed) {
        await dbAsync.run(
          `INSERT INTO roadmap_steps (event_id, step_order, title, description, is_completed, is_unlocked, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [eventId, s.step_order, s.title, s.description, s.is_completed, s.is_unlocked, s.completed_at]
        );
      }
    }

    console.log('✨ Base de datos lista para Producción con 1 ejemplo por sección y claves dLocal Go reales.');
  } catch (err) {
    console.error('❌ Error inicializando base de datos:', err);
  }
}

module.exports = {
  db,
  dbAsync,
  initDatabase
};
