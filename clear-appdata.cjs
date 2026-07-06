const fs = require('fs');
const os = require('os');
const path = require('path');

const p = path.join(os.homedir(), 'AppData', 'Roaming', 'deathStuffs_Data', 'settings.json');
if (fs.existsSync(p)) {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const l = d.general && d.general.backgroundImage ? d.general.backgroundImage.length : 0;
    console.log('Bg length in AppData:', l);
    if (l > 500) {
        d.general.backgroundImage = '';
        fs.writeFileSync(p, JSON.stringify(d, null, 2));
        console.log('CLEARED APPDATA!');
    }
} else {
    console.log('Not found:', p);
}
