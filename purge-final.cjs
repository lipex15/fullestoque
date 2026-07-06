const fs = require('fs');
let code;

// 1. Delete unused files
if (fs.existsSync('src/components/WhatsAppConnector.tsx')) fs.unlinkSync('src/components/WhatsAppConnector.tsx');
if (fs.existsSync('src/components/NotificationCard.tsx')) fs.unlinkSync('src/components/NotificationCard.tsx');

// 2. Clear out settings panel
if (fs.existsSync('src/components/SettingsPanel.tsx')) {
    code = fs.readFileSync('src/components/SettingsPanel.tsx', 'utf8');

    // Remove props imports
    code = code.replace(/import WhatsAppConnector[^\n]+\n/, '');
    code = code.replace(/onTestDiscord: [^\n]+\n/, '');
    code = code.replace(/onTestWhatsApp: [^\n]+\n/, '');
    code = code.replace(/onDisconnectWhatsApp: [^\n]+\n/, '');
    code = code.replace(/onTriggerScanSim: [^\n]+\n/, '');

    // Remove props destructuring
    code = code.replace(/onTestDiscord, onTestWhatsApp, onDisconnectWhatsApp, onTriggerScanSim,/g, '');

    // Remove state settings that do not exist anymore
    code = code.replace(/discord: settings.discord || DEFAULT_SETTINGS.discord,\r?\n/, '');
    code = code.replace(/whatsapp: settings.whatsapp || DEFAULT_SETTINGS.whatsapp,\r?\n/, '');

    // Regex out the tabs for discord and whatsapp
    code = code.replace(/<button[^>]+onClick=\{\(\) => setActiveConfig\('discord'\)\}[^>]+>[\s\S]*?<\/button>/m, '');
    code = code.replace(/<button[^>]+onClick=\{\(\) => setActiveConfig\('whatsapp'\)\}[^>]+>[\s\S]*?<\/button>/m, '');

    // We should just use string split to erase the Discord and Whatsapp settings blocks:
    const splitD = code.indexOf("{/* DISCORD CONFIGURATION */}");
    let splitE;
    if (splitD > -1) {
        splitE = code.indexOf("{/* GENERAL / AUTO-UPDATER CONFIGURATION */}");
        if (splitE > -1) {
            code = code.slice(0, splitD) + code.slice(splitE);
        }
    }

    // Remove local states
    code = code.replace(/const \[discordTesting.*?\n/, '');
    code = code.replace(/const \[whatsappTesting.*?\n/, '');

    fs.writeFileSync('src/components/SettingsPanel.tsx', code, 'utf8');
}

// 3. Clear App.tsx
if (fs.existsSync('src/App.tsx')) {
    code = fs.readFileSync('src/App.tsx', 'utf8');

    // Remove missing props injected into SettingsPanel
    code = code.replace(/onTestDiscord=\{.*\}/, '');
    code = code.replace(/onTestWhatsApp=\{.*\}/, '');
    code = code.replace(/onDisconnectWhatsApp=\{.*\}/, '');
    code = code.replace(/onTriggerScanSim=\{.*\}/, '');

    // Fix imports from types
    code = code.replace(/NotificationPlatform, NotificationPriority, NotificationCategory, NotificationStatus, ResolutionStatus/g, '');

    fs.writeFileSync('src/App.tsx', code, 'utf8');
}

// 4. Server.ts missing fixes
if (fs.existsSync('server.ts')) {
    code = fs.readFileSync('server.ts', 'utf8');
    code = code.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: "status_discord".*\n/g, '');
    code = code.replace(/res\.write\(`data: \$\{JSON\.stringify\(\{ type: "status_whatsapp".*\n/g, '');
    fs.writeFileSync('server.ts', code, 'utf8');
}
