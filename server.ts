/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { AppSettings, NotificationItem, SystemStatus, LiveLog, DEFAULT_SETTINGS, NotificationPlatform, NotificationPriority, NotificationCategory } from "./src/types.js";
import { initDatabase, dbRun, dbAll, dbGet, getStockSummary, closeDatabase } from "./database.js";
import cors from "cors";
import multer from "multer";

// Ensure Node ESM/CJS dual compatibility
import { fileURLToPath } from "url";
const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath((import.meta as any).url || 'file://' + process.cwd());
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

const app = express();
const PORT = 3000;



app.get('/api/local-image', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).send('No path provided');
  }
  // Remove file:/// if present
  const cleanPath = filePath.replace(/^file:\/\/\/?/, '');
  res.sendFile(cleanPath, (err) => {
    if (err) {
      console.error('[SISTEMA] [ERRO] Falha ao carregar BG local:', err);
      // fallback to 404 transparent
      res.status(404).end();
    }
  });
});

app.use(cors());
app.use(express.json());

// --- 1. DYNAMIC STORAGE PATHS ---
function getStorageFolder(): string {
  const isElectron = !!process.versions.electron || process.env.IS_ELECTRON === 'true';
  const defaultBaseDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  let defaultDir = path.join(defaultBaseDir, "deathstuffs-brain");

  // Keep compatibility with legacy SellerHub naming
  const oldDir = path.join(defaultBaseDir, "SellerHub");
  if (!fs.existsSync(defaultDir) && fs.existsSync(oldDir)) {
    try {
      fs.renameSync(oldDir, defaultDir);
    } catch (e) {
      defaultDir = oldDir;
    }
  }

  if (isElectron) {
    const redirectFile = path.join(defaultDir, "storage_path.txt");
    if (fs.existsSync(redirectFile)) {
      try {
        const customPath = fs.readFileSync(redirectFile, "utf8").trim();
        if (customPath) {
          if (!fs.existsSync(customPath)) {
            fs.mkdirSync(customPath, { recursive: true });
          }
          return customPath;
        }
      } catch (e) {
        console.error("[Storage] Falha ao ler ou criar pasta indicada em storage_path.txt:", e);
      }
    }

    if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
    return defaultDir;
  } else {
    // Local container data path
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}

let STORAGE_DIR = getStorageFolder();
let SETTINGS_FILE = path.join(STORAGE_DIR, "settings.json");
let NOTIFICATIONS_FILE = path.join(STORAGE_DIR, "notifications.json");
let NOTIFICATIONS_BACKUP = path.join(STORAGE_DIR, "notifications.json.bak");



// Initialize default empty databases if not present
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
}
if (!fs.existsSync(NOTIFICATIONS_FILE)) {
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2), "utf8");
}

