import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Plus, Search, Trash2, Edit2, AlertTriangle, Key, ShoppingBag, Eye, Copy, Check, User, Clock, ChevronDown, ChevronUp, RefreshCw, X, Layers, ShieldCheck
} from 'lucide-react';
import { StockProduct, StockInventoryItem, NotificationItem } from '../types';

interface EstoquePanelProps {
  forceWarrantyFilter?: boolean;
  onClearWarrantyFilter?: () => void;
  globalSearchQuery?: string;
}

export default function EstoquePanel({ forceWarrantyFilter, onClearWarrantyFilter, globalSearchQuery }: EstoquePanelProps) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null);
  const [productItems, setProductItems] = useState<StockInventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Forms states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [bulkInput, setBulkInput] = useState('');

  // Structured Account form states
  const [addMode, setAddMode] = useState<'individual' | 'bulk'>('individual');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Manual delivery association state
  const [manualDeliveryItem, setManualDeliveryItem] = useState<StockInventoryItem | null>(null);
  const [buyerManualName, setBuyerManualName] = useState('');

  // INDIVIDUAL ADD FORM STATES
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState('');
  const [senhaEmail, setSenhaEmail] = useState('');
  const [observacao, setObservacao] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [perguntaSecreta, setPerguntaSecreta] = useState('');
  const [respostaSecreta, setRespostaSecreta] = useState('');
  const [paisCadastro, setPaisCadastro] = useState('');
  const [showExtraFields, setShowExtraFields] = useState(false);

  // WARRANTY FORM STATES
  const [hasWarranty, setHasWarranty] = useState(false);
  const [warrantyType, setWarrantyType] = useState<string>('24');
  const [customWarrantyHours, setCustomWarrantyHours] = useState<string>('12');

  const [sortProductBy, setSortProductBy] = useState<'alpha' | 'quantity' | 'recent'>('alpha');
  const [filterWarranty, setFilterWarranty] = useState<'all' | 'warranty'>(forceWarrantyFilter ? 'warranty' : 'all');

  useEffect(() => {
    if (forceWarrantyFilter) setFilterWarranty('warranty');
  }, [forceWarrantyFilter]);

  useEffect(() => {
    if (globalSearchQuery !== undefined) {
      setSearchQuery(globalSearchQuery);
    }
  }, [globalSearchQuery]);

  useEffect(() => {
    fetchProducts();
    const handleStockRefresh = () => fetchProducts();
    window.addEventListener('stock_refresh', handleStockRefresh);
    return () => window.removeEventListener('stock_refresh', handleStockRefresh);
  }, []);

  useEffect(() => {
    if (selectedProduct) fetchProductItems(selectedProduct.id);
    else setProductItems([]);
  }, [selectedProduct]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/products');
      if (res.ok) setProducts(await res.json());
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductItems = async (productId: string) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/stock/products/${productId}/items`);
      if (res.ok) setProductItems(await res.json());
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Excluir o produto "${name}" e todos os seus itens?`)) {
      try {
        const res = await fetch(`/api/stock/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchProducts();
          if (selectedProduct?.id === id) setSelectedProduct(null);
        }
      } catch (e) {
        console.error('Erro', e);
      }
    }
  };

  const handleBulkAddItems = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !bulkInput.trim()) return;
    try {
      const res = await fetch(`/api/stock/products/${selectedProduct.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawItems: bulkInput })
      });
      if (res.ok) {
        setBulkInput('');
        fetchProductItems(selectedProduct.id);
        fetchProducts();
      }
    } catch (e) {
      console.error('Erro importando lotes:', e);
    }
  };

  const handleAddIndividualAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !login.trim()) return;
    try {
      const res = await fetch(`/api/stock/products/${selectedProduct.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login, senha, email, senhaEmail, observacao, dataNascimento, perguntaSecreta, respostaSecreta, paisCadastro,
          warrantyHours: hasWarranty ? (warrantyType === 'custom' ? customWarrantyHours : warrantyType) : undefined,
        })
      });
      if (res.ok) {
        setLogin(''); setSenha(''); setEmail(''); setSenhaEmail(''); setObservacao(''); setDataNascimento('');
        setPerguntaSecreta(''); setRespostaSecreta(''); setPaisCadastro(''); setShowExtraFields(false);
        setHasWarranty(false); setWarrantyType('24'); setCustomWarrantyHours('12');
        fetchProductItems(selectedProduct.id);
        fetchProducts();
      }
    } catch (e) {
      console.error('Erro na conta.', e);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Excluir este item de estoque?')) {
      try {
        const res = await fetch(`/api/stock/items/${itemId}`, { method: 'DELETE' });
        if (res.ok) {
          if (selectedProduct) fetchProductItems(selectedProduct.id);
          fetchProducts();
        }
      } catch (e) { }
    }
  };

  const handleManualDeliver = async (itemId: string) => {
    const item = productItems.find(i => i.id === itemId);
    if (!item) return;
    setManualDeliveryItem(item);
    setBuyerManualName('');
  };

  const submitManualDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDeliveryItem || !selectedProduct) return;
    try {
      const finalBuyer = buyerManualName || "Cliente Manual";
      const res = await fetch(`/api/stock/items/${manualDeliveryItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: manualDeliveryItem.content,
          status: 'vendido',
          sold_to: finalBuyer,
          sold_at: new Date().toISOString()
        })
      });
      if (res.ok) {
        setManualDeliveryItem(null);
        fetchProductItems(selectedProduct.id);
        fetchProducts();
      }
    } catch (err) { }
  };

  const handleCopyContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItemId(id);
    setTimeout(() => setCopiedItemId(null), 2000);
  };

  const totalProducts = products.length;
  const totalAvailable = products.reduce((sum, p) => sum + (p.availableCount || 0), 0);
  const totalSold = products.reduce((sum, p) => sum + ((p.totalCount || 0) - (p.availableCount || 0)), 0);
  const lowStockAlerts = products.filter(p => (p.availableCount || 0) <= p.minWarning).length;

  const filteredProducts = [...products]
    .filter(p => {
      if (filterWarranty === 'warranty' && (p.activeWarrantyCount || 0) === 0) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortProductBy === 'alpha') return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      if (sortProductBy === 'quantity') return (b.availableCount || 0) - (a.availableCount || 0);
      return b.id.localeCompare(a.id); // recent (ID has timestamp)
    });

  return (
    <div className="space-y-6">
      {/* 1. MAIN BENTO STOCK METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Products */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Produtos Cadastrados</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">{totalProducts}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Perfis de estoque ativos</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2: Active items in stock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Itens Disponíveis</p>
            <h3 className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalAvailable}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Contas/Keys prontas para envio</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3: Total Sold items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Entregas Realizadas</p>
            <h3 className="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{totalSold}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Contas/Keys entregues</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4: Low stock warnings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estoque Baixo</p>
            <h3 className={`text-xl md:text-2xl font-black mt-1 ${lowStockAlerts > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>{lowStockAlerts}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Produtos abaixo do limite de aviso</p>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${lowStockAlerts > 0 ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. CATALOG HEADER CONTROLS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar no estoque de produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-medium pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            <select
              value={filterWarranty}
              onChange={(e) => {
                setFilterWarranty(e.target.value as any);
                if (e.target.value === 'all' && onClearWarrantyFilter) onClearWarrantyFilter();
              }}
              className="h-full text-xs font-bold px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">Todas as Contas</option>
              <option value="warranty">C/ Garantia Ativa</option>
            </select>
            <select
              value={sortProductBy}
              onChange={(e) => setSortProductBy(e.target.value as any)}
              className="h-full text-xs font-bold px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="alpha">A-Z (Alfabética)</option>
              <option value="quantity">Maior Estoque</option>
              <option value="recent">Recém Editado</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchProducts}
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 bg-white dark:bg-slate-900 cursor-pointer transition-all"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setShowAddProductModal(true);
              }}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produto
            </button>
          </div>
        </div>

        {/* 3. PRODUCT LIST — Compact Alphabetical Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-10 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-center">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Nenhum produto cadastrado</p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5">Clique em + Adicionar Produto para criar um perfil de estoque.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProducts.map((p) => {
              const isLow = (p.availableCount || 0) <= p.minWarning;
              const isOutOfStock = p.availableCount === 0;
              const isSelected = selectedProduct?.id === p.id;

              return (
                <div key={p.id} className={`border rounded-xl transition-all flex flex-col h-full bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-xs hover:shadow-md overflow-hidden ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}>
                  {/* HEADER ROW */}
                  <div
                    className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setSelectedProduct(isSelected ? null : p)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className={`flex-shrink-0 w-14 text-center text-[10px] tracking-wide font-black uppercase px-2 py-1.5 rounded-lg border ${p.platform === 'ggmax' ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/40' :
                        p.platform === 'gamemarket' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40' :
                          p.platform === 'desapego' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40' :
                            p.platform === 'todas' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/40' :
                              'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                        {p.platform === 'todas' ? 'ALL' : p.platform.toUpperCase()}
                      </span>

                      <div className="flex flex-col min-w-0 flex-1 mt-0.5">
                        <h4 className="text-[13px] font-black text-slate-900 dark:text-white leading-tight truncate" title={p.name}>
                          {p.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{p.category || 'Outros'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        {(p.activeWarrantyCount || 0) > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-md border border-amber-500/30 shadow-xs" title={`${p.activeWarrantyCount} conta(s) com garantia ativa`}>
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                            <span>{p.activeWarrantyCount}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800">
                          {(isOutOfStock || isLow) && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOutOfStock ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} title={isOutOfStock ? 'Esgotado' : 'Estoque baixo'} />
                          )}
                          <span className={`text-[11px] font-black ${isOutOfStock ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'}`}>Estoque: {p.availableCount}</span>
                          <span className="text-[10px] text-slate-400 font-bold">/{p.totalCount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3 ml-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProduct(p); setShowAddProductModal(true); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                          title="Editar produto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id, p.name); }}
                          className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer transition-colors"
                          title="Deletar produto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="w-6 flex justify-center text-slate-400 ml-1 font-bold">
                          {isSelected ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACCORDION EXPAND BLOCK */}
                  <AnimatePresence>
                    {isSelected && (
                      <div className="mx-2 md:mx-4 mb-4 border-t border-slate-200 dark:border-slate-800/50 pt-4">
                        <motion.div
                          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-xs space-y-6"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                              <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Painel do Produto</h3>
                              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">{selectedProduct.name}</h2>
                              <p className="text-xs text-slate-500 mt-1">Gerencie as contas, chaves e credenciais ativas no SQLite para entrega automática.</p>
                            </div>
                            <button onClick={() => setSelectedProduct(null)} className="px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition-all">
                              Fechar Detalhes
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Add items panel */}
                            <div className="lg:col-span-4 space-y-4">
                              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4">
                                <div className="flex bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl mb-4">
                                  <button type="button" onClick={() => setAddMode('individual')} className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg transition-all ${addMode === 'individual' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>Individual</button>
                                  <button type="button" onClick={() => setAddMode('bulk')} className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg transition-all ${addMode === 'bulk' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>Em Lote</button>
                                </div>

                                {addMode === 'individual' ? (
                                  <form onSubmit={handleAddIndividualAccount} className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2">
                                      <Plus className="w-4 h-4 text-indigo-500" />
                                      Cadastrar Conta
                                    </h4>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Login / Usuário</label>
                                      <input type="text" placeholder="Ex: player_vip" value={login} onChange={e => setLogin(e.target.value)} required className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Senha</label>
                                      <input type="text" placeholder="Ex: senhatop99" value={senha} onChange={e => setSenha(e.target.value)} required className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">E-mail da Conta (Opcional)</label>
                                      <input type="text" placeholder="Ex: conta@gmail.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    {email && (
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Senha do E-mail</label>
                                        <input type="text" placeholder="Ex: senhaemail123" value={senhaEmail} onChange={e => setSenhaEmail(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                      </div>
                                    )}
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Observação da Conta</label>
                                      <textarea placeholder="Ex: Conta com 40 skins, etc." value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <button type="button" onClick={() => setShowExtraFields(!showExtraFields)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                        {showExtraFields ? '- Ocultar Campos Extras' : '+ Mostrar Campos Extras (Nascimento, Pergunta Secreta, Resposta Secreta, País...)'}
                                      </button>
                                    </div>
                                    {showExtraFields && (
                                      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-850">
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Data de Nascimento</label>
                                          <input type="text" placeholder="Ex: 22/05/2000" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pergunta Secreta</label>
                                          <input type="text" placeholder="Ex: Nome da mãe?" value={perguntaSecreta} onChange={e => setPerguntaSecreta(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Resposta Secreta</label>
                                          <input type="text" placeholder="Ex: Maria" value={respostaSecreta} onChange={e => setRespostaSecreta(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">País de Cadastro</label>
                                          <input type="text" placeholder="Ex: Brasil" value={paisCadastro} onChange={e => setPaisCadastro(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                      </div>
                                    )}
                                    {/* WARRANTY SECTION */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                      <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div
                                          onClick={() => setHasWarranty(!hasWarranty)}
                                          className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${hasWarranty ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                        >
                                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${hasWarranty ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        </div>
                                        <ShieldCheck className={`w-3.5 h-3.5 flex-shrink-0 ${hasWarranty ? 'text-amber-500' : 'text-slate-400'}`} />
                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Possui Garantia LZT?</span>
                                      </label>
                                      {hasWarranty && (
                                        <div className="mt-2 flex items-center gap-2">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Duração:</label>
                                          <select
                                            value={warrantyType}
                                            onChange={e => setWarrantyType(e.target.value)}
                                            className="flex-1 text-xs px-2 py-1 border border-amber-200 dark:border-amber-900/50 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                          >
                                            <option value="24">24 horas</option>
                                            <option value="72">3 dias (72h)</option>
                                            <option value="custom">Personalizado...</option>
                                          </select>
                                          {warrantyType === 'custom' && (
                                            <input
                                              type="number" step="any" min="0.01" max="720" placeholder="Horas"
                                              value={customWarrantyHours}
                                              onChange={e => setCustomWarrantyHours(e.target.value)}
                                              className="w-20 text-xs px-2 py-1 border border-amber-200 dark:border-amber-900/50 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <button type="submit" className="w-full py-2 mt-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl transition-all cursor-pointer" disabled={!login || !senha}>
                                      Salvar Conta no Estoque
                                    </button>
                                  </form>
                                ) : (
                                  <form onSubmit={handleBulkAddItems} className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2">
                                      <Plus className="w-4 h-4 text-indigo-500" />
                                      Adicionar Contas / Keys (Em lote)
                                    </h4>
                                    <p className="text-[10px] text-slate-500 leading-normal mb-2 font-medium">
                                      Insira <strong>um item por linha</strong> no formato padrão: <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-mono text-[9px]">login:senha:email:senha_do_email</code>
                                    </p>
                                    <textarea
                                      value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={6}
                                      placeholder="Exemplo:
mlqywhryyr@rambler.ru:Mohammed20020:mlqywhryyr@rambler.ru:PKJRfUPp2B8_
outro_login:senha123:email@rambler.ru:senhaEmail456"
                                      className="w-full text-xs font-mono p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button type="submit" disabled={!bulkInput} className="w-full py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl transition-all cursor-pointer">Importar no SQLite</button>
                                  </form>
                                )}
                              </div>
                            </div>

                            {/* Items List */}
                            <div className="lg:col-span-8 space-y-4">
                              <div className="border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                <div className="bg-slate-50 dark:bg-slate-950/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Itens Cadastrados</span>
                                  <span className="text-[10px] font-bold text-slate-500">{productItems.length} itens no total</span>
                                </div>

                                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                  {loadingItems ? (
                                    <div className="p-8 text-center text-xs text-slate-400">Carregando estoque do SQLite...</div>
                                  ) : productItems.length === 0 ? (
                                    <div className="p-12 text-center text-xs text-slate-500 italic">
                                      Nenhum item em estoque para este produto. Use a importação ao lado!
                                    </div>
                                  ) : (
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-50/50 dark:bg-slate-950/25 border-b border-slate-200 dark:border-slate-850 text-slate-400 font-bold text-[10px] uppercase">
                                          <th className="px-4 py-2.5 w-[36px]"></th>
                                          <th className="px-4 py-2.5">Conteúdo / Conta</th>
                                          <th className="px-4 py-2.5">Status</th>
                                          <th className="px-4 py-2.5">Destinatário</th>
                                          <th className="px-4 py-2.5 text-right">Ações</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                        {productItems.map((item) => {
                                          const isSold = item.status === 'vendido';
                                          const isExpanded = expandedItemId === item.id;
                                          // Warranty countdown
                                          const warrantyMs = item.warrantyExpiresAt
                                            ? new Date(item.warrantyExpiresAt as string).getTime() - Date.now()
                                            : null;
                                          const warrantyActive = warrantyMs !== null && warrantyMs > 0;
                                          const warrantyExpired = item.warrantyExpiresAt && !warrantyActive;
                                          const warrantyMinutes = warrantyActive ? Math.floor(warrantyMs! / 60000) : 0;

                                          return (
                                            <React.Fragment key={item.id}>
                                              <tr className={`hover:bg-slate-50/40 dark:hover:bg-slate-900/40 ${isSold ? 'opacity-60' : ''} ${isExpanded ? 'bg-indigo-50/15 dark:bg-indigo-950/5' : ''}`}>
                                                <td className="px-4 py-3 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5"
                                                    title="Expandir detalhes da conta"
                                                  >
                                                    <Eye className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isExpanded ? 'scale-110 text-indigo-500' : ''}`} />
                                                  </button>
                                                </td>

                                                <td className="px-4 py-3 font-mono text-[11px] max-w-[160px] truncate" title={item.content}>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="truncate">{item.login || item.content}</span>
                                                    <button
                                                      onClick={() => handleCopyContent(item.content, item.id)}
                                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                                                      title="Copiar credenciais completas"
                                                    >
                                                      {copiedItemId === item.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                    {/* Warranty badge */}
                                                    {warrantyActive && (
                                                      <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${warrantyMinutes <= 30
                                                        ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400 animate-pulse'
                                                        : warrantyMinutes <= 120
                                                          ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
                                                          : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                                                        }`} title={`Garantia expira em ${warrantyMinutes}min`}>
                                                        <ShieldCheck className="w-2.5 h-2.5" />
                                                        {warrantyMinutes >= 60 ? `${Math.floor(warrantyMinutes / 60)}h${warrantyMinutes % 60 > 0 ? `${warrantyMinutes % 60}m` : ''}` : `${warrantyMinutes}m`}
                                                      </span>
                                                    )}
                                                    {warrantyExpired && (
                                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700" title="Garantia expirada">
                                                        <ShieldCheck className="w-2.5 h-2.5" /> Expirada
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${isSold
                                                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                    }`}>
                                                    {isSold ? 'Vendido' : 'Disponível'}
                                                  </span>
                                                </td>

                                                <td className="px-4 py-3 text-[11px] text-slate-500">
                                                  {isSold ? (
                                                    <div className="space-y-0.5">
                                                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                                        <User className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                                        <span className="truncate max-w-[120px]" title={item.sold_to}>{item.sold_to || 'N/A'}</span>
                                                      </div>
                                                      {item.sold_at && (
                                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-semibold leading-none">
                                                          <Clock className="w-2.5 h-2.5" />
                                                          <span>{new Date(item.sold_at).toLocaleDateString()}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <span className="text-slate-400 italic">Disponível</span>
                                                  )}
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                  <div className="flex items-center justify-end gap-1.5">
                                                    {!isSold && (
                                                      <button
                                                        onClick={() => handleManualDeliver(item.id)}
                                                        className="px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[10px] font-bold rounded-md cursor-pointer transition-all border border-indigo-150 dark:border-indigo-900/30"
                                                        title="Marcar como entregue / Vendido"
                                                      >
                                                        Resgatar / Vender
                                                      </button>
                                                    )}
                                                    <button
                                                      onClick={() => handleDeleteItem(item.id)}
                                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-all"
                                                      title="Remover item de estoque"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>

                                              {isExpanded && (
                                                <tr className="bg-slate-50/50 dark:bg-slate-950/20">
                                                  <td colSpan={5} className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                      <div className="space-y-2">
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">Login / Usuário</span>
                                                          <div className="flex items-center gap-1.5 font-mono">
                                                            <span className="text-slate-800 dark:text-slate-100 font-bold">{item.login || item.content}</span>
                                                            <button onClick={() => handleCopyContent(item.login || item.content, item.id + '_login')} className="text-slate-400 hover:text-indigo-600 p-0.5">
                                                              {copiedItemId === item.id + '_login' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                            </button>
                                                          </div>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">Senha</span>
                                                          <div className="flex items-center gap-1.5 font-mono">
                                                            <span className="text-slate-800 dark:text-slate-100 font-bold">{item.senha || 'N/A'}</span>
                                                            {item.senha && (
                                                              <button onClick={() => handleCopyContent(item.senha, item.id + '_senha')} className="text-slate-400 hover:text-indigo-600 p-0.5">
                                                                {copiedItemId === item.id + '_senha' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                              </button>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">E-mail</span>
                                                          <span className="text-slate-800 dark:text-slate-100 font-semibold">{item.email || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">Senha do E-mail</span>
                                                          <span className="text-slate-800 dark:text-slate-100 font-semibold">{item.senhaEmail || 'N/A'}</span>
                                                        </div>
                                                      </div>

                                                      <div className="space-y-2">
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">Data de Nascimento</span>
                                                          <span className="text-slate-800 dark:text-slate-100 font-semibold">{item.dataNascimento || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">Pergunta Secreta</span>
                                                          <span className="text-slate-800 dark:text-slate-100 font-semibold">{item.perguntaSecreta || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">Resposta Secreta</span>
                                                          <span className="text-slate-800 dark:text-slate-100 font-semibold">{item.respostaSecreta || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
                                                          <span className="text-slate-400 font-bold uppercase text-[9px]">País de Cadastro</span>
                                                          <span className="text-slate-800 dark:text-slate-100 font-semibold">{item.paisCadastro || 'N/A'}</span>
                                                        </div>
                                                      </div>

                                                      {item.observacao && (
                                                        <div className="md:col-span-2 bg-slate-100/55 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none mb-1">Observação Individual</span>
                                                          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium whitespace-pre-line">{item.observacao}</p>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )
        }
      </div>



      {/* ISOLATED MODAL LAUNCHERS ARE NOW SAFELY MOUNTED */}
      {(showAddProductModal || editingProduct) && (
        <AddProductModal
          editingProduct={editingProduct}
          onClose={() => {
            setShowAddProductModal(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            setShowAddProductModal(false);
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}

      {manualDeliveryItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setManualDeliveryItem(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs cursor-pointer" />
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col z-[101] p-6">
            <h3 className="text-sm font-black text-slate-900 uppercase">Entrega Manual</h3>
            <p className="text-xs text-slate-500 mt-2">Deseja marcar este item como vendido e dar baixa no estoque?</p>
            <form onSubmit={submitManualDelivery} className="mt-4 space-y-3">
              <input type="text" placeholder="Nome do Comprador" value={buyerManualName} onChange={e => setBuyerManualName(e.target.value)} required className="w-full text-xs p-2 border rounded-xl" />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setManualDeliveryItem(null)} className="px-4 py-2 text-xs font-bold bg-slate-100 rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl">Confirmar Baixa</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ISOLATED PRODUCT MODAL (FIXES FOCUS LOSS & LAYOUT)
// ==========================================
interface AddProductModalProps {
  editingProduct: StockProduct | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AddProductModal({ editingProduct, onClose, onSuccess }: AddProductModalProps) {
  const [prodName, setProdName] = useState(editingProduct?.name || '');
  const [prodPlatform, setProdPlatform] = useState(editingProduct?.platform || '');
  const [prodCategory, setProdCategory] = useState(editingProduct?.category || 'Contas');
  const [prodPrice, setProdPrice] = useState(editingProduct?.price?.toString() || '0');
  const [prodMinWarning, setProdMinWarning] = useState(editingProduct?.minWarning?.toString() || '0');
  const [prodInitialItems, setProdInitialItems] = useState('');

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedPrice = parseFloat(prodPrice.replace(',', '.'));
      const finalPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
      const parsedMin = parseInt(prodMinWarning, 10);
      const finalMin = isNaN(parsedMin) ? 2 : parsedMin;

      const url = editingProduct ? `/api/stock/products/${editingProduct.id}` : '/api/stock/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prodName,
          platform: prodPlatform,
          category: prodCategory,
          price: finalPrice,
          minWarning: finalMin,
          initialItems: prodInitialItems
        })
      });
      if (res.ok) onSuccess();
      else console.error(await res.text());
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay background */}
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs cursor-pointer" />

      {/* Modal Box - completely standard div to circumvent framer-motion focus bug! */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] z-[101]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {editingProduct ? 'Editar Perfil de Estoque' : 'Cadastrar Novo Produto'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Configure os dados de correspondência para monitoramento e entrega.</p>
        </div>

        <form onSubmit={submitForm} className="p-6 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome Correspondente do Produto</label>
            <input
              type="text"
              required
              placeholder="Ex: Gift Card Google Play R$ 50"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[9px] text-slate-400 italic">Este nome deve corresponder ou ser parte do nome do produto que consta na notificação da venda.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plataforma do Jogo / Conta (Ex: Steam, Epic, Uplay, Rockstar)</label>
            <input
              type="text"
              required
              placeholder="Ex: Steam / Rockstar"
              value={prodPlatform}
              onChange={(e) => setProdPlatform(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[9px] text-slate-400 italic">A plataforma em que a conta está cadastrada.</p>
          </div>

          {!editingProduct && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens Iniciais de Estoque (Opcional)</label>
              <textarea
                placeholder="Insira um item por linha para carregar inicialmente.&#10;Exemplo:&#10;minha-conta-vip:senha123&#10;GFT-PLAY-88X7-LLP"
                value={prodInitialItems}
                onChange={(e) => setProdInitialItems(e.target.value)}
                rows={4}
                className="w-full text-xs font-mono p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-sm"
            >
              {editingProduct ? 'Salvar Alterações' : 'Criar Perfil de Estoque'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
