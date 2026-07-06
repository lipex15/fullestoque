const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Plus, Search, Trash2, Edit2, AlertTriangle, Key, ShoppingBag, Eye, Copy, Check, User, Clock, ChevronDown, ChevronUp, RefreshCw, X
} from 'lucide-react';
import { StockProduct, StockInventoryItem, NotificationItem } from '../types';

interface EstoquePanelProps {
  notifications: NotificationItem[];
  onUpdateNotification: (id: string, updates: Partial<NotificationItem>) => Promise<void>;
}

export default function EstoquePanel({ notifications, onUpdateNotification }: EstoquePanelProps) {
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
  const [selectedNotifId, setSelectedNotifId] = useState('');
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
      const res = await fetch(\`/api/stock/products/\${productId}/items\`);
      if (res.ok) setProductItems(await res.json());
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(\`Excluir o produto "\${name}" e todos os seus itens?\`)) {
      try {
        const res = await fetch(\`/api/stock/products/\${id}\`, { method: 'DELETE' });
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
      const res = await fetch(\`/api/stock/products/\${selectedProduct.id}/items\`, {
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
      const res = await fetch(\`/api/stock/products/\${selectedProduct.id}/items\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login, senha, email, senhaEmail, observacao, dataNascimento, perguntaSecreta, respostaSecreta, paisCadastro
        })
      });
      if (res.ok) {
        setLogin(''); setSenha(''); setEmail(''); setSenhaEmail(''); setObservacao(''); setDataNascimento('');
        setPerguntaSecreta(''); setRespostaSecreta(''); setPaisCadastro(''); setShowExtraFields(false);
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
        const res = await fetch(\`/api/stock/items/\${itemId}\`, { method: 'DELETE' });
        if (res.ok) {
          if (selectedProduct) fetchProductItems(selectedProduct.id);
          fetchProducts();
        }
      } catch (e) {}
    }
  };

  const handleManualDeliver = async (itemId: string) => {
    const item = productItems.find(i => i.id === itemId);
    if (!item) return;
    setManualDeliveryItem(item);
    setBuyerManualName('');
    setSelectedNotifId('');
  };

  const submitManualDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDeliveryItem || !selectedProduct) return;
    try {
      const finalBuyer = buyerManualName || "Cliente Manual";
      const res = await fetch(\`/api/stock/items/\${manualDeliveryItem.id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: manualDeliveryItem.content,
          status: 'vendido',
          sold_to: finalBuyer,
          sold_at: new Date().toISOString(),
          notification_id: selectedNotifId || null
        })
      });
      if (res.ok) {
        if (selectedNotifId) {
          await onUpdateNotification(selectedNotifId, {
            notes: \`[ENTREGA MANUAL] Entregue do estoque: \${manualDeliveryItem.content}\`,
            resolution: 'resolvida'
          });
        }
        setManualDeliveryItem(null);
        fetchProductItems(selectedProduct.id);
        fetchProducts();
      }
    } catch (err) {}
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

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const pendingSales = notifications.filter(n => n.category === 'venda' && n.resolution === 'pendente');

  return (
    <div className="space-y-6">
      {/* 1. MAIN BENTO STOCK METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Products */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Produtos Cadastrados</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">{totalProducts}</h3>
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
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4: Low stock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estoque Baixo</p>
            <h3 className={\`text-xl md:text-2xl font-black mt-1 \${lowStockAlerts > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}\`}>{lowStockAlerts}</h3>
          </div>
          <div className={\`w-11 h-11 rounded-xl flex items-center justify-center \${lowStockAlerts > 0 ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}\`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. HEADER SEARCH & ADD */}
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
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProducts}
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 bg-white dark:bg-slate-900 cursor-pointer transition-all"
            >
              <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
            </button>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produto
            </button>
          </div>
        </div>

        {/* 3. PRODUCT GRID */}
        {filteredProducts.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(p => {
              const isLow = (p.availableCount || 0) <= p.minWarning;
              const isSelected = selectedProduct?.id === p.id;
              return (
                <div key={p.id} className={\`border rounded-xl p-4 transition-all flex flex-col justify-between \${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500' : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80'}\`}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-slate-100 text-slate-700">
                        {p.platform === 'todas' ? 'Todas Plataformas' : p.platform.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">{p.category}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-2.5 leading-snug line-clamp-2" title={p.name}>
                      {p.name}
                    </h4>
                    <div className="flex items-center justify-between mt-4 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Disponível</span>
                      <div className="flex items-center gap-1.5">
                        <span className={\`text-sm font-black \${p.availableCount === 0 ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}\`}>
                          {p.availableCount}
                        </span>
                        <span className="text-xs text-slate-400">/ {p.totalCount} unids</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setEditingProduct(p); setShowAddProductModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteProduct(p.id, p.name)} className="p-1.5 text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(isSelected ? null : p)}
                      className={\`px-2.5 py-1 text-[10px] font-extrabold rounded-lg flex items-center gap-1 transition-all \${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}\`}
                    >
                      {isSelected ? 'Fechar Itens' : 'Gerenciar Itens'}
                      {isSelected ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. INVENTORY MANAGEMENT (EXPANDED PRODUCT) */}
      <AnimatePresence mode="wait">
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-xs space-y-6"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Painel do Produto</h3>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">{selectedProduct.name}</h2>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="px-3 py-1.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg">
                Fechar Detalhes
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Add items panel */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4">
                  <div className="flex bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl mb-4">
                    <button onClick={() => setAddMode('individual')} className={\`flex-1 text-[10px] font-bold py-1.5 rounded-lg \${addMode === 'individual' ? 'bg-white text-indigo-600' : 'text-slate-500'}\`}>Individual</button>
                    <button onClick={() => setAddMode('bulk')} className={\`flex-1 text-[10px] font-bold py-1.5 rounded-lg \${addMode === 'bulk' ? 'bg-white text-indigo-600' : 'text-slate-500'}\`}>Lote</button>
                  </div>
                  
                  {addMode === 'individual' ? (
                    <form onSubmit={handleAddIndividualAccount} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Login</label>
                        <input type="text" value={login} onChange={e => setLogin(e.target.value)} required className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Senha</label>
                        <input type="text" value={senha} onChange={e => setSenha(e.target.value)} required className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">E-mail (Opcional)</label>
                        <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Senha do E-mail</label>
                        <input type="text" value={senhaEmail} onChange={e => setSenhaEmail(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg" />
                      </div>
                      <button type="button" onClick={() => setShowExtraFields(!showExtraFields)} className="text-[10px] font-bold text-indigo-600">
                        {showExtraFields ? '- Ocultar' : '+ Adicionar Mais Campos'}
                      </button>
                      {showExtraFields && (
                        <>
                          <input type="text" placeholder="Observação" value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border rounded-lg" />
                          <input type="text" placeholder="Data Nascimento" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border rounded-lg" />
                          <input type="text" placeholder="Pergunta Secreta" value={perguntaSecreta} onChange={e => setPerguntaSecreta(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border rounded-lg" />
                          <input type="text" placeholder="Resposta" value={respostaSecreta} onChange={e => setRespostaSecreta(e.target.value)} className="w-full text-xs px-2.5 py-1.5 border rounded-lg" />
                        </>
                      )}
                      <button type="submit" className="w-full py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl disabled:bg-slate-300" disabled={!login || !senha}>
                        Salvar Conta
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleBulkAddItems} className="space-y-3">
                      <textarea 
                        value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={6} 
                        placeholder="login:senha:email:senhaEmail"
                        className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl"
                      />
                      <button type="submit" disabled={!bulkInput} className="w-full py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl">Importar Lote</button>
                    </form>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="lg:col-span-8">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                  <div className="max-h-[350px] overflow-y-auto">
                    {productItems.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">Nenhum item adicionado.</div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                            <th className="px-4 py-2">Info</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Comprador</th>
                            <th className="px-4 py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {productItems.map(item => {
                            const isSold = item.status === 'vendido';
                            return (
                              <React.Fragment key={item.id}>
                                <tr className={\`\${isSold ? 'opacity-60' : ''}\`}>
                                  <td className="px-4 py-3">
                                    <div className="flex font-mono text-[11px]">
                                      <span className="truncate max-w-[120px]">{item.login || item.content}</span>
                                      <button onClick={() => handleCopyContent(item.content, item.id)} className="ml-2 text-slate-400 hover:text-indigo-600">
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={\`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase \${isSold ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}\`}>
                                      {isSold ? 'Vendido' : 'Disponível'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[11px] text-slate-500">
                                    {isSold ? item.sold_to : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {!isSold && (
                                        <button onClick={() => handleManualDeliver(item.id)} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-lg border border-indigo-200">
                                          Resgatar Manual
                                        </button>
                                      )}
                                      <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-slate-400 hover:text-rose-600">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
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
        )}
      </AnimatePresence>

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
// ISOLATED PRODUCT MODAL (FIXES FOCUS LOSS)
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
      const url = editingProduct ? \`/api/stock/products/\${editingProduct.id}\` : '/api/stock/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prodName,
          platform: prodPlatform,
          category: prodCategory,
          price: parseFloat(prodPrice),
          minWarning: parseInt(prodMinWarning),
          initialItems: prodInitialItems
        })
      });
      if (res.ok) onSuccess();
    } catch (err) {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs cursor-pointer" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 border rounded-2xl shadow-xl flex flex-col p-6 z-[101]">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
          {editingProduct ? 'Editar Perfil de Estoque' : 'Cadastrar Novo Produto'}
        </h3>
        <form onSubmit={submitForm} className="mt-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Nome do Produto na Notificação</label>
            <input type="text" required value={prodName} onChange={e => setProdName(e.target.value)} className="w-full text-xs px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-white font-mono mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Plataforma (Ex: Steam, Epic)</label>
            <input type="text" required value={prodPlatform} onChange={e => setProdPlatform(e.target.value)} className="w-full text-xs px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-white mt-1" />
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold bg-slate-100 rounded-xl">Cancelar</button>
            <button type="submit" className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl">Salvar Produto</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/EstoquePanel.tsx', code, 'utf-8');
console.log('Restoration completely successful!');
