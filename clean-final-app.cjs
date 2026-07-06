const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Fix the `useEffect` brace problem!
appCode = appCode.replace(
    /return \(\) => \{\s*clearInterval\(warrantyInterval\);\s*window\.removeEventListener\('stock_refresh', handleStockRefresh\);\s*if \(sseRef\.current\) \{\s*sseRef\.current\.close\(\);\s*\}\s*\};\s*\}, \[settings\.general/g,
    `return () => {
      clearInterval(warrantyInterval);
      window.removeEventListener('stock_refresh', handleStockRefresh);
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [settings.general`
);

// 2. Remove computing logic safely.
const statsStart = appCode.indexOf('// --- STATISTICS COMPUTING ---');
const returnStart = appCode.indexOf('  return (\n    <div\n');
if (statsStart > -1 && returnStart > -1) {
    appCode = appCode.slice(0, statsStart) + appCode.slice(returnStart);
}

// 3. Remove leftover empty handlers from previous script that causes unused vars
appCode = appCode.replace(/const handleClearDatabase([^\n]+) \{[\s\S]*?\};\s*\}\s*\};/g, ''); // the previous script broke this

// Clean the actual function definitions using specific lines:
const simTriggers = appCode.indexOf('// --- SIMULATION TRIGGERS ---');
const statsComp = appCode.indexOf('// --- STATISTICS COMPUTING ---'); // Should be -1 since we sliced it above, but just in case
if (simTriggers > -1) {
    appCode = appCode.slice(0, simTriggers) + appCode.slice(returnStart > -1 ? returnStart : simTriggers);
}

const clearDBString = `const handleClearDatabase = async () => {
    if (confirm('Tem certeza absoluta que deseja LIMPAR TODAS as notificações registradas? Esta ação não pode ser desfeita.')) {
      try {
        const res = await fetch('/api/notifications/clear', { method: 'POST' });
        if (res.ok) {
          setNotifications([]);
        }
      } catch (e) {
        console.error('Error clearing DB:', e);
      }
    }
  };`;
appCode = appCode.replace(clearDBString, '');

// Strip the end brackets in the file if they are dangling?
// It was `946 }` syntax error because it had an extra `}`.
if (appCode.endsWith('}\r\n}\r\n') || appCode.endsWith('}\n}\n') || appCode.endsWith('}\n}')) {
    appCode = appCode.slice(0, appCode.lastIndexOf('}'));
}

fs.writeFileSync('src/App.tsx', appCode, 'utf8');
console.log('App.tsx final trim done!');