// Load configurations and notifications
function loadSettings(): AppSettings {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(data);
    return {
      general: { ...DEFAULT_SETTINGS.general, ...parsed.general },
    };
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

function loadNotifications(): NotificationItem[] {
  try {
    const data = fs.readFileSync(NOTIFICATIONS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    // Try restoring backup
    if (fs.existsSync(NOTIFICATIONS_BACKUP)) {
      try {
        const bak = fs.readFileSync(NOTIFICATIONS_BACKUP, "utf8");
        return JSON.parse(bak);
      } catch (e) {
        return [];
      }
    }
    return [];
  }
}

function saveNotifications(notifications: NotificationItem[]) {
  try {
    // Write backup first
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      fs.copyFileSync(NOTIFICATIONS_FILE, NOTIFICATIONS_BACKUP);
    }
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao salvar notificações:", err);
  }
}

// --- 1.5. REAL SQLITE DATABASE INITIALIZATION ---
initDatabase(STORAGE_DIR);

// --- 2. GLOBAL APP STATE ---
let settings = loadSettings();
let notifications = loadNotifications();
let sseClients: express.Response[] = [];
let logs: LiveLog[] = [];

// Helper to push a system log
function addLog(source: 'sistema' | 'discord' | 'whatsapp', type: 'info' | 'success' | 'warn' | 'error', message: string) {
  // Mirror to console so standard streams capture this in production error.log
  const consoleMsg = `[${source.toUpperCase()}] [${type.toUpperCase()}] ${message}`;
  if (type === 'error') {
    console.error(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  const log: LiveLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    source,
    type,
    message,
  };
  logs.unshift(log);
  if (logs.length > 300) logs.pop(); // Keep log size sane
  broadcastEvent("log", log);
}

// Broadcast JSON structures to all listening React tabs
function broadcastEvent(type: string, data: any) {
  const messageStr = `data: ${JSON.stringify({ type, data })}\n\n`;
  sseClients.forEach((client) => client.write(messageStr));
}

// Receive IPC messages from Electron main process (autoUpdater)
process.on('message', (msg: any) => {
  if (msg && msg.type === 'updater_state') {
    broadcastEvent('updater_state', msg.data);
  }
});

// Webhooks removed


// --- 6. EXPRESS API ENDPOINTS ---

// Server SSE channel mapping
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  sseClients.push(res);
  addLog("sistema", "info", "Painel conectado ao fluxo de eventos em tempo real.");

  // Send initial load details
  res.write(`data: ${JSON.stringify({ type: "init_logs", data: logs.slice(0, 50) })}\n\n`);
    
  req.on("close", () => {
    sseClients = sseClients.filter((client) => client !== res);
    addLog("sistema", "info", "Painel desconectado do fluxo de eventos.");
  });
});

