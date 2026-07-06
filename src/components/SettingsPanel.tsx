/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Bot,
  MessageSquare,
  Smartphone,
  Volume2,
  VolumeX,
  Save,
  RotateCcw,
  FolderOpen,
  Terminal,
  HelpCircle,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Monitor,
  QrCode,
  Zap,
  RefreshCw,
  Search,
  Image,
  X
} from 'lucide-react';
import { AppSettings, SystemStatus } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  systemStatus: SystemStatus;
  onSave: (settings: AppSettings) => Promise<boolean>;
  onReset: () => void;
  onClearDatabase: () => void;
  onTriggerScanSim?: () => void;
}

type TabType = 'geral' | 'dados' | 'guia';
export default function SettingsPanel({
  settings: initialSettings,
  systemStatus,
  onSave,
  onReset,
  onClearDatabase,
  onTriggerScanSim
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>({ ...initialSettings });
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Storage & Backup states
  const [newStoragePath, setNewStoragePath] = useState(systemStatus.storagePath || '');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isBackupImporting, setIsBackupImporting] = useState(false);
  const [backupRestoreResult, setBackupRestoreResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBackupImporting(true);
    setBackupRestoreResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const payload = JSON.parse(text);

        if (!payload.dbBase64) {
          throw new Error("Arquivo de backup inválido (conversão binária ausente).");
        }

        const confirm = window.confirm("Atenção: Restaurar este backup substituirá as contas locais e as configurações ativas atuais. Deseja continuar?");
        if (!confirm) {
          setIsBackupImporting(false);
          return;
        }

        const res = await fetch("/api/storage/backup/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro de resposta da API do servidor.");
        }

        setBackupRestoreResult({ success: true, message: "Backup restaurado com sucesso! Recarregando aplicação..." });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setBackupRestoreResult({ success: false, message: `Falha ao restaurar: ${err.message}` });
      } finally {
        setIsBackupImporting(false);
      }
    };
    reader.onerror = () => {
      setBackupRestoreResult({ success: false, message: "Falha na leitura física do arquivo." });
      setIsBackupImporting(false);
    };
    reader.readAsText(file);
  };

  const handleMigrateStorage = async () => {
    if (!newStoragePath) return;

    const confirm = window.confirm(`Deseja migrar totalmente a pasta de salvamento do app para "${newStoragePath}"? Suas contas e status ativos serão copiados e mantidos.`);
    if (!confirm) return;

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const res = await fetch("/api/storage/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPath: newStoragePath }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro na API de migração do servidor.");
      }

      setMigrationResult({ success: true, message: "Pasta migrada com sucesso! Recarregando sistema..." });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setMigrationResult({ success: false, message: `Falha na migração: ${err.message}` });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveResult(null);

    const success = await onSave(settings);
    setIsSaving(false);
    if (success) {
      setSaveResult({ type: 'success', message: 'Configurações gravadas com sucesso no disco!' });
      setTimeout(() => setSaveResult(null), 4000);
    } else {
      setSaveResult({ type: 'error', message: 'Falha ao salvar as configurações.' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">

      {/* SIDEBAR TABS SELECTION */}
      <div className="flex flex-row lg:flex-col gap-1.5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-4 lg:pb-0 lg:pr-4 overflow-x-auto whitespace-nowrap">


        <button
          id="tab-geral"
          type="button"
          onClick={() => setActiveTab('geral')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'geral'
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
            }`}
        >
          <Settings className="w-4 h-4" />
          <span>Geral & Som</span>
        </button>

        <button
          id="tab-dados"
          type="button"
          onClick={() => setActiveTab('dados')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'dados'
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
            }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Gerenciar Dados</span>
        </button>

        <button
          id="tab-guia"
          type="button"
          onClick={() => setActiveTab('guia')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'guia'
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
            }`}
        >
          <Monitor className="w-4 h-4" />
          <span>Guia Offline Windows</span>
        </button>
      </div>

      {/* DETAILED FORMS & TABS BODY */}
      <form onSubmit={handleSave} className="lg:col-span-3 space-y-6">



        {/* TAB 3: GENERAL SETTINGS */}
        {activeTab === 'geral' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Configurações Gerais
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ajustes de interface, alertas de áudio, inicialização e manutenção do banco de dados local.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Windows Startup */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                <input
                  id="checkbox-startup-windows"
                  type="checkbox"
                  checked={settings.general.startup}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, startup: e.target.checked }
                  })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Iniciar Automaticamente com o Windows</p>
                  <p className="text-[10px] text-slate-500">Ativa o deathstuffs brain automaticamente no segundo plano assim que ligar o computador (exclusivo para versão instalada).</p>
                </div>
              </label>

              {/* Sound Enabled */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                <input
                  id="checkbox-sound-enabled"
                  type="checkbox"
                  checked={settings.general.soundEnabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, soundEnabled: e.target.checked }
                  })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {settings.general.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                    Alerta Sonoro de Vendas
                  </p>
                  <p className="text-[10px] text-slate-500">Toca uma campainha de notificação de transações no computador em tempo real.</p>
                </div>
              </label>

              {/* Desktop Alerts */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                <input
                  id="checkbox-browser-alerts"
                  type="checkbox"
                  checked={settings.general.browserAlerts}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, browserAlerts: e.target.checked }
                  })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Notificações Nativas do Sistema</p>
                  <p className="text-[10px] text-slate-500">Gera cartões pop-up flutuantes do Windows 10/11 ou navegador ao receber alertas.</p>
                </div>
              </label>

              {/* Theme selection */}
              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Estética visual</p>
                <div className="flex gap-2">
                  <button
                    id="btn-theme-claro"
                    type="button"
                    onClick={() => setSettings({ ...settings, general: { ...settings.general, theme: 'claro' } })}
                    className={`text-xs font-semibold flex-1 py-2 rounded-lg border transition-all ${settings.general.theme === 'claro'
                      ? 'bg-white text-indigo-700 border-indigo-200 ring-2 ring-indigo-500/10 shadow-xs'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700 dark:bg-slate-900/20'
                      }`}
                  >
                    ☀️ Tema Claro
                  </button>
                  <button
                    id="btn-theme-escuro"
                    type="button"
                    onClick={() => setSettings({ ...settings, general: { ...settings.general, theme: 'escuro' } })}
                    className={`text-xs font-semibold flex-1 py-2 rounded-lg border transition-all ${settings.general.theme === 'escuro'
                      ? 'bg-slate-850 text-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs dark:bg-indigo-950/40'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700 dark:bg-slate-900/20'
                      }`}
                  >
                    🌙 Tema Escuro
                  </button>
                </div>
              </div>

              {/* Background Image configuration */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Plano de Fundo Customizado</label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Envie um arquivo do seu computador ou cole um link direto (URL) para usar de fundo. Limpe para usar cor sólida.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="relative">
                    <input
                      id="input-bg-file"
                      type="file"
                      accept="image/*,video/mp4"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const formData = new FormData();
                            formData.append('bg', file);
                            const res = await fetch('http://localhost:3000/api/upload-bg', {
                              method: 'POST',
                              body: formData
                            });
                            const data = await res.json();
                            if (data.url) {
                              setSettings({ ...settings, general: { ...settings.general, backgroundImage: data.url } });
                            }
                          } catch (err) {
                            console.error("Falha ao subir imagem", err);
                          }
                        }
                      }}
                    />
                    <button type="button" className="pointer-events-none flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                      <Image className="w-4 h-4" />
                      Escolher Imagem
                    </button>
                  </div>

                  <div className="flex-1 w-full relative">
                    <input
                      id="input-background-image"
                      type="text"
                      value={settings.general.backgroundImage || ''}
                      onChange={(e) => setSettings({ ...settings, general: { ...settings.general, backgroundImage: e.target.value } })}
                      placeholder="Ou cole URL..."
                      className="w-full text-xs p-2.5 pl-3 pr-8 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900/40 dark:text-slate-200"
                    />
                    {settings.general.backgroundImage && (
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, general: { ...settings.general, backgroundImage: '' } })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Maintenance database operations */}
              <div className="p-3 rounded-xl border border-red-100 dark:border-red-900/20 bg-red-50/25 dark:bg-red-950/5 space-y-2 mt-4">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Manutenção de Banco de Dados</p>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Esta ação é irreversível. Todas as notificações recebidas, históricos, estatísticas e logs gravados serão deletados.
                </p>
                <button
                  id="btn-clear-db-action"
                  type="button"
                  onClick={onClearDatabase}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 dark:bg-slate-900 dark:hover:bg-rose-950/20 dark:border-rose-900/50 transition-colors"
                >
                  Limpar Banco de Dados
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: GERENCIAMENTO DE DADOS */}
        {activeTab === 'dados' && (
          <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Gerenciamento de Dados & Armazenamento
              </h3>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">
                Fazer backup do seu estoque inteiro, restaurar dados salvos ou migrar a pasta do banco de dados para outro disco (HD/SSD).
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* CURRENT STORAGE PATH INFO */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Pasta Atual de Armazenamento</span>
                <code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-all select-all block bg-white dark:bg-slate-900 p-2 rounded-lg border dark:border-slate-850">{systemStatus.storagePath}</code>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                  Esta é a localização em disco ativa onde sua base <strong className="font-semibold">stock.db</strong>, as configurações e as notificações estão sendo salvas.
                </p>
              </div>

              {/* BACKUP INTEGRAL */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/10 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-150">Backup Integral (.dsb)</h4>
                <p className="text-[11.5px] text-slate-450 dark:text-slate-450 leading-relaxed font-medium">
                  Gere um arquivo de salvamento para prevenir qualquer perda em caso de formatação ou problemas no computador. O backup preserva todas as suas contas cravadas e o painel.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    id="btn-export-backup"
                    type="button"
                    onClick={() => {
                      window.open("/api/storage/backup/export", "_blank");
                    }}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Exportar Backup da Base
                  </button>

                  <button
                    id="btn-import-backup-trigger"
                    type="button"
                    onClick={() => {
                      document.getElementById("input-file-backup-import")?.click();
                    }}
                    disabled={isBackupImporting}
                    className="px-4 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isBackupImporting ? (
                      <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Restaurar Arquivo (.dsb)
                  </button>

                  <input
                    id="input-file-backup-import"
                    type="file"
                    accept=".dsb"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>

                {backupRestoreResult && (
                  <div className={`p-3 rounded-lg flex items-start gap-2 text-xs mt-2 ${backupRestoreResult.success ? 'bg-emerald-50 border border-emerald-150 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400' : 'bg-rose-50 border border-rose-150 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'}`}>
                    {backupRestoreResult.success ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                    <span>{backupRestoreResult.message}</span>
                  </div>
                )}
              </div>

              {/* AUTO UPDATER SECTION */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/10 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-150 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-indigo-500" />
                  Sistema de Atualização Automática
                </h4>
                <p className="text-[11.5px] text-slate-450 dark:text-slate-450 leading-relaxed font-medium">
                  Seu aplicativo recebe atualizações automáticas via GitHub silenciosamente. Se você desligou o Rascunho na nuvem, pode forçar a procura imediata de novos recursos por aqui.
                </p>

                <div className="flex flex-wrap gap-2.5 items-center">
                  <button
                    id="btn-updater-check"
                    type="button"
                    disabled={systemStatus.updater?.status === 'checking' || systemStatus.updater?.status === 'downloading'}
                    onClick={() => {
                      fetch('/api/system/updater-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check' }) });
                    }}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  >
                    {systemStatus.updater?.status === 'checking' ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent flex-none rounded-full animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Procurar Atualizações (Nuvem)
                  </button>

                  <button
                    id="btn-updater-install"
                    type="button"
                    disabled={systemStatus.updater?.status !== 'ready'}
                    onClick={() => {
                      fetch('/api/system/updater-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'install' }) });
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${systemStatus.updater?.status === 'ready' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' : 'bg-slate-50 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800'}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Reiniciar e Instalar Pronta
                  </button>

                  {systemStatus.updater && systemStatus.updater.status !== 'none' && (
                    <span className="text-[10px] uppercase font-bold text-slate-500 ml-auto">
                      Estado Atual: <span className="text-indigo-400">{systemStatus.updater.status}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* DISK MIGRATION SECTION */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/10 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-150">Trocar Pasta de Banco de Dados de Disco (HD/SSD)</h4>
                <p className="text-[11.5px] text-slate-450 dark:text-slate-455 leading-relaxed font-medium">
                  Insira o caminho absoluto da nova pasta de destino no seu computador (ex: <code className="font-mono bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 border dark:border-slate-850 rounded">D:\Dados\deathstuffs-brain</code>). O sistema moverá e reestabelecerá de forma segura suas contas, logs de notificações e registros salvos para o novo disco.
                </p>

                <div className="space-y-3">
                  <input
                    id="input-migrate-path"
                    type="text"
                    value={newStoragePath}
                    onChange={(e) => setNewStoragePath(e.target.value)}
                    placeholder="Coloque o caminho absoluto do novo diretório (ex: D:\Dados\deathstuffs)"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-900/40 dark:text-slate-200"
                  />

                  <button
                    id="btn-migrate-storage"
                    type="button"
                    onClick={handleMigrateStorage}
                    disabled={isMigrating || !newStoragePath || newStoragePath.trim() === systemStatus.storagePath}
                    className="px-4.5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    {isMigrating ? (
                      <span className="w-3.5 h-3.5 border-2 border-white pointer-events-none border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                    Migrar Dados para Novo Disco
                  </button>
                </div>

                {migrationResult && (
                  <div className={`p-3 rounded-lg flex items-start gap-2 text-xs mt-2 ${migrationResult.success ? 'bg-emerald-50 border border-emerald-150 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400' : 'bg-rose-50 border border-rose-150 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'}`}>
                    {migrationResult.success ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                    <span>{migrationResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
        }

        {/* TAB 4: WINDOWS OFFLINE BUILD GUIDE */}
        {
          activeTab === 'guia' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Compilando em Windows (.EXE) Sem Node.js Externo
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Como empacotar e instalar este projeto localmente em seu PC Windows de forma rápida e standalone.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 text-xs text-slate-700 dark:text-slate-300">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 text-center font-bold flex items-center justify-center text-xs">1</span>
                    Passo 1: Baixar e Extrair o ZIP do Projeto
                  </h4>
                  <p className="pl-6 text-[11px] text-slate-500">
                    Clique no menu superior do AI Studio em <strong className="font-semibold text-slate-700 dark:text-slate-200">Exportar (Download ZIP)</strong> ou envie para um repositório GitHub para baixar. Extraia os arquivos em uma pasta de trabalho local em seu computador (Ex: <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 border rounded">C:\Projetos\deathstuffs-brain</code>).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 text-center font-bold flex items-center justify-center text-xs">2</span>
                    Passo 2: Executar a Instalação das dependências e Electron
                  </h4>
                  <p className="pl-6 text-[11px] text-slate-500">
                    Abra o Prompt de Comando (CMD) ou PowerShell na pasta do projeto e execute os seguintes comandos para instalar as ferramentas locais:
                  </p>
                  <div className="pl-6">
                    <pre className="font-mono text-[10px] p-2.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      npm install && npm install -D electron electron-builder wait-on concurrently
                    </pre>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 text-center font-bold flex items-center justify-center text-xs">3</span>
                    Passo 3: Empacotar e Compilar para Windows (.EXE)
                  </h4>
                  <p className="pl-6 text-[11px] text-slate-500">
                    Para compilar o servidor Express, compilar a interface React e gerar o instalador do Windows sem precisar que seus usuários tenham Node.js instalado, execute o comando:
                  </p>
                  <div className="pl-6">
                    <pre className="font-mono text-[10px] p-2.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      npm run electron-pack
                    </pre>
                  </div>
                  <p className="pl-6 text-[11px] text-slate-500">
                    O instalador final <strong className="font-semibold text-slate-700 dark:text-slate-200">deathstuffs-brain Setup.exe</strong> será criado dentro da pasta recém-gerada <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 border rounded">/dist/installers</code>. Prontinho para instalar em qualquer computador Windows offline!
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">Pasta de dados de salvamento do Windows:</p>
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <span className="font-mono text-[10px] px-2 py-1.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-slate-500 break-all flex-1">
                      {systemStatus.storagePath}
                    </span>
                    <div className="text-xs font-semibold text-slate-400 px-1 italic">
                      Dados salvos localmente
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* SAVE & SUBMIT GLOBAL FOOTER ACTIONS */}
        {
          activeTab !== 'guia' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3">
              <button
                id="btn-reset-settings"
                type="button"
                onClick={onReset}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Resetar para Padrão
              </button>

              <button
                id="btn-save-settings-submit"
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Configurações
              </button>
            </div>
          )
        }

        {
          saveResult && (
            <div className={`p-3 rounded-lg flex items-start gap-2 text-xs ${saveResult.type === 'success' ? 'bg-emerald-50 border border-emerald-150 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400' : 'bg-rose-50 border border-rose-150 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'}`}>
              {saveResult.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{saveResult.message}</span>
            </div>
          )
        }
      </form >
    </div >
  );
}
