/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  ShieldCheck,
  Bot,
  Menu,
  X,
  Sun,
  Moon,
  CheckCircle,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

import { AppSettings, SystemStatus, DEFAULT_SETTINGS } from './types';
import SettingsPanel from './components/SettingsPanel';
import EstoquePanel from './components/EstoquePanel';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'config' | 'estoque'>('estoque');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Logo detection
  const [avatarUrl, setAvatarUrl] = useState<string>('/assets/logo.png');

  useEffect(() => {
    const img = new Image();
    img.src = '/assets/deathstuffs_logo.png';
    img.onload = () => setAvatarUrl('/assets/deathstuffs_logo.png');
    img.onerror = () => {
      const img2 = new Image();
      img2.src = '/assets/logo.png';
      img2.onload = () => setAvatarUrl('/assets/logo.png');
      img2.onerror = () => setAvatarUrl('svg');
    };
  }, []);

  // App State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    updater: { status: 'none', progress: 0 },
    storagePath: ''
  });

  const [soundMuted, setSoundMuted] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Warranty State
  const [activeWarrantyAlerts, setActiveWarrantyAlerts] = useState<any[]>([]);
  const [activeWarranties, setActiveWarranties] = useState<any[]>([]);
  const [forceWarrantyFilter, setForceWarrantyFilter] = useState(false);

  const [globalStockSearch, setGlobalStockSearch] = useState<string>('');

  const playEmergencySound = () => {
    if (soundMuted || !settings.general.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) { }
  };

  useEffect(() => {
    fetchSettings();
    fetchSystemStatus();
    fetchActiveWarranties();

    const handleStockRefresh = () => fetchActiveWarranties();
    window.addEventListener('stock_refresh', handleStockRefresh);

    const warrantyInterval = setInterval(() => {
      fetchActiveWarranties();
    }, 30000);

    const sseUrl = '/api/events';
    const sse = new EventSource(sseUrl);
    sseRef.current = sse;

    sse.addEventListener('message', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const { type, data } = payload;

        if (type === 'updater_state') {
          setSystemStatus((prev) => ({ ...prev, updater: data }));
        } else if (type === 'stock_refresh') {
          window.dispatchEvent(new Event('stock_refresh'));
        } else if (type === 'warranty_alert') {
          setActiveWarrantyAlerts(prev => {
            if (prev.find(a => a.itemId === data.itemId)) return prev;
            return [...prev, data];
          });
          playEmergencySound();
          fetchActiveWarranties();
          if (settings.general.browserAlerts && Notification.permission === 'granted') {
            new Notification(`GARANTIA EXPIRANDO: ${data.productName}`, {
              body: `A conta ${data.login} expirará em breve! Verifique no LZT.`,
              requireInteraction: true
            });
          }
        }
      } catch (err) {
        console.error('SSE parsing error:', err);
      }
    });

    sse.onerror = (err) => {
      console.error('SSE Error. Reconnecting...', err);
    };

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    return () => {
      clearInterval(warrantyInterval);
      window.removeEventListener('stock_refresh', handleStockRefresh);
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [settings.general.browserAlerts, soundMuted, settings.general.soundEnabled]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.general.theme === 'escuro') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.general.theme]);

  const fetchActiveWarranties = async () => {
    try {
      const res = await fetch('/api/stock/warranties/active');
      if (res.ok) {
        const data = await res.json();
        setActiveWarranties(data);
      }
    } catch (e) {
      console.error('Error fetching active warranties:', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setSystemStatus((prev) => ({ ...prev, ...data }));
    } catch (e) {
      console.error('Error fetching status:', e);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        fetchSystemStatus();
        return true;
      }
    } catch (e) {
      console.error('Error saving settings:', e);
    }
    return false;
  };

  const handleClearDatabase = async () => {
    if (confirm('Deseja limpar os dados do armazenamento local?')) {
      // Feature removed from active UI for Stock Manager. Included just to satisfy SettingsPanel stub if exists.
      console.log("Not applicable anymore.");
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Confirmar reset das configurações para os padrões originais de fábrica?')) {
      handleSaveSettings(DEFAULT_SETTINGS);
    }
  };

  return (
    <div
      className="min-h-screen font-sans antialiased text-slate-800 dark:text-slate-100 flex flex-col transition-colors relative"
      style={{
        backgroundColor: settings.general.theme === 'escuro' ? '#020617' : '#f8fafc'
      }}
    >

      {/* 0. UPDATER BANNER */}
      {systemStatus.updater && systemStatus.updater.status !== 'none' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 w-[95%] max-w-lg">
          <div className="bg-slate-900/95 backdrop-blur-lg border border-slate-700/50 shadow-2xl rounded-2xl p-4 flex items-center space-x-4">
            {systemStatus.updater.status === 'downloading' ? (
              <>
                <div className="relative flex-none">
                  <div className="w-10 h-10 border-2 border-indigo-500/20 rounded-full"></div>
                  <div className="w-10 h-10 border-2 border-indigo-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-bold text-indigo-400">{Math.round(systemStatus.updater.progress || 0)}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 font-bold text-sm tracking-tight truncate">Baixando Atualização...</p>
                  <div className="flex justify-between items-center mt-1.5 mb-1">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Progresso</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.round(systemStatus.updater.progress || 0)}%` }}></div>
                  </div>
                </div>
              </>
            ) : systemStatus.updater.status === 'ready' ? (
              <>
                <div className="bg-emerald-500/10 p-2 rounded-full text-emerald-400 flex-none border border-emerald-500/20">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-emerald-400 font-bold text-sm tracking-tight truncate">Atualização Pronta</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">Uma nova versão foi baixada. Deseja aplicar agora?</p>
                </div>
                <div className="flex gap-2 ml-2">
                  <button onClick={() => setSystemStatus((prev) => ({ ...prev, updater: { status: 'none', progress: 0 } }))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] uppercase tracking-wider font-bold px-3 py-2 rounded-xl transition-all cursor-pointer">
                    Fechar
                  </button>
                  <button onClick={() => fetch('/api/system/updater-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'install' }) })} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap cursor-pointer">
                    Instalar e Abrir
                  </button>
                </div>
              </>
            ) : systemStatus.updater.status === 'error' ? (
              <>
                <div className="bg-rose-500/10 p-2 rounded-full text-rose-400 flex-none border border-rose-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-rose-400 font-bold text-sm tracking-tight truncate">Falha na Atualização</p>
                </div>
                <button onClick={() => fetch('/api/system/updater-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check' }) })} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-colors cursor-pointer">
                  Retentar
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-3 text-slate-300 w-full justify-center py-1">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold uppercase tracking-wider">Verificando...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. TOP HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-xs px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {avatarUrl && avatarUrl !== 'svg' ? (
            <img
              src={avatarUrl}
              className="w-10 h-10 rounded-full border border-indigo-500/40 shadow-xs shadow-indigo-500/10 object-cover"
              alt="Logo"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 flex items-center justify-center text-indigo-500">
              <Bot className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5 leading-none">
              Global Stock
              <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-500/25 font-bold px-1.5 py-0.5 rounded-md">
                by deathzin
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-none">Gerenciador de Inventário Standalone</p>
          </div>
        </div>

        {/* Desktop Tabs */}
        <nav className="hidden md:flex items-center gap-1.5">
          <button
            onClick={() => { setActiveTab('estoque'); setGlobalStockSearch(''); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'estoque'
              ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            Estoque / Inventário
          </button>

          <button
            onClick={() => { setActiveTab('config'); setGlobalStockSearch(''); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'config'
              ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            Configurações
          </button>
        </nav>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center justify-end gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
            {activeWarranties.length > 0 && (
              <button onClick={() => { setActiveTab('estoque'); setForceWarrantyFilter(true); }} className="cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-500/20 shadow-xs animate-pulse">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                <span>{activeWarranties.length} {activeWarranties.length === 1 ? 'GARANTIA' : 'GARANTIAS'}</span>
              </button>
            )}
          </div>

          <button
            onClick={() => {
              const nextTheme = settings.general.theme === 'escuro' ? 'claro' : 'escuro';
              handleSaveSettings({
                ...settings,
                general: { ...settings.general, theme: nextTheme }
              });
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-900 shadow-2xs transition-all cursor-pointer"
            title={settings.general.theme === 'escuro' ? "Ativar Modo Claro" : "Ativar Modo Noturno"}
          >
            {settings.general.theme === 'escuro' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs text-slate-500" >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col py-2 px-4 shadow-sm" >
            {[
              { id: 'estoque', label: 'Estoque / Contas' },
              { id: 'config', label: 'Configurações' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setGlobalStockSearch('');
                  setMobileMenuOpen(false);
                }}
                className={`py-2.5 text-left text-xs font-semibold px-2 rounded-lg transition-colors ${activeTab === item.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-850'}`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {activeTab === 'config' && (
          <div className="animate-fadeIn">
            <SettingsPanel
              settings={settings}
              systemStatus={systemStatus}
              onSave={handleSaveSettings}
              onReset={handleResetSettings}
              onClearDatabase={handleClearDatabase}
            />
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className="animate-fadeIn">
            <EstoquePanel
              forceWarrantyFilter={forceWarrantyFilter}
              onClearWarrantyFilter={() => setForceWarrantyFilter(false)}
              globalSearchQuery={globalStockSearch}
            />
          </div>
        )}
      </main>

      {/* EMERGENCY MODALS */}
      <AnimatePresence>
        {activeWarrantyAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" >
            {activeWarrantyAlerts.map(alert => (
              <motion.div key={alert.itemId} initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl p-6 shadow-2xl max-w-md w-full relative overflow-hidden" >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 flex-shrink-0 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-sm animate-bounce">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Aviso de Garantia LZT!</h2>
                    <p className="text-sm font-medium text-rose-600 dark:text-rose-400 mt-1 leading-tight">Uma conta está prestes a perder a garantia. Verifique imediatamente!</p>
                  </div>
                </div>
                <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-500">Produto</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{alert.productName}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-500">Conta / Login</span>
                    <span className="text-xs font-bold font-mono bg-slate-200 dark:bg-slate-800 rounded px-1 text-slate-800 dark:text-slate-200">{alert.login}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-bold text-slate-500">Expira em</span>
                    <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full ring-1 ring-amber-500/20">~ 20 MINUTOS</span>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <button onClick={() => setActiveWarrantyAlerts(prev => prev.filter(a => a.itemId !== alert.itemId))} className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-lg shadow-rose-600/20 cursor-pointer" >
                    Estou Ciente — Fechar Alerta
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-850/60 px-4 md:px-8 py-2 flex items-center justify-between gap-3 text-[10px] text-slate-500 relative z-10">
        <span>© {new Date().getFullYear()} Global Stock by deathzin</span>
        <span className="font-medium text-slate-400">Pronto para operação</span>
      </footer>
    </div>
  );
}
