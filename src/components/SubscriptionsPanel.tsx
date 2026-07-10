import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle,
  Copy,
  Edit2,
  ExternalLink,
  Gamepad2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { SubscriptionPlatform, SubscriptionRecord, SubscriptionSummary } from '../types';

type FormState = {
  customerName: string;
  chatLink: string;
  productName: string;
  purchaseDate: string;
  startDate: string;
  durationDays: string;
  notes: string;
};

const emptySummary: SubscriptionSummary = {
  total: 0,
  active: 0,
  expiringSoon: 0,
  expired: 0,
  canceled: 0,
};

const platformConfig: Record<SubscriptionPlatform, {
  label: string;
  shortLabel: string;
  dot: string;
  panel: string;
}> = {
  ggmax: {
    label: 'GGMAX',
    shortLabel: 'GGMAX',
    dot: 'bg-sky-500',
    panel: 'border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20',
  },
  gamemarket: {
    label: 'GameMarket',
    shortLabel: 'GMKT',
    dot: 'bg-emerald-500',
    panel: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20',
  },
};

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromIsoToLocalInput(value?: string | null) {
  return value ? toLocalInputValue(new Date(value)) : toLocalInputValue(new Date());
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createDefaultForm(): FormState {
  const now = toLocalInputValue(new Date());
  return {
    customerName: '',
    chatLink: '',
    productName: 'Xbox Game Pass Ultimate 30 dias',
    purchaseDate: now,
    startDate: now,
    durationDays: '30',
    notes: '',
  };
}

function getPreviewExpiration(form: FormState) {
  const startMs = new Date(form.startDate).getTime();
  const durationDays = Number(form.durationDays) || 30;
  if (!Number.isFinite(startMs) || !Number.isFinite(durationDays) || durationDays <= 0) {
    return 'Ajuste a data';
  }
  return formatDateTime(new Date(startMs + durationDays * 86400000).toISOString());
}

function getStatusMeta(subscription: SubscriptionRecord) {
  if (subscription.computedStatus === 'canceled') {
    return {
      label: 'Cancelada',
      className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
      icon: Ban,
    };
  }

  if (subscription.computedStatus === 'expired') {
    return {
      label: 'Vencida',
      className: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900',
      icon: AlertTriangle,
    };
  }

  if (subscription.daysLeft <= 1) {
    return {
      label: 'Vence em 24h',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
      icon: CalendarClock,
    };
  }

  if (subscription.daysLeft <= 3) {
    return {
      label: `Vence em ${subscription.daysLeft} dias`,
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900',
      icon: CalendarClock,
    };
  }

  return {
    label: 'Ativa',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
    icon: CheckCircle,
  };
}

export default function SubscriptionsPanel() {
  const [selectedPlatform, setSelectedPlatform] = useState<SubscriptionPlatform | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [summary, setSummary] = useState<SubscriptionSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'canceled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(createDefaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSubscriptions = async (platform = selectedPlatform) => {
    if (!platform) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions?platform=${platform}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar assinaturas.');
      setSubscriptions(data.subscriptions || []);
      setSummary(data.summary || emptySummary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPlatform) return;
    fetchSubscriptions(selectedPlatform);
    setSearchQuery('');
    setStatusFilter('all');
    setShowForm(false);
    setEditingId(null);
    setForm(createDefaultForm());
  }, [selectedPlatform]);

  useEffect(() => {
    const handleRefresh = () => fetchSubscriptions();
    window.addEventListener('subscriptions_refresh', handleRefresh);
    return () => window.removeEventListener('subscriptions_refresh', handleRefresh);
  }, [selectedPlatform]);

  const filteredSubscriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      const matchesSearch = !query ||
        subscription.customerName.toLowerCase().includes(query) ||
        subscription.productName.toLowerCase().includes(query) ||
        (subscription.chatLink || '').toLowerCase().includes(query) ||
        (subscription.notes || '').toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && subscription.computedStatus === 'active') ||
        (statusFilter === 'expiring' && subscription.computedStatus === 'active' && subscription.daysLeft <= 3) ||
        (statusFilter === 'expired' && subscription.computedStatus === 'expired') ||
        (statusFilter === 'canceled' && subscription.computedStatus === 'canceled');

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, searchQuery, statusFilter]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(createDefaultForm());
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (subscription: SubscriptionRecord) => {
    setEditingId(subscription.id);
    setForm({
      customerName: subscription.customerName,
      chatLink: subscription.chatLink || '',
      productName: subscription.productName,
      purchaseDate: fromIsoToLocalInput(subscription.purchaseDate),
      startDate: fromIsoToLocalInput(subscription.startDate),
      durationDays: String(subscription.durationDays || 30),
      notes: subscription.notes || '',
    });
    setShowForm(true);
    setError(null);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlatform || !form.customerName.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(editingId ? `/api/subscriptions/${editingId}` : '/api/subscriptions', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          customerName: form.customerName,
          chatLink: form.chatLink,
          productName: form.productName,
          purchaseDate: form.purchaseDate,
          startDate: form.startDate,
          durationDays: form.durationDays,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar assinatura.');
      setSubscriptions(data.subscriptions || []);
      setSummary(data.summary || emptySummary);
      setShowForm(false);
      setEditingId(null);
      setForm(createDefaultForm());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renewSubscription = async (subscription: SubscriptionRecord) => {
    if (!confirm(`Renovar a assinatura de ${subscription.customerName} por mais ${subscription.durationDays || 30} dias?`)) return;
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}/renew`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: toLocalInputValue(new Date()),
          durationDays: subscription.durationDays || 30,
          note: 'Renovacao manual pelo painel',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao renovar assinatura.');
      setSubscriptions(data.subscriptions || []);
      setSummary(data.summary || emptySummary);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cancelSubscription = async (subscription: SubscriptionRecord) => {
    if (!confirm(`Cancelar a assinatura de ${subscription.customerName}?`)) return;
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}/cancel`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao cancelar assinatura.');
      setSubscriptions(data.subscriptions || []);
      setSummary(data.summary || emptySummary);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteSubscription = async (subscription: SubscriptionRecord) => {
    if (!confirm(`Excluir definitivamente a assinatura de ${subscription.customerName}?`)) return;
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao excluir assinatura.');
      setSubscriptions(data.subscriptions || []);
      setSummary(data.summary || emptySummary);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyRenewalMessage = async (subscription: SubscriptionRecord) => {
    const message = `Olá! Sua assinatura ${subscription.productName} vence em ${formatDateTime(subscription.expiresAt)}. Deseja renovar por mais ${subscription.durationDays || 30} dias?`;
    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(subscription.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError('Não consegui copiar a mensagem automaticamente.');
    }
  };

  if (!selectedPlatform) {
    return (
      <div className="space-y-5 animate-fadeIn">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-indigo-500" />
            Assinaturas Game Pass
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Escolha a plataforma antes de cadastrar ou acompanhar clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(platformConfig) as SubscriptionPlatform[]).map((platform) => {
            const config = platformConfig[platform];
            return (
              <button
                key={platform}
                type="button"
                onClick={() => setSelectedPlatform(platform)}
                className={`text-left border rounded-2xl p-5 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xs cursor-pointer ${config.panel}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-950/60 border border-white/80 dark:border-slate-800 flex items-center justify-center">
                      <Gamepad2 className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        Plataforma
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">{config.label}</h3>
                    </div>
                  </div>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-300">Entrar</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const selectedConfig = platformConfig[selectedPlatform];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedPlatform(null)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 transition-colors"
            title="Trocar plataforma"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${selectedConfig.dot}`} />
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Assinaturas {selectedConfig.label}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Controle clientes, chats, datas de compra e vencimento de Game Pass 30 dias.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova assinatura
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ativas', value: summary.active, className: 'text-emerald-500' },
          { label: 'Vencendo', value: summary.expiringSoon, className: 'text-amber-500' },
          { label: 'Vencidas', value: summary.expired, className: 'text-rose-500' },
          { label: 'Total', value: summary.total, className: 'text-indigo-500' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className={`text-2xl font-black mt-1 ${item.className}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 p-3 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={submitForm} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingId ? 'Editar assinatura' : 'Cadastrar assinatura'}
              </h3>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{selectedConfig.label}</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente</span>
              <input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Nome ou @ do comprador"
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Link do chat</span>
              <input
                value={form.chatLink}
                onChange={(e) => setForm({ ...form, chatLink: e.target.value })}
                placeholder="Cole o link do chat"
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Produto</span>
              <input
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Data da compra</span>
              <input
                type="datetime-local"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Data de ativação</span>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Duração em dias</span>
              <input
                type="number"
                min="1"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Expira automaticamente</p>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{getPreviewExpiration(form)}</p>
            </div>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Observações</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Ex: cliente pediu aviso antes, detalhes da entrega, renovação combinada..."
                className="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.customerName.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar assinatura'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, chat, produto ou observação..."
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-2 px-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="expiring">Vencendo em 3 dias</option>
            <option value="expired">Vencidas</option>
            <option value="canceled">Canceladas</option>
          </select>
          <button
            type="button"
            onClick={() => fetchSubscriptions()}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-2">
          {filteredSubscriptions.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarClock className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhuma assinatura encontrada</p>
              <p className="text-xs text-slate-400 mt-1">Cadastre a primeira venda dessa plataforma para acompanhar os 30 dias.</p>
            </div>
          ) : (
            filteredSubscriptions.map((subscription) => {
              const status = getStatusMeta(subscription);
              const StatusIcon = status.icon;
              return (
                <div key={subscription.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/20 p-3">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${status.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{selectedConfig.shortLabel}</span>
                        {subscription.renewalCount > 0 && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">
                            {subscription.renewalCount} renovação{subscription.renewalCount === 1 ? '' : 'es'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white mt-2 break-words">{subscription.customerName}</h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 break-words">{subscription.productName}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Compra: <strong className="text-slate-700 dark:text-slate-200">{formatDateTime(subscription.purchaseDate)}</strong></span>
                        <span>Ativação: <strong className="text-slate-700 dark:text-slate-200">{formatDateTime(subscription.startDate)}</strong></span>
                        <span>Expira: <strong className="text-slate-700 dark:text-slate-200">{formatDateTime(subscription.expiresAt)}</strong></span>
                      </div>
                      {subscription.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 break-words">{subscription.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap xl:flex-nowrap items-center gap-2">
                      {subscription.chatLink && (
                        <a
                          href={subscription.chatLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-bold transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Chat
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => copyRenewalMessage(subscription)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-bold transition-colors"
                      >
                        {copiedId === subscription.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === subscription.id ? 'Copiado' : 'Mensagem'}
                      </button>
                      <button
                        type="button"
                        onClick={() => renewSubscription(subscription)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Renovar
                      </button>
                      <button type="button" onClick={() => openEditForm(subscription)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => cancelSubscription(subscription)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-amber-600 transition-colors" title="Cancelar">
                        <Ban className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => deleteSubscription(subscription)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
