-- PharmaInventory SaaS - Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

-- Stores (Farmácias)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    address JSONB NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    settings JSONB DEFAULT '{
        "defaultExpiryAlertDays": 90,
        "autoSyncEnabled": true,
        "requirePhotoEvidence": false,
        "allowedScanModes": ["continuous", "matrix"],
        "maxSessionDuration": 28800
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Usuários do sistema)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator', 'auditor')),
    store_ids UUID[] DEFAULT '{}',
    avatar_url TEXT,
    preferences JSONB DEFAULT '{
        "theme": "system",
        "language": "pt-BR",
        "hapticFeedback": true,
        "soundEnabled": true,
        "autoFocus": true,
        "vibrationOnScan": true
    }'::jsonb,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products (Produtos farmacêuticos)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    gtin VARCHAR(14) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    manufacturer VARCHAR(255),
    presentation VARCHAR(100),
    concentration VARCHAR(100),
    unit VARCHAR(10) DEFAULT 'UN' CHECK (unit IN ('UN', 'CX', 'FR', 'ML', 'G', 'KG', 'L')),
    barcode_formats VARCHAR(20)[] DEFAULT '{"EAN_13"}',
    price DECIMAL(10,2),
    cost DECIMAL(10,2),
    requires_prescription BOOLEAN DEFAULT false,
    controlled_substance BOOLEAN DEFAULT false,
    temperature_range JSONB,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, gtin)
);

-- Inventory Sessions (Sessões de balanço)
CREATE TABLE inventory_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'cancelled', 'synced')),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    total_items_scanned INTEGER DEFAULT 0,
    unique_products_scanned INTEGER DEFAULT 0,
    divergences_count INTEGER DEFAULT 0,
    expired_items_count INTEGER DEFAULT 0,
    near_expiry_items_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{
        "autoSaveInterval": 30000,
        "divergenceThreshold": 5,
        "expiryAlertDays": 90,
        "requireConfirmation": true,
        "scanMode": "continuous",
        "roiEnabled": true,
        "perspectiveCorrection": false
    }'::jsonb,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scanned Items (Itens escaneados na sessão)
CREATE TABLE scanned_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    gtin VARCHAR(14) NOT NULL,
    product_name VARCHAR(500),
    quantity INTEGER NOT NULL DEFAULT 1,
    system_quantity INTEGER,
    divergence INTEGER DEFAULT 0,
    divergence_percentage DECIMAL(5,2) DEFAULT 0,
    unit_cost DECIMAL(10,2),
    total_value DECIMAL(10,2),
    batch_number VARCHAR(100),
    expiry_date DATE,
    days_to_expiry INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'divergence', 'expired', 'near_expiry', 'not_found', 'manual_entry')),
    detections JSONB DEFAULT '[]',
    spatial_cluster JSONB,
    location JSONB,
    notes TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Divergence Logs (Logs de divergência)
