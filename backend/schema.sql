-- SQLite Schema for POS Minimarket
-- This matches the IndexedDB structure for seamless migration
-- Fecha de actualización: 2026-04-23

CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    address TEXT,
    config JSON,
    createdAt TEXT,
    isActive INTEGER DEFAULT 1,
    plan TEXT DEFAULT 'basic',
    accessCode TEXT,
    subscription_ends_at TEXT,
    account_id INTEGER
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    cost REAL DEFAULT 0,
    costNeto REAL DEFAULT 0,
    markupPercent REAL DEFAULT 0,
    ivaType TEXT DEFAULT '19%',
    price REAL DEFAULT 0,
    stock REAL DEFAULT 0,
    minStock REAL DEFAULT 0,
    maxStock REAL DEFAULT 0,
    type TEXT DEFAULT 'unit',
    image TEXT,
    expiryDate TEXT,
    lastSoldAt TEXT,
    updatedAt TEXT,
    createdAt TEXT,
    isActive INTEGER DEFAULT 1,
    deletedAt TEXT,
    createdBy INTEGER,
    updatedBy INTEGER,
    lastSupplierId INTEGER,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER,
    additionalTaxesConfig JSON
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(isActive);
CREATE INDEX IF NOT EXISTS idx_products_business_active ON products(business_id, isActive);
CREATE INDEX IF NOT EXISTS idx_products_business_category ON products(business_id, category);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280',
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    rut TEXT,
    address TEXT,
    creditLimit REAL,
    balanceCredit REAL DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    isActive INTEGER DEFAULT 1,
    deletedAt TEXT,
    createdBy INTEGER,
    updatedBy INTEGER,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    isActive INTEGER DEFAULT 1,
    deletedAt TEXT,
    createdBy INTEGER,
    updatedBy INTEGER,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleNumber INTEGER,
    date TEXT NOT NULL,
    customerId INTEGER,
    items JSON,
    subtotal REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paidAmount REAL DEFAULT 0,
    paymentMethod TEXT,
    paymentDetails JSON,
    status TEXT DEFAULT 'completed',
    cashRegisterId INTEGER,
    userId INTEGER,
    idempotencyKey TEXT,
    base_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    commission_amount REAL DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    paidAt TEXT,
    createdBy INTEGER,
    updatedBy INTEGER,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customerId);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_business_status ON sales(business_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_cashregister ON sales(cashRegisterId, date);

CREATE TABLE IF NOT EXISTS stockMovements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER,
    type TEXT,
    quantity REAL,
    reference TEXT,
    reason TEXT,
    date TEXT,
    cost_value REAL,
    sale_value REAL,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_productId ON stockMovements(productId);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stockMovements(date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stockMovements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON stockMovements(business_id);

CREATE TABLE IF NOT EXISTS cashRegisters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    openDate TEXT,
    closeDate TEXT,
    initialAmount REAL DEFAULT 0,
    finalAmount REAL DEFAULT 0,
    expectedAmount REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    observations TEXT,
    denominations JSON,
    paymentSummary JSON,
    countedByMethod JSON,
    business_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cashMovements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashRegisterId INTEGER,
    type TEXT,
    amount REAL,
    description TEXT,
    date TEXT,
    paymentId INTEGER,
    saleId INTEGER,
    expenseId INTEGER,
    business_id INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cashMovements(cashRegisterId);
CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON cashMovements(date);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT,
    role TEXT,
    phone TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    recoveryCode TEXT,
    recoveryCodeGeneratedAt TEXT,
    forcePasswordChange INTEGER DEFAULT 0,
    business_id INTEGER DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_business ON users(username, business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_business ON users(phone, business_id);

CREATE TABLE IF NOT EXISTS loginAttempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    attemptCount INTEGER DEFAULT 0,
    lastAttemptAt TEXT,
    lockedUntil TEXT,
    business_id INTEGER DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_login_attempts_identifier_business ON loginAttempts(identifier, business_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON loginAttempts(identifier);
CREATE INDEX IF NOT EXISTS idx_login_attempts_business ON loginAttempts(business_id);

CREATE TABLE IF NOT EXISTS auditLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT,
    entityId INTEGER,
    action TEXT,
    summary TEXT,
    metadata JSON,
    timestamp TEXT,
    userId INTEGER,
    username TEXT,
    business_id INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON auditLogs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON auditLogs(entity);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT NOT NULL,
    value JSON,
    business_id INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (key, business_id)
);

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchaseNumber INTEGER,
    supplierId INTEGER,
    date TEXT,
    documentType TEXT,
    invoiceNumber TEXT,
    invoiceDate TEXT,
    subtotal REAL DEFAULT 0,
    ivaAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paidAmount REAL DEFAULT 0,
    dueDate TEXT,
    vatMode TEXT,
    items JSON,
    status TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    createdBy INTEGER,
    updatedBy INTEGER,
    cashRegisterId INTEGER,
    business_id INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplierId);
CREATE INDEX IF NOT EXISTS idx_purchases_business_date ON purchases(business_id, date);
CREATE INDEX IF NOT EXISTS idx_purchases_business_status ON purchases(business_id, status);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    amount REAL,
    description TEXT,
    date TEXT,
    cashRegisterId INTEGER,
    documentType TEXT DEFAULT 'comprobante_interno',
    documentNumber TEXT,
    paymentMethod TEXT DEFAULT 'cash',
    supplierId INTEGER,
    userId INTEGER,
    attachmentPath TEXT,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER,
    customerId INTEGER,
    amount REAL,
    paymentMethod TEXT,
    date TEXT,
    cashRegisterId INTEGER,
    notes TEXT,
    business_id INTEGER DEFAULT 1,
    is_synced INTEGER DEFAULT 0,
    server_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(saleId);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customerId);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

CREATE TABLE IF NOT EXISTS customerCreditDeposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId INTEGER,
    amount REAL,
    paymentMethod TEXT,
    cashRegisterId INTEGER,
    date TEXT,
    notes TEXT,
    business_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customerCreditUses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId INTEGER,
    date TEXT,
    amount REAL,
    saleId INTEGER,
    saleNumber INTEGER,
    notes TEXT,
    business_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS productPriceHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER,
    oldPrice REAL,
    newPrice REAL,
    date TEXT,
    userId INTEGER,
    business_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS supplierPayments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplierId INTEGER,
    purchaseId INTEGER,
    amount REAL,
    method TEXT,
    date TEXT,
    reference TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    createdBy INTEGER,
    updatedBy INTEGER,
    business_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS saleReturns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER,
    saleNumber INTEGER,
    date TEXT,
    items JSON,
    totalReturned REAL,
    reason TEXT,
    createdAt TEXT,
    createdBy INTEGER,
    business_id INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS passwordResets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    date TEXT,
    code TEXT,
    status TEXT,
    business_id INTEGER DEFAULT 1
);

