const fs = require('fs');

let settingsCode = fs.readFileSync('src/components/SettingsPanel.tsx', 'utf8');
settingsCode = settingsCode.replace(/onTestDiscord,\s*\n\s*onTestWhatsApp,\s*\n\s*onDisconnectWhatsApp,\s*\n/g, '');
fs.writeFileSync('src/components/SettingsPanel.tsx', settingsCode, 'utf8');


let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/import \{.*?NotificationItem.*?\} from '\.\/types';/g, "import { AppSettings, SystemStatus, LiveLog, DEFAULT_SETTINGS } from './types';");

// Remove function blocks by regex
appCode = appCode.replace(/const fetchNotifications = async \(\) => \{[\s\S]*?catch \(e\) \{[\s\S]*?\}\s*\};\s*/, '');
appCode = appCode.replace(/const handleUpdateNotification = async [\s\S]*?catch \(e\) \{[\s\S]*?\}\s*\};\s*/, '');
appCode = appCode.replace(/const handleDeleteNotification = async [\s\S]*?catch \(e\) \{[\s\S]*?\}\s*\};\s*/, '');
appCode = appCode.replace(/const handleClearDatabase = async [\s\S]*?catch \(e\) \{[\s\S]*?\}\s*\};\s*\};/, '');
appCode = appCode.replace(/const handleTriggerSimulation = async [\s\S]*?catch \(e\) \{[\s\S]*?\}\s*\};\s*/, '');

appCode = appCode.replace(/const fetchNotifications.*?\n/g, '');
appCode = appCode.replace(/fetchNotifications\(\);\n/g, '');


// Remove specific lines in App.tsx
appCode = appCode.replace(/else if \(type === 'notifications_refresh'\) \{[\s\S]*?\}\s*/g, '');
appCode = appCode.replace(/else if \(type === 'notification_new'\) \{[\s\S]*?\}\s*\} else if \(type === 'warranty_alert'/g, "else if (type === 'warranty_alert'");

// Strip statistics and filters block
appCode = appCode.split('// --- STATISTICS COMPUTING ---')[0] +
    '// --- END COMPUTE ---\n' +
    appCode.substring(appCode.indexOf('return ('));

appCode = appCode.replace(/notifications=\{notifications\}\n/g, '');
appCode = appCode.replace(/onUpdateNotification=\{handleUpdateNotification\}\n/g, '');
appCode = appCode.replace(/onClearDatabase=\{handleClearDatabase\}\n/g, '');


fs.writeFileSync('src/App.tsx', appCode, 'utf8');
console.log('App and Settings fixed!');