CREATE TABLE divergence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES scanned_items(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('quantity_mismatch', 'product_not_found', 'expired_product', 'near_expiry_product', 'wrong_location', 'damaged_product', 'batch_mismatch')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    expected_quantity INTEGER NOT NULL,
    actual_quantity INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    value_impact DECIMAL(10,2) DEFAULT 0,
    description TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution VARCHAR(20) CHECK (resolution IN ('accepted', 'corrected', 'investigating', 'write_off', 'return_to_supplier')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expiry Alerts (Alertas de validade)
CREATE TABLE expiry_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES scanned_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    gtin VARCHAR(14) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE NOT NULL,
    days_to_expiry INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('expired', 'critical', 'warning', 'info')),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_products_store_gtin ON products(store_id, gtin);
CREATE INDEX idx_products_store_name ON products(store_id, name);
CREATE INDEX idx_sessions_store_status ON inventory_sessions(store_id, status);
CREATE INDEX idx_sessions_user ON inventory_sessions(user_id);
CREATE INDEX idx_scanned_items_session ON scanned_items(session_id);
CREATE INDEX idx_scanned_items_gtin ON scanned_items(gtin);
CREATE INDEX idx_divergence_logs_session ON divergence_logs(session_id);
CREATE INDEX idx_expiry_alerts_session ON expiry_alerts(session_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE divergence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expiry_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for stores
CREATE POLICY "Users can view their stores" ON stores
    FOR SELECT USING (id = ANY(
        SELECT store_ids FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage stores" ON stores
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Policies for users
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Policies for products
CREATE POLICY "Users can view products from their stores" ON products
    FOR SELECT USING (store_id = ANY(
        SELECT store_ids FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Managers can manage products" ON products
    FOR ALL USING (
        store_id = ANY(
            SELECT store_ids FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Policies for sessions
CREATE POLICY "Users can view sessions from their stores" ON inventory_sessions
    FOR SELECT USING (store_id = ANY(
        SELECT store_ids FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can create sessions for their stores" ON inventory_sessions
    FOR INSERT WITH CHECK (store_id = ANY(
        SELECT store_ids FROM users WHERE id = auth.uid()
    ) AND user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON inventory_sessions
    FOR UPDATE USING (user_id = auth.uid());

-- Policies for scanned_items
CREATE POLICY "Users can view items from their sessions" ON scanned_items
    FOR SELECT USING (session_id IN (
        SELECT id FROM inventory_sessions WHERE store_id = ANY(
            SELECT store_ids FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert items in own sessions" ON scanned_items
    FOR INSERT WITH CHECK (session_id IN (
        SELECT id FROM inventory_sessions WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update items in own sessions" ON scanned_items
    FOR UPDATE USING (session_id IN (
        SELECT id FROM inventory_sessions WHERE user_id = auth.uid()
    ));

-- Policies for divergence_logs
CREATE POLICY "Users can view divergences from their sessions" ON divergence_logs
    FOR SELECT USING (session_id IN (
        SELECT id FROM inventory_sessions WHERE store_id = ANY(
            SELECT store_ids FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can manage divergences in own sessions" ON divergence_logs
    FOR ALL USING (session_id IN (
        SELECT id FROM inventory_sessions WHERE user_id = auth.uid()
    ));

-- Policies for expiry_alerts
CREATE POLICY "Users can view alerts from their sessions" ON expiry_alerts
    FOR SELECT USING (session_id IN (
        SELECT id FROM inventory_sessions WHERE store_id = ANY(
            SELECT store_ids FROM users WHERE id = auth.uid()
        )
    ));

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON inventory_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scanned_items_updated_at BEFORE UPDATE ON scanned_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_divergence_logs_updated_at BEFORE UPDATE ON divergence_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expiry_alerts_updated_at BEFORE UPDATE ON expiry_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get product by GTIN for a store
CREATE OR REPLACE FUNCTION get_product_by_gtin(p_store_id UUID, p_gtin VARCHAR)
RETURNS SETOF products AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM products
    WHERE store_id = p_store_id AND gtin = p_gtin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate session statistics
CREATE OR REPLACE FUNCTION calculate_session_stats(p_session_id UUID)
RETURNS TABLE (
    total_items INTEGER,
    unique_products INTEGER,
    divergences INTEGER,
    expired_items INTEGER,
    near_expiry_items INTEGER,
    total_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN quantity END), 0),
        COUNT(DISTINCT CASE WHEN status = 'confirmed' THEN gtin END),
        COUNT(*) FILTER (WHERE status = 'divergence'),
        COUNT(*) FILTER (WHERE status = 'expired'),
        COUNT(*) FILTER (WHERE status = 'near_expiry'),
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total_value END), 0)
    FROM scanned_items
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE inventory_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE scanned_items;
ALTER PUBLICATION supabase_realtime ADD TABLE divergence_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE expiry_alerts;

-- ============================================
-- SAMPLE DATA (Optional)
-- ============================================

-- INSERT INTO stores (name, cnpj, address) VALUES
-- ('Farmácia Central', '12.345.678/0001-90', '{"street": "Rua Principal", "number": "100", "neighborhood": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01000-000", "country": "Brasil"}');

-- INSERT INTO products (store_id, gtin, name, manufacturer, unit, price, cost) VALUES
-- ((SELECT id FROM stores WHERE cnpj = '12.345.678/0001-90'), '7896004701234', 'Dipirona 500mg', 'Medley', 'CX', 12.50, 8.00),
-- ((SELECT id FROM stores WHERE cnpj = '12.345.678/0001-90'), '7891058000123', 'Paracetamol 750mg', 'EMS', 'CX', 15.90, 10.50);