// App Settings CRUD
app.get("/api/settings", (req, res) => {
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  try {
    const oldSettings = { ...settings };
    settings = { ...settings, ...req.body };
    saveSettings(settings);

    addLog("sistema", "success", "Configurações atualizadas e salvas no disco.");

    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications removed

// --- STORAGE & BACKUP MANAGEMENT ENDPOINTS ---

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Get current storage path
app.get("/api/storage/info", (req, res) => {
  res.json({ currentPath: STORAGE_DIR });
});

// Export database backup as single base64 JSON downloadable packet
app.get("/api/storage/backup/export", (req, res) => {
  try {
    const dbFile = path.join(STORAGE_DIR, "stock.db");
    let dbBase64 = "";
    if (fs.existsSync(dbFile)) {
      dbBase64 = fs.readFileSync(dbFile).toString("base64");
    }

    const pack = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      settings,
      notifications,
      dbBase64
    };

    res.setHeader("Content-Disposition", `attachment; filename=deathStuffs-backup-${Date.now()}.dsb`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(pack, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import backup JSON packet directly and restore local database/configs
app.post("/api/storage/backup/import", (req, res) => {
  try {
    const { settings: backupSettings, notifications: backupNotifications, dbBase64 } = req.body;
    if (!dbBase64) {
      return res.status(400).json({ error: "Backup inválido ou corrompido (banco ausente)." });
    }

    addLog("sistema", "info", "Iniciando restauração de backup local...");

    // 1. Fechar o banco sqlite
    closeDatabase();

    // 2. Gravar os arquivos físicos convertidos de volta
    const dbFile = path.join(STORAGE_DIR, "stock.db");
    fs.writeFileSync(dbFile, Buffer.from(dbBase64, "base64"));

    if (backupSettings) {
      settings = { ...DEFAULT_SETTINGS, ...backupSettings };
      saveSettings(settings);
    }

    // 3. Re-iniciar banco
    initDatabase(STORAGE_DIR);
    settings = loadSettings();

    addLog("sistema", "success", "Backup restaurado com sucesso! Serviços reiniciados.");

    res.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao importar backup:", err);
    res.status(500).json({ error: err.message });
  }
});

// Migrate database storage folder to a new drive directory
app.post("/api/storage/migrate", (req, res) => {
  try {
    const { newPath } = req.body;
    if (!newPath) {
      return res.status(400).json({ error: "Caminho de destino não especificado." });
    }

    const targetPath = path.resolve(newPath.trim());
    if (targetPath === STORAGE_DIR) {
      return res.status(400).json({ error: "O destino é idêntico à pasta de dados atual." });
    }

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    addLog("sistema", "info", `Iniciando cópia e migração da pasta de dados para: ${targetPath}`);

    // 1. Fechar banco
    closeDatabase();

    // Aguardar breves milissegundos para liberação dos locks do Windows
    setTimeout(() => {
      try {
        // 2. Copiar os arquivos principais
        const filesToCopy = ["stock.db", "settings.json", "notifications.json", "stock.db-wal", "stock.db-shm"];
        for (const file of filesToCopy) {
          const src = path.join(STORAGE_DIR, file);
          const dest = path.join(targetPath, file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          }
        }

        // 3. Copiar pasta do whatsapp recursivamente
        const srcWp = path.join(STORAGE_DIR, "whatsapp-session");
        const destWp = path.join(targetPath, "whatsapp-session");
        if (fs.existsSync(srcWp)) {
          copyRecursiveSync(srcWp, destWp);
        }

        // 4. Salvar ponteiro de redirecionamento no AppData padrão
        const defaultBaseDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
        const defaultDir = path.join(defaultBaseDir, "deathstuffs-brain");
        if (!fs.existsSync(defaultDir)) {
          fs.mkdirSync(defaultDir, { recursive: true });
        }
        const redirectFile = path.join(defaultDir, "storage_path.txt");
        fs.writeFileSync(redirectFile, targetPath, "utf8");

        // 5. Atualizar variáveis de pasta locais
        STORAGE_DIR = targetPath;
        SETTINGS_FILE = path.join(STORAGE_DIR, "settings.json");

        // 6. Re-abrir banco e recarregar status
        initDatabase(STORAGE_DIR);
        settings = loadSettings();

        addLog("sistema", "success", `Pasta de dados migrada com sucesso! Novo caminho ativo: ${STORAGE_DIR}`);

        res.json({ success: true, currentPath: STORAGE_DIR });
      } catch (err: any) {
        console.error("Erro ao copiar arquivos de dados na migração:", err);
        // Fallback: restaurar banco no local original
        initDatabase(STORAGE_DIR);
        res.status(500).json({ error: `Erro na transferência física de dados: ${err.message}` });
      }
    }, 1500);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- STOCK & INVENTORY MANAGEMENT API (SQLITE BACKED) ---

// Get stock summary (all products with counts)
app.get("/api/stock/products", async (req, res) => {
  try {
    const products = await getStockSummary();
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new product to stock
app.post("/api/stock/products", async (req, res) => {
  try {
    const { name, platform, category, price, minWarning, initialItems } = req.body;
    const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    await dbRun(
      "INSERT INTO products (id, name, platform, category, price, minWarning) VALUES (?, ?, ?, ?, ?, ?)",
      [productId, name || "Novo Produto", platform || "todas", category || "Outros", parseFloat(price) || 0, parseInt(minWarning) || 2]
    );

    // Process raw items if present
    if (initialItems && typeof initialItems === "string") {
      const itemLines = initialItems.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      for (const line of itemLines) {
        const itemId = `item_${productId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await dbRun(
          "INSERT INTO items (id, product_id, content, status) VALUES (?, ?, ?, ?)",
          [itemId, productId, line, 'disponivel']
        );
      }
      addLog("sistema", "success", `Cadastrado produto "${name}" com ${itemLines.length} itens.`);
    } else {
      addLog("sistema", "success", `Cadastrado produto "${name}" sem itens iniciais.`);
    }

    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true, productId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a product's configuration
app.put("/api/stock/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, platform, category, price, minWarning } = req.body;

    await dbRun(
      "UPDATE products SET name = ?, platform = ?, category = ?, price = ?, minWarning = ? WHERE id = ?",
      [name, platform, category, parseFloat(price) || 0, parseInt(minWarning) || 2, id]
    );

    addLog("sistema", "info", `Produto "${name}" atualizado no estoque.`);
    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a product and its associated inventory items
app.delete("/api/stock/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch product name first for logging
    const product = await dbGet("SELECT name FROM products WHERE id = ?", [id]) as any;
    const productName = product ? product.name : "Desconhecido";

    await dbRun("DELETE FROM items WHERE product_id = ?", [id]);
    await dbRun("DELETE FROM products WHERE id = ?", [id]);

    addLog("sistema", "warn", `Produto "${productName}" e todos os seus itens removidos do estoque.`);

    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all items (accounts/keys) of a product
app.get("/api/stock/products/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const items = await dbAll(`
      SELECT *, 
             warranty_expires_at AS warrantyExpiresAt, 
             warranty_alert_sent AS warrantyAlertSent 
      FROM items 
      WHERE product_id = ? 
      ORDER BY status ASC, sold_at DESC
    `, [id]);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all active (unsold and not expired) warranty items
app.get("/api/stock/warranties/active", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const items = await dbAll(`
      SELECT items.*, products.name as productName, 
             items.warranty_expires_at AS warrantyExpiresAt, 
             items.warranty_alert_sent AS warrantyAlertSent
      FROM items
      JOIN products ON items.product_id = products.id
      WHERE items.warranty_expires_at IS NOT NULL
        AND items.warranty_expires_at > ?
        AND items.status = 'disponivel'
      ORDER BY items.warranty_expires_at ASC
    `, [now]);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk add or single structured add new items (accounts/keys) to a product
app.post("/api/stock/products/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const { rawItems, login, senha, email, senhaEmail, observacao, dataNascimento, perguntaSecreta, respostaSecreta, paisCadastro, warrantyHours } = req.body;

    // Compute warranty expiry timestamp if warrantyHours is provided
    const warrantyExpiresAt = warrantyHours && parseFloat(warrantyHours) > 0
      ? new Date(Date.now() + parseFloat(warrantyHours) * 60 * 60 * 1000).toISOString()
      : null;

    if (rawItems && typeof rawItems === "string") {
      const itemLines = rawItems.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      for (const line of itemLines) {
        const itemId = `item_${id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // Parse parts: login:senha:email:senhaEmail
        const parts = line.split(':');
        let loginVal = "";
        let senhaVal = "";
        let emailVal = "";
        let senhaEmailVal = "";

        if (parts.length >= 4) {
          loginVal = parts[0].trim();
          senhaVal = parts[1].trim();
          emailVal = parts[2].trim();
          senhaEmailVal = parts[3].trim();
        } else if (parts.length === 3) {
          loginVal = parts[0].trim();
          senhaVal = parts[1].trim();
          emailVal = parts[2].trim();
        } else if (parts.length === 2) {
          loginVal = parts[0].trim();
          senhaVal = parts[1].trim();
        } else {
          loginVal = line;
        }

        dbRun(
          `INSERT INTO items (id, product_id, content, status, login, senha, email, senhaEmail, warranty_expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, line, 'disponivel', loginVal, senhaVal, emailVal, senhaEmailVal, warrantyExpiresAt]
        );
      }

      const product = await dbGet("SELECT name FROM products WHERE id = ?", [id]) as any;
      addLog("sistema", "success", `Adicionado(s) ${itemLines.length} item(ns) de estoque para "${product?.name || 'Desconhecido'}"`);
    } else {
      // Single structured account item
      const itemId = `item_${id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      let content = `${login || ''}:${senha || ''}`;
      if (email) content += ` | Email: ${email}:${senhaEmail || ''}`;
      if (observacao) content += ` | Obs: ${observacao}`;

      dbRun(
        `INSERT INTO items (id, product_id, content, status, login, senha, email, senhaEmail, observacao, dataNascimento, perguntaSecreta, respostaSecreta, paisCadastro, warranty_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, id, content, 'disponivel', login || null, senha || null, email || null, senhaEmail || null, observacao || null, dataNascimento || null, perguntaSecreta || null, respostaSecreta || null, paisCadastro || null, warrantyExpiresAt]
      );

      const product = await dbGet("SELECT name FROM products WHERE id = ?", [id]) as any;
      if (warrantyExpiresAt) {
        addLog("sistema", "success", `Conta "${login || ''}" adicionada com garantia até ${new Date(warrantyExpiresAt).toLocaleString('pt-BR')} para "${product?.name || 'Desconhecido'}"`);
      } else {
        addLog("sistema", "success", `Adicionada conta "${login || ''}" no estoque para "${product?.name || 'Desconhecido'}"`);
      }
    }

    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a specific stock item (e.g. edit password or content)
app.put("/api/stock/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { content, status, sold_to, sold_at, notification_id } = req.body;

    await dbRun(
      "UPDATE items SET content = ?, status = ?, sold_to = ?, sold_at = ?, notification_id = ? WHERE id = ?",
      [content, status, sold_to, sold_at, notification_id, itemId]
    );

    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific stock item
app.delete("/api/stock/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    await dbRun("DELETE FROM items WHERE id = ?", [itemId]);

    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manually deliver or mark an available item of a product as sold/associated with a buyer
app.post("/api/stock/products/:productId/deliver-manual", async (req, res) => {
  try {
    const { productId } = req.params;
    const { notificationId, buyerName } = req.body;

    // Find first available item
    const item = await dbGet("SELECT * FROM items WHERE product_id = ? AND status = 'disponivel' ORDER BY rowid ASC", [productId]) as any;
    if (!item) {
      return res.status(400).json({ error: "Nenhum item disponível em estoque para este produto!" });
    }

    // Mark as sold
    await dbRun(
      "UPDATE items SET status = 'vendido', sold_to = ?, sold_at = ?, notification_id = ? WHERE id = ?",
      [buyerName || "Cliente Manual", new Date().toISOString(), notificationId || null, item.id]
    );

    const product = await dbGet("SELECT name FROM products WHERE id = ?", [productId]) as any;
    addLog("sistema", "success", `Item de "${product?.name}" resgatado/marcado como vendido manualmente para "${buyerName || 'Cliente Manual'}".`);

    // If notificationId is provided, update that notification notes!
    if (notificationId) {
      const notifIndex = notifications.findIndex(n => n.id === notificationId);
      if (notifIndex !== -1) {
        notifications[notifIndex].notes = `[ENTREGA MANUAL] Entregue do estoque: ${item.content}`;
        notifications[notifIndex].resolution = "resolvida";
        saveNotifications(notifications);
        broadcastEvent("notifications_refresh", notifications);
      }
    }

    const refreshed = await getStockSummary();
    broadcastEvent("stock_refresh", refreshed);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/system/updater-action", (req, res) => {
  const { action } = req.body;
  if (process.send) {
    process.send({ type: 'updater_action', action });
    res.json({ success: true, message: `Acionado comando: ${action}` });
  } else {
    res.json({ success: false, message: "Modo standalone (sem Electron IPC ativo)." });
  }
});

// Test Actions and Webhooks removed

// App System Metadata & directory locations
app.get("/api/status", (req, res) => {
  res.json({
    storagePath: STORAGE_DIR,
  });
});

// --- 7. VITE MIDDLEWARE CONFIG FOR DEVELOPMENT & PRODUCTION ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = _dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[deathstuffs brain Backend] Ativo na porta ${PORT}`);
    console.log(`[deathstuffs brain Backend] Diretório de dados: ${STORAGE_DIR}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

startServer();
