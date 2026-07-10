import React, { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';

interface AuthLockProps {
    onUnlock: () => void;
}

export default function AuthLock({ onUnlock }: AuthLockProps) {
    const [loading, setLoading] = useState(true);
    const [licenseKey, setLicenseKey] = useState('');
    const [activating, setActivating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [hwid, setHwid] = useState('');

    useEffect(() => {
        checkLicense();
    }, []);

    const checkLicense = async () => {
        try {
            const res = await fetch('/api/system/license');
            const data = await res.json();

            if (data.status === 'licensed') {
                onUnlock();
            } else {
                setHwid(data.hwid || '');
                if (data.status === 'expired') {
                    setErrorMsg('Sua licença expirou.');
                } else if (data.reason === 'hwid_mismatch') {
                    setErrorMsg('Licença vinculada a outra máquina.');
                }
                setLoading(false);
            }
        } catch (e) {
            setLoading(false);
            setErrorMsg('Falha ao conectar com o validador.');
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim()) return;

        setActivating(true);
        setErrorMsg('');

        try {
            const res = await fetch('/api/system/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: licenseKey })
            });
            const data = await res.json();

            if (data.success) {
                checkLicense();
            } else {
                setErrorMsg(data.message || 'Chave inválida ou recusada.');
            }
        } catch (e) {
            setErrorMsg('Falha de conexão.');
        } finally {
            setActivating(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex items-center justify-center z-50">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 z-50">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">

                <div className="mx-auto w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="w-8 h-8" />
                </div>

                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Global Stock Restrito
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                    Nenhuma licença ativa encontrada no sistema. Por favor, insira uma Security KEY válida para acessar o painel.
                </p>

                <form onSubmit={handleActivate} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Cole sua credencial JWT..."
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-mono break-all"
                        />
                    </div>

                    {errorMsg && (
                        <p className="text-xs text-rose-500 font-semibold">{errorMsg}</p>
                    )}

                    <button
                        type="submit"
                        disabled={activating || !licenseKey.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {activating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <KeyRound className="w-5 h-5 transition-transform group-hover:rotate-12" />
                                Validar Licença
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-1.5 flex justify-center items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Machine Trace ID
                    </p>
                    <code className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-950 rounded border dark:border-slate-800 text-slate-600 dark:text-slate-500 block">
                        {hwid || '...'}
                    </code>
                </div>

            </div>
        </div>
    );
}
