const fs = require('fs');
const os = require('os');
const path = require('path');

const paths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'deathStuffs_Data', 'settings.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'deathStuffs', 'settings.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'deathStuffs', 'data', 'settings.json'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'deathStuffs', 'data', 'settings.json'),
    path.join(os.homedir(), 'AppData', 'Local', 'deathStuffs', 'data', 'settings.json'),
    path.join('C:', 'Program Files', 'deathStuffs', 'data', 'settings.json')
];

let cleared = 0;
for (const sf of paths) {
    if (fs.existsSync(sf)) {
        console.log('Found:', sf);
        try {
            const d = JSON.parse(fs.readFileSync(sf, 'utf8'));
            const l = d.general && d.general.backgroundImage ? d.general.backgroundImage.length : 0;
            if (l > 300) {
                d.general.backgroundImage = '';
                fs.writeFileSync(sf, JSON.stringify(d, null, 2));
                console.log('CLEARED => ', sf);
                cleared++;
            } else {
                console.log('Normal length:', l);
            }
        } catch (e) {
            console.error('Failed processing', sf, e);
        }
    }
}
console.log('Total files cleared:', cleared);