-- ÍNDICES DE RENDIMIENTO ADICIONALES
CREATE INDEX IF NOT EXISTS idx_payments_business_sale ON payments(business_id, saleId);
CREATE INDEX IF NOT EXISTS idx_payments_business_customer ON payments(business_id, customerId);
CREATE INDEX IF NOT EXISTS idx_cashmov_business_register ON cashMovements(business_id, cashRegisterId);
CREATE INDEX IF NOT EXISTS idx_cashmov_business_date ON cashMovements(business_id, date);
CREATE INDEX IF NOT EXISTS idx_stockmov_business_product ON stockMovements(business_id, productId);
CREATE INDEX IF NOT EXISTS idx_stockmov_business_date ON stockMovements(business_id, date);
CREATE INDEX IF NOT EXISTS idx_stockmov_business_type ON stockMovements(business_id, type);
CREATE INDEX IF NOT EXISTS idx_supplierpay_business ON supplierPayments(business_id, supplierId);
CREATE INDEX IF NOT EXISTS idx_supplierpay_purchase ON supplierPayments(business_id, purchaseId);
CREATE INDEX IF NOT EXISTS idx_products_business_name ON products(business_id, name);
CREATE INDEX IF NOT EXISTS idx_products_business_barcode ON products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_cashregisters_business_status ON cashRegisters(business_id, status);
CREATE TABLE IF NOT EXISTS productCostHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER,
    oldCost REAL,
    newCost REAL,
    reason TEXT,
    referenceId INTEGER,
    currentPrice REAL,
    date TEXT,
    business_id INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cost_history_product ON productCostHistory(productId);
CREATE INDEX IF NOT EXISTS idx_cost_history_date ON productCostHistory(date);

-- Índices de rendimiento para Notas de Crédito (devoluciones)
CREATE INDEX IF NOT EXISTS idx_saleReturns_business_date ON saleReturns(business_id, date);
CREATE INDEX IF NOT EXISTS idx_saleReturns_saleId ON saleReturns(saleId);

-- Registro de Sesiones de Pago de Deuda
CREATE TABLE IF NOT EXISTS debtPaymentSessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId     TEXT NOT NULL,
    date           TEXT NOT NULL,
    totalPaid      REAL DEFAULT 0,
    totalDebt      REAL DEFAULT 0,
    discount       REAL DEFAULT 0,
    methods        TEXT,
    salesData      TEXT,
    notes          TEXT,
    cashRegisterId INTEGER,
    business_id    INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_debt_payment_sessions_customer ON debtPaymentSessions(customerId);
CREATE INDEX IF NOT EXISTS idx_debt_payment_sessions_business ON debtPaymentSessions(business_id);


