const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove unnecessary imports
code = code.replace(/import NotificationCard from '.\/components\/NotificationCard';\r?\n/, '');
code = code.replace(/import WhatsAppConnector from '.\/components\/WhatsAppConnector';\r?\n/, '');

// 2. Fix activeTab state
code = code.replace(
    "const [activeTab, setActiveTab] = useState<'painel' | 'config' | 'logs' | 'estoque'>('painel');",
    "const [activeTab, setActiveTab] = useState<'config' | 'estoque'>('estoque');"
);

// 3. Delete simulator and Painel (Lines ~810 to 1157)
const mainBodyStart = code.indexOf('{/* --- DYNAMIC WEB WEBHOOK SIMULATOR PLAYGROUND BAR (EXCELLENT FOR TESTING!) --- */}');
const settingsTabStart = code.indexOf("{/* TAB 3: SETTINGS MANAGER */}");
if (mainBodyStart > -1 && settingsTabStart > -1) {
    code = code.slice(0, mainBodyStart) + code.slice(settingsTabStart);
}

// 4. Delete Logs tab
const logsTabStart = code.indexOf("{/* TAB 4: HISTORIC LOGS LIST */}");
const estoqueTabStart = code.indexOf("{/* TAB 5: ESTOQUE PANEL */}");
if (logsTabStart > -1 && estoqueTabStart > -1) {
    code = code.slice(0, logsTabStart) + code.slice(estoqueTabStart);
}

// 5. Update Desktop navigation
const navStart = code.indexOf('<nav className="hidden md:flex items-center gap-1.5">');
const navEnd = code.indexOf('</nav>');
if (navStart > -1 && navEnd > -1) {
    const newNav = `<nav className="hidden md:flex items-center gap-1.5">
          <button
            id="nav-estoque"
            onClick={() => { setActiveTab('estoque'); setGlobalStockSearch(''); }}
            className={\`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer \${activeTab === 'estoque'
              ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }\`}
          >
            Estoque / Contas
          </button>

          <button
            id="nav-config"
            onClick={() => { setActiveTab('config'); setGlobalStockSearch(''); }}
            className={\`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer \${activeTab === 'config'
              ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }\`}
          >
            Configurações
          </button>
        </nav>`;
    code = code.slice(0, navStart) + newNav + code.slice(navEnd + 6);
}

// 6. Delete unwanted states and fetch functions
code = code.replace(/const \[notifications, setNotifications\] = useState<NotificationItem\[\]>\(\[\]\);\r?\n/, '');
code = code.replace(/const \[showSimulator, setShowSimulator\] = useState.*?\n/, '');

// Delete all filters state
// This uses a dirty regex but it's effective for lines starting with const [filter or const [sortBy
code = code.replace(/const \[filter[^\n]+\n/g, '');
code = code.replace(/const \[sortBy[^\n]+\n/g, '');
code = code.replace(/const \[showFilters[^\n]+\n/g, '');

// 7. Remove discord and whatsapp from systemStatus init
code = code.replace(/discord: { connected: false, botUser: null, statusText: 'Desconectado' },\r?\n/, '');
code = code.replace(/whatsapp: { status: 'desconectado', qrCode: null, statusText: 'Desconectado' },\r?\n/, '');

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log('App.tsx refactored successfully.');
