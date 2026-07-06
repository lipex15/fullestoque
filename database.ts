/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real SQLite database module using better-sqlite3.
 * Replaces the old JSON-file-based fake DB layer.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { StockProduct } from "./src/types.js";

let db: Database.Database;

// --- INITIALIZATION ---

export function initDatabase(storageDir: string): void {
  const dbPath = path.join(storageDir, "stock.db");
  console.log(`[SQLite] Abrindo banco de dados: ${dbPath}`);

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance and crash safety
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT DEFAULT 'todas',
      category TEXT DEFAULT 'Outros',
      price REAL DEFAULT 0,
      minWarning INTEGER DEFAULT 2
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      content TEXT DEFAULT '',
      status TEXT DEFAULT 'disponivel',
      sold_to TEXT,
      sold_at TEXT,
      notification_id TEXT,
      login TEXT,
      senha TEXT,
      email TEXT,
      senhaEmail TEXT,
      observacao TEXT,
      dataNascimento TEXT,
      perguntaSecreta TEXT,
      respostaSecreta TEXT,
      paisCadastro TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
  // Safe column migrations — silently ignored if column already exists
  const safeAlter = (sql: string) => {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  };
  safeAlter("ALTER TABLE items ADD COLUMN warranty_expires_at TEXT");
  safeAlter("ALTER TABLE items ADD COLUMN warranty_alert_sent INTEGER DEFAULT 0");

  // Try to migrate from old stock.json if it exists
  migrateFromJson(storageDir);

  // Auto-seed if empty -> Disabled to prevent dummy test products appearing.
  const countResult = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;

  console.log(`[SQLite] Banco inicializado com sucesso. Produtos: ${countResult.count}`);
}

// --- MIGRATION FROM OLD JSON ---

function migrateFromJson(storageDir: string): void {
  const jsonPath = path.join(storageDir, "stock.json");
  if (!fs.existsSync(jsonPath)) return;

  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
      // Empty or invalid JSON, skip migration
      return;
    }

    // Check if we already have data (avoid double-import)
    const existingCount = (db.prepare("SELECT COUNT(*) as count FROM products").get() as any).count;
    if (existingCount > 0) return;

    console.log(`[SQLite] Migrando ${data.products.length} produtos e ${data.items?.length || 0} itens do stock.json...`);

    const insertProduct = db.prepare(`
      INSERT OR IGNORE INTO products (id, name, platform, category, price, minWarning)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT OR IGNORE INTO items (id, product_id, content, status, sold_to, sold_at, notification_id, login, senha, email, senhaEmail, observacao, dataNascimento, perguntaSecreta, respostaSecreta, paisCadastro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const migrate = db.transaction(() => {
      for (const p of data.products) {
        insertProduct.run(
          p.id,
          p.name || "Produto",
          p.platform || "todas",
          p.category || "Outros",
          p.price || 0,
          p.minWarning || 2
        );
      }

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          insertItem.run(
            item.id,
            item.product_id,
            item.content || "",
            item.status || "disponivel",
            item.sold_to || null,
            item.sold_at || null,
            item.notification_id || null,
            item.login || null,
            item.senha || null,
            item.email || null,
            item.senhaEmail || null,
            item.observacao || null,
            item.dataNascimento || null,
            item.perguntaSecreta || null,
            item.respostaSecreta || null,
            item.paisCadastro || null
          );
        }
      }
    });

    migrate();

    // Rename old file as backup
    const migratedPath = path.join(storageDir, "stock.json.migrated");
    fs.renameSync(jsonPath, migratedPath);
    console.log(`[SQLite] Migração concluída! stock.json renomeado para stock.json.migrated`);
  } catch (err) {
    console.error("[SQLite] Erro na migração do stock.json:", err);
  }
}

// --- SEED DATA ---

function seedDatabase(): void {
  console.log("[SQLite] Semeando banco com produtos e contas de teste...");

  const initialProducts = [
    {
      id: "stock_1",
      name: "Gift Card Google Play R$ 50",
      platform: "todas",
      category: "Keys/Gift Cards",
      price: 45.00,
      minWarning: 3,
      items: ["GF-PLAY-XYZ123-ABCD", "GF-PLAY-WXYZ78-90AB", "GF-PLAY-KKLL99-ZZYY"]
    },
    {
      id: "stock_2",
      name: "Conta League of Legends Level 30",
      platform: "ggmax",
      category: "Contas",
      price: 25.00,
      minWarning: 1,
      items: ["lol_acc_smurf1:pass1234", "lol_acc_smurf2:securepass99"]
    },
    {
      id: "stock_3",
      name: "1.000.000 Coins FIFA 24",
      platform: "gamemarket",
      category: "Moedas",
      price: 80.00,
      minWarning: 2,
      items: ["Aguardando transferência via chat - Chamar comprador"]
    }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, platform, category, price, minWarning)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO items (id, product_id, content, status)
    VALUES (?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    for (const p of initialProducts) {
      insertProduct.run(p.id, p.name, p.platform, p.category, p.price, p.minWarning);

      p.items.forEach((itemContent, idx) => {
        const itemId = `item_${p.id}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
        insertItem.run(itemId, p.id, itemContent, "disponivel");
      });
    }
  });

  seed();
}

// --- QUERY HELPERS (same interface as the old fake DB) ---

export function dbRun(sql: string, params: any[] = []): { lastID: any; changes: number } {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return { lastID: result.lastInsertRowid, changes: result.changes };
}

export function dbAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

export function dbGet(sql: string, params: any[] = []): any {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

// --- STOCK SUMMARY (typed, used by API endpoints) ---

export function getStockSummary(): StockProduct[] {
  const products = dbAll("SELECT * FROM products ORDER BY name ASC");
  const summary: StockProduct[] = [];

  const countStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'disponivel' THEN 1 ELSE 0 END) as availableCount,
      COUNT(*) as totalCount,
      SUM(CASE WHEN status = 'disponivel' AND warranty_expires_at IS NOT NULL AND warranty_expires_at > ? THEN 1 ELSE 0 END) as activeWarrantyCount
    FROM items WHERE product_id = ?
  `);

  const now = new Date().toISOString();
  for (const p of products) {
    const counts = countStmt.get(now, p.id) as any;
    summary.push({
      id: p.id,
      name: p.name,
      platform: p.platform,
      category: p.category,
      price: p.price,
      minWarning: p.minWarning,
      availableCount: counts ? (counts.availableCount || 0) : 0,
      totalCount: counts ? (counts.totalCount || 0) : 0,
      activeWarrantyCount: counts ? (counts.activeWarrantyCount || 0) : 0
    });
  }

  return summary;
}

// --- CLEANUP ---

export function closeDatabase(): void {
  if (db) {
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.exec("VACUUM");
      console.log("[SQLite] Limpeza de WAL e VACUUM executada com sucesso.");
    } catch (err: any) {
      console.error("[SQLite] Erro ao executar WAL checkpoint / VACUUM:", err.message);
    }
    try {
      db.close();
      console.log("[SQLite] Banco de dados fechado com segurança.");
    } catch (err) {
      console.error("[SQLite] Erro ao fechar banco:", err);
    }
  }
}
