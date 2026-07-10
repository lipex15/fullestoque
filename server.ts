/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { AppSettings, NotificationItem, SystemStatus, LiveLog, DEFAULT_SETTINGS, NotificationPlatform, NotificationPriority, NotificationCategory, type SubscriptionPlatform, type SubscriptionRecord, type SubscriptionSummary } from "./src/types.js";
import { initDatabase, dbRun, dbAll, dbGet, getStockSummary, closeDatabase, exportDatabaseSnapshotBase64 } from "./database.js";
import cors from "cors";
import multer from "multer";

// Ensure Node ESM/CJS dual compatibility
import { fileURLToPath } from "url";
const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath((import.meta as any).url || 'file://' + process.cwd());
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const SECRET_KEY = "global_stock_deathzin_offline_master_secret_key_v1";

function getHWID() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const mem = os.totalmem().toString();
  const host = os.hostname();
  const raw = `${cpuModel}-${mem}-${host}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

function checkLicenseStatus() {
  const license = dbGet("SELECT * FROM app_license WHERE id = 1");
  const currentHwid = getHWID();

  if (!license) return { status: 'unlicensed', hwid: currentHwid };
  if (license.hardware_hash !== currentHwid) return { status: 'unlicensed', reason: 'hwid_mismatch', hwid: currentHwid };

  try {
    const rawKey = license.key_payload;
    const [dataBuffer, signature] = rawKey.split('.');

    // Verify signature
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(dataBuffer);
    const expectedSig = hmac.digest('hex');

    if (signature !== expectedSig) return { status: 'unlicensed', reason: 'invalid_signature', hwid: currentHwid };

    const payload = JSON.parse(Buffer.from(dataBuffer, 'base64').toString('utf8'));
    if (payload.type === 'duration') {
      if (Date.now() > payload.expiresAt) {
        return { status: 'expired', hwid: currentHwid };
      }
    }

    return { status: 'licensed', payload, hwid: currentHwid };
  } catch (e) {
    return { status: 'unlicensed', reason: 'corrupted', hwid: currentHwid };
  }
}

// License Gatekeeper Middleware
app.use('/api', (req, res, next) => {
  // Allow open passage for the license checking/activation endpoints
  if (req.path === '/system/license' || req.path === '/system/license/activate' || req.path === '/local-image') {
    return next();
  }

  const status = checkLicenseStatus();
  if (status.status !== 'licensed') {
    return res.status(403).json({ error: 'unlicensed', detail: status });
  }
  next();
});

app.get('/api/system/license', (req, res) => {
  res.json(checkLicenseStatus());
});

app.post('/api/system/license/activate', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ success: false, message: 'Key is required' });

  // Clean potentially formatted key (GS-XXXX-XXXX...) to extract raw internal, wait, the user enters GS-XXX-XXX but the raw is huge.
  // CRITICAL FIX: The user will pass the RAW key string provided by the generator, not the shortened GS-XXX string because the GS-XXX string is just a hashed view.
  // In `keygen.cjs`, it prints "PAYLOAD RAW PARA O APP: xxxx". The user pastes the RAW payload.

  try {
    const rawKey = key.trim();
    const [dataBuffer, signature] = rawKey.split('.');

    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(dataBuffer);
    const expectedSig = hmac.digest('hex');

    if (signature !== expectedSig) {
      return res.status(400).json({ success: false, message: 'Invalid Signature' });
    }

    const payload = JSON.parse(Buffer.from(dataBuffer, 'base64').toString('utf8'));
    if (payload.type === 'duration' && Date.now() > payload.expiresAt) {
      return res.status(400).json({ success: false, message: 'Licença Expirada.' });
    }

    const currentHwid = getHWID();

    dbRun("INSERT OR REPLACE INTO app_license (id, key_payload, hardware_hash, activated_at) VALUES (1, ?, ?, ?)", [
      rawKey,
      currentHwid,
      new Date().toISOString()
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Formato de chave inválido ou corrompido' });
  }
});


// --- 1. DYNAMIC STORAGE PATHS ---
function getStorageFolder(): string {
  const isElectron = !!process.versions.electron || process.env.IS_ELECTRON === 'true';
  const defaultBaseDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  let defaultDir = path.join(defaultBaseDir, "Global Stock");

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

const SUBSCRIPTION_PLATFORMS: SubscriptionPlatform[] = ["ggmax", "gamemarket"];
const SUBSCRIPTION_DAY_MS = 24 * 60 * 60 * 1000;

function normalizeSubscriptionPlatform(value: any): SubscriptionPlatform {
  const platform = String(value || "").toLowerCase().trim();
  if (!SUBSCRIPTION_PLATFORMS.includes(platform as SubscriptionPlatform)) {
    throw new Error("Plataforma de assinatura invalida.");
  }
  return platform as SubscriptionPlatform;
}

function getSubscriptionPlatformName(platform: string) {
  return platform === "ggmax" ? "GGMAX" : platform === "gamemarket" ? "GameMarket" : platform;
}

function parseSubscriptionDate(value: any, fallback?: Date) {
  const raw = String(value || "").trim();
  const date = raw ? new Date(raw) : (fallback || new Date());
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data da assinatura invalida.");
  }
  return date;
}

function parseDurationDays(value: any, fallback = 30) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 3650) {
    throw new Error("Duracao da assinatura invalida.");
  }
  return parsed;
}

function calculateSubscriptionExpiration(startDate: Date, durationDays: number) {
  return new Date(startDate.getTime() + durationDays * SUBSCRIPTION_DAY_MS);
}

function mapSubscription(row: any): SubscriptionRecord {
  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();
  const isExpiredByDate = Number.isFinite(expiresAt) && expiresAt <= now;
  const status = row.status || "active";
  const computedStatus = status === "active" && isExpiredByDate ? "expired" : status;
  const daysLeft = Number.isFinite(expiresAt) ? Math.ceil((expiresAt - now) / SUBSCRIPTION_DAY_MS) : 0;

  return {
    id: row.id,
    platform: row.platform,
    customerName: row.customer_name,
    chatLink: row.chat_link,
    productName: row.product_name || "Xbox Game Pass Ultimate 30 dias",
    purchaseDate: row.purchase_date,
    startDate: row.start_date,
    durationDays: Number(row.duration_days || 30),
    expiresAt: row.expires_at,
    status,
    computedStatus,
    notes: row.notes,
    alert3dSent: !!row.alert_3d_sent,
    alert1dSent: !!row.alert_1d_sent,
    alertDueSent: !!row.alert_due_sent,
    renewalCount: Number(row.renewal_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    daysLeft,
  };
}

function getSubscriptions(platform?: SubscriptionPlatform): SubscriptionRecord[] {
  const rows = platform
    ? dbAll("SELECT * FROM subscriptions WHERE platform = ? ORDER BY expires_at ASC, created_at DESC", [platform])
    : dbAll("SELECT * FROM subscriptions ORDER BY platform ASC, expires_at ASC, created_at DESC");
  return rows.map(mapSubscription);
}

function getSubscriptionSummary(platform?: SubscriptionPlatform): SubscriptionSummary {
  const subscriptions = getSubscriptions(platform);
  return subscriptions.reduce<SubscriptionSummary>((summary, subscription) => {
    summary.total += 1;
    if (subscription.computedStatus === "active") {
      summary.active += 1;
      if (subscription.daysLeft >= 0 && subscription.daysLeft <= 3) {
        summary.expiringSoon += 1;
      }
    } else if (subscription.computedStatus === "expired") {
      summary.expired += 1;
    } else if (subscription.computedStatus === "canceled") {
      summary.canceled += 1;
    }
    return summary;
  }, { total: 0, active: 0, expiringSoon: 0, expired: 0, canceled: 0 });
}

function broadcastSubscriptionsRefresh(platform?: SubscriptionPlatform) {
  broadcastEvent("subscriptions_refresh", {
    platform,
    subscriptions: getSubscriptions(platform),
    summary: getSubscriptionSummary(platform),
  });
}

function sendSubscriptionAlert(subscriptionRow: any, stage: "3d" | "1d" | "due") {
  const subscription = mapSubscription(subscriptionRow);
  const platformName = getSubscriptionPlatformName(subscription.platform);
  const stageTitle = stage === "3d"
    ? "vence em ate 3 dias"
    : stage === "1d"
      ? "vence em ate 24 horas"
      : "venceu";

  broadcastEvent("subscription_alert", {
    id: subscription.id,
    platform: subscription.platform,
    platformName,
    customerName: subscription.customerName,
    productName: subscription.productName,
    chatLink: subscription.chatLink,
    expiresAt: subscription.expiresAt,
    stage,
    stageTitle,
  });
  broadcastSubscriptionsRefresh(subscription.platform);
  addLog("sistema", "warn", `ASSINATURA ${platformName}: ${subscription.customerName} ${stageTitle}.`);
}

function startSubscriptionChecker() {
  setInterval(async () => {
    try {
      const now = Date.now();
      const rows = dbAll("SELECT * FROM subscriptions WHERE status = 'active'");

      for (const subscription of rows) {
        const expiresAt = new Date(subscription.expires_at).getTime();
        if (!Number.isFinite(expiresAt)) continue;

        const msUntilExpiry = expiresAt - now;
        const updatedAt = new Date().toISOString();

        if (msUntilExpiry <= 0 && !subscription.alert_due_sent) {
          dbRun(
            "UPDATE subscriptions SET alert_due_sent = 1, status = 'expired', updated_at = ? WHERE id = ?",
            [updatedAt, subscription.id]
          );
          sendSubscriptionAlert({ ...subscription, status: "expired", alert_due_sent: 1, updated_at: updatedAt }, "due");
        } else if (msUntilExpiry <= SUBSCRIPTION_DAY_MS && !subscription.alert_1d_sent) {
          dbRun("UPDATE subscriptions SET alert_1d_sent = 1, updated_at = ? WHERE id = ?", [updatedAt, subscription.id]);
          sendSubscriptionAlert({ ...subscription, alert_1d_sent: 1, updated_at: updatedAt }, "1d");
        } else if (msUntilExpiry <= 3 * SUBSCRIPTION_DAY_MS && !subscription.alert_3d_sent) {
          dbRun("UPDATE subscriptions SET alert_3d_sent = 1, updated_at = ? WHERE id = ?", [updatedAt, subscription.id]);
          sendSubscriptionAlert({ ...subscription, alert_3d_sent: 1, updated_at: updatedAt }, "3d");
        }
      }
    } catch (err: any) {
      console.error("[Subscriptions] Erro no checker:", err);
    }
  }, 60000);
}

// Receive IPC messages from Electron main process (autoUpdater)
process.on('message', (msg: any) => {
  if (msg && msg.type === 'updater_state') {
    broadcastEvent('updater_state', msg.data);
  }
});

// Webhooks removed

startSubscriptionChecker();

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

// Subscription management for recurring Game Pass sales
app.get("/api/subscriptions", (req, res) => {
  try {
    const platform = req.query.platform ? normalizeSubscriptionPlatform(req.query.platform) : undefined;
    res.json({
      subscriptions: getSubscriptions(platform),
      summary: getSubscriptionSummary(platform),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/subscriptions", (req, res) => {
  try {
    const platform = normalizeSubscriptionPlatform(req.body.platform);
    const customerName = String(req.body.customerName || "").trim();
    if (!customerName) {
      return res.status(400).json({ error: "Informe o nome do cliente." });
    }

    const productName = String(req.body.productName || "Xbox Game Pass Ultimate 30 dias").trim();
    const purchaseDate = parseSubscriptionDate(req.body.purchaseDate);
    const startDate = parseSubscriptionDate(req.body.startDate, purchaseDate);
    const durationDays = parseDurationDays(req.body.durationDays, 30);
    const expiresAt = calculateSubscriptionExpiration(startDate, durationDays);
    const nowIso = new Date().toISOString();
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    dbRun(
      `INSERT INTO subscriptions (
        id, platform, customer_name, chat_link, product_name, purchase_date, start_date,
        duration_days, expires_at, status, notes, alert_3d_sent, alert_1d_sent, alert_due_sent,
        renewal_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        platform,
        customerName,
        String(req.body.chatLink || "").trim() || null,
        productName,
        purchaseDate.toISOString(),
        startDate.toISOString(),
        durationDays,
        expiresAt.toISOString(),
        "active",
        String(req.body.notes || "").trim() || null,
        0,
        0,
        0,
        0,
        nowIso,
        nowIso,
      ]
    );

    addLog("sistema", "success", `Assinatura ${getSubscriptionPlatformName(platform)} cadastrada para ${customerName}.`);
    broadcastSubscriptionsRefresh(platform);
    res.json({ success: true, subscriptions: getSubscriptions(platform), summary: getSubscriptionSummary(platform) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/subscriptions/:id", (req, res) => {
  try {
    const { id } = req.params;
    const current = dbGet("SELECT * FROM subscriptions WHERE id = ?", [id]) as any;
    if (!current) {
      return res.status(404).json({ error: "Assinatura nao encontrada." });
    }

    const platform = normalizeSubscriptionPlatform(req.body.platform || current.platform);
    const customerName = String(req.body.customerName || "").trim();
    if (!customerName) {
      return res.status(400).json({ error: "Informe o nome do cliente." });
    }

    const productName = String(req.body.productName || "Xbox Game Pass Ultimate 30 dias").trim();
    const purchaseDate = parseSubscriptionDate(req.body.purchaseDate, new Date(current.purchase_date));
    const startDate = parseSubscriptionDate(req.body.startDate, new Date(current.start_date));
    const durationDays = parseDurationDays(req.body.durationDays, current.duration_days || 30);
    const expiresAt = calculateSubscriptionExpiration(startDate, durationDays);
    const updatedAt = new Date().toISOString();
    const scheduleChanged =
      purchaseDate.toISOString() !== current.purchase_date ||
      startDate.toISOString() !== current.start_date ||
      durationDays !== Number(current.duration_days || 30) ||
      expiresAt.toISOString() !== current.expires_at;

    dbRun(
      `UPDATE subscriptions
       SET platform = ?, customer_name = ?, chat_link = ?, product_name = ?, purchase_date = ?,
           start_date = ?, duration_days = ?, expires_at = ?, notes = ?,
           alert_3d_sent = ?, alert_1d_sent = ?, alert_due_sent = ?, updated_at = ?
       WHERE id = ?`,
      [
        platform,
        customerName,
        String(req.body.chatLink || "").trim() || null,
        productName,
        purchaseDate.toISOString(),
        startDate.toISOString(),
        durationDays,
        expiresAt.toISOString(),
        String(req.body.notes || "").trim() || null,
        scheduleChanged ? 0 : current.alert_3d_sent,
        scheduleChanged ? 0 : current.alert_1d_sent,
        scheduleChanged ? 0 : current.alert_due_sent,
        updatedAt,
        id,
      ]
    );

    addLog("sistema", "success", `Assinatura de ${customerName} atualizada.`);
    broadcastSubscriptionsRefresh(platform);
    res.json({ success: true, subscriptions: getSubscriptions(platform), summary: getSubscriptionSummary(platform) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/subscriptions/:id/renew", (req, res) => {
  try {
    const { id } = req.params;
    const current = dbGet("SELECT * FROM subscriptions WHERE id = ?", [id]) as any;
    if (!current) {
      return res.status(404).json({ error: "Assinatura nao encontrada." });
    }

    const startDate = parseSubscriptionDate(req.body.startDate);
    const durationDays = parseDurationDays(req.body.durationDays, current.duration_days || 30);
    const expiresAt = calculateSubscriptionExpiration(startDate, durationDays);
    const renewedAt = new Date().toISOString();
    const renewalId = `ren_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    dbRun(
      `INSERT INTO subscription_renewals (
        id, subscription_id, previous_start_date, previous_expires_at,
        new_start_date, new_expires_at, renewed_at, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        renewalId,
        id,
        current.start_date,
        current.expires_at,
        startDate.toISOString(),
        expiresAt.toISOString(),
        renewedAt,
        String(req.body.note || "").trim() || null,
      ]
    );

    dbRun(
      `UPDATE subscriptions
       SET start_date = ?, duration_days = ?, expires_at = ?, status = 'active',
           alert_3d_sent = 0, alert_1d_sent = 0, alert_due_sent = 0,
           renewal_count = COALESCE(renewal_count, 0) + 1, updated_at = ?
       WHERE id = ?`,
      [startDate.toISOString(), durationDays, expiresAt.toISOString(), renewedAt, id]
    );

    const platform = normalizeSubscriptionPlatform(current.platform);
    addLog("sistema", "success", `Assinatura de ${current.customer_name} renovada por ${durationDays} dias.`);
    broadcastSubscriptionsRefresh(platform);
    res.json({ success: true, subscriptions: getSubscriptions(platform), summary: getSubscriptionSummary(platform) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/subscriptions/:id/cancel", (req, res) => {
  try {
    const { id } = req.params;
    const current = dbGet("SELECT * FROM subscriptions WHERE id = ?", [id]) as any;
    if (!current) {
      return res.status(404).json({ error: "Assinatura nao encontrada." });
    }

    const updatedAt = new Date().toISOString();
    dbRun("UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE id = ?", [updatedAt, id]);
    const platform = normalizeSubscriptionPlatform(current.platform);
    addLog("sistema", "warn", `Assinatura de ${current.customer_name} cancelada.`);
    broadcastSubscriptionsRefresh(platform);
    res.json({ success: true, subscriptions: getSubscriptions(platform), summary: getSubscriptionSummary(platform) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/subscriptions/:id", (req, res) => {
  try {
    const { id } = req.params;
    const current = dbGet("SELECT * FROM subscriptions WHERE id = ?", [id]) as any;
    if (!current) {
      return res.status(404).json({ error: "Assinatura nao encontrada." });
    }

    dbRun("DELETE FROM subscription_renewals WHERE subscription_id = ?", [id]);
    dbRun("DELETE FROM subscriptions WHERE id = ?", [id]);
    const platform = normalizeSubscriptionPlatform(current.platform);
    addLog("sistema", "warn", `Assinatura de ${current.customer_name} excluida.`);
    broadcastSubscriptionsRefresh(platform);
    res.json({ success: true, subscriptions: getSubscriptions(platform), summary: getSubscriptionSummary(platform) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

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
app.get("/api/storage/backup/export", async (req, res) => {
  try {
    const dbBase64 = await exportDatabaseSnapshotBase64();

    const pack = {
      version: "1.1",
      timestamp: new Date().toISOString(),
      settings,
      notifications,
      dbBase64
    };

    res.setHeader("Content-Disposition", `attachment; filename=global-stock-backup-${Date.now()}.dsb`);
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
    for (const file of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { force: true });
      }
    }
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
