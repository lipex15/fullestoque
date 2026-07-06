/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppSettings {
  general: {
    startup: boolean;
    soundEnabled: boolean;
    browserAlerts: boolean;
    theme: 'claro' | 'escuro';
  };
}


export type NotificationPlatform = 'ggmax' | 'gamemarket' | 'desapego' | 'outros';
export type NotificationPriority = 'normal' | 'alta' | 'urgente';
export type NotificationCategory = 'venda' | 'reclamacao' | 'pergunta' | 'outros';
export type NotificationStatus = 'nao_vista' | 'vista' | 'deletado';
export type ResolutionStatus = 'pendente' | 'resolvida';

export interface NotificationItem {
  id: string;
  externalId?: string; // Discord message ID or unique txn ID
  platform: NotificationPlatform;
  title: string;
  description: string;
  buyerName?: string;
  itemName?: string;
  price?: number;
  timestamp: string; // ISO string
  priority: NotificationPriority;
  category: NotificationCategory;
  status: NotificationStatus;
  resolution: ResolutionStatus;
  notes?: string;
  discordLink?: string;
}

export interface StockProduct {
  id: string;
  name: string;
  platform: string; // Free-form name, ex: Steam/Epic/Uplay/Rockstar
  category?: 'Contas' | 'Keys/Gift Cards' | 'Moedas' | 'Serviços' | 'Outros';
  price?: number;
  minWarning?: number;
  availableCount?: number;
  totalCount?: number;
  activeWarrantyCount?: number;
}

export interface StockInventoryItem {
  id: string;
  product_id: string;
  content: string;
  status: 'disponivel' | 'vendido';
  sold_to?: string;
  sold_at?: string;
  notification_id?: string;

  // New structured account details
  login?: string;
  senha?: string;
  email?: string;
  senhaEmail?: string;
  observacao?: string;
  dataNascimento?: string;
  perguntaSecreta?: string;
  respostaSecreta?: string;
  paisCadastro?: string;

  // Warranty tracking (LZT guarantee)
  warrantyExpiresAt?: string;  // ISO timestamp or undefined
  warrantyAlertSent?: boolean;
}

export interface UpdaterState {
  status: 'none' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  progress: number;
  bytesPerSecond?: number;
  error?: string;
}

export interface SystemStatus {
  updater?: UpdaterState;
  storagePath: string;
}


export interface LiveLog {
  id: string;
  timestamp: string;
  source: 'sistema' | 'discord' | 'whatsapp';
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    startup: false,
    soundEnabled: true,
    browserAlerts: true,
    theme: 'claro',

  },
};
