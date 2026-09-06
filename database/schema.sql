-- ====================================================================
-- ESQUEMA RELACIONAL SQL: PLATAFORMA INTEGRAL SPRING FASHION
-- Compatible con SQLite, PostgreSQL, MySQL y Supabase
-- ====================================================================

-- 1. Tabla de Eventos y Configuración General
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'Desfile Show / Sunset',
    tagline TEXT,
    date VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    hero_video_url TEXT,
    banner_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'activo',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Niveles y Precios de Entradas (Tiers)
CREATE TABLE IF NOT EXISTS ticket_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    badge VARCHAR(50) DEFAULT 'General',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 100,
    sold_count INTEGER NOT NULL DEFAULT 0,
    features_json TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 3. Registro de Ventas de Entradas / Compradores
CREATE TABLE IF NOT EXISTS ticket_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    buyer_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    tier_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_paid DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'MercadoPago',
    ticket_code VARCHAR(100) UNIQUE,
    qr_code TEXT,
    status VARCHAR(50) DEFAULT 'confirmado',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id)
);

-- 4. Rubros y Categorías Operativas
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) DEFAULT 'fa-tags',
    color VARCHAR(20) DEFAULT '#f59e0b',
    is_custom INTEGER DEFAULT 0
);

-- 5. Presupuesto, Staff y Proveedores por Rubro
CREATE TABLE IF NOT EXISTS expenses_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    provider_name VARCHAR(150) NOT NULL,
    contact VARCHAR(150),
    cost_agreed DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_paid INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 6. Sponsors y Marcas Aliadas
CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(50),
    tier VARCHAR(50) DEFAULT 'Gold',
    logo_url TEXT,
    website_url TEXT,
    proposal TEXT,
    status VARCHAR(50) DEFAULT 'aprobado',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 7. Galería Multimedia (Fotos y Videos)
CREATE TABLE IF NOT EXISTS gallery_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    title VARCHAR(150),
    media_type VARCHAR(20) DEFAULT 'image',
    category VARCHAR(50) DEFAULT 'desfile',
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_featured INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 8. Reseñas de la Comunidad y Captación de Mailing
CREATE TABLE IF NOT EXISTS feedback_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    comment_text TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    avatar_url TEXT,
    edition_tag VARCHAR(50) DEFAULT 'Edición Anterior',
    is_approved INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Hoja de Ruta Secuencial de Producción (Roadmap)
CREATE TABLE IF NOT EXISTS roadmap_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    is_unlocked INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 10. Usuarios Administradores (Contraseñas Hasheadas con Bcrypt)
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'superadmin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
