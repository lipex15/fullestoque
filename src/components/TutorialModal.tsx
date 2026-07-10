import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, X, Shield, PlusCircle, LayoutDashboard, Search, Database, Download } from 'lucide-react';
import { AppSettings } from '../types';

interface TutorialModalProps {
    onClose: () => void;
    onDisable: () => void;
}

export default function TutorialModal({ onClose, onDisable }: TutorialModalProps) {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleClose = () => {
        if (dontShowAgain) {
            onDisable();
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <div onClick={handleClose} className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm cursor-pointer" />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[111] max-h-[90vh]"
            >
                {/* Header Background */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 sm:p-8 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                            <HelpCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight leading-none">Como Usar?</h2>
                            <p className="text-indigo-100 mt-1.5 text-sm font-medium">Guia Rápido do Global Stock</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950/30">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg flex-shrink-0">
                                <PlusCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">1. Novo Produto</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Crie uma categoria clicando em "Nova Categoria de Produto". É a pasta raiz onde suas contas ficarão.</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex-shrink-0">
                                <Database className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">2. Cadastrar Itens</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Dentro do produto, adicione suas contas na aba de estoque. Cole logins/senhas ou listas completas.</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg flex-shrink-0">
                                <Search className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">3. Dar Baixa Rápida</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Vendeu? Basta buscar a conta e clicar no botão "Marcar como Vendido". O estoque baixa instantaneamente.</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3">
                            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg flex-shrink-0">
                                <Download className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">4. Backup de Segurança</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Vá nas configurações e faça Download do seu arquivo de Backup. Tudo roda offline e os dados nunca saem da sua máquina.</p>
                            </div>
                        </div>

                    </div>

                </div>

                {/* Footer */}
                <div className="p-5 sm:px-8 sm:py-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                            Não mostrar na inicialização
                        </span>
                    </label>

                    <button
                        onClick={handleClose}
                        className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                        Entendi!
                    </button>
                </div>

            </motion.div>
        </div>
    );
}
