const fs = require('fs');
const path = require('path');

function getS() {
    const custom = path.join(process.cwd(), 'storage_path.txt');
    if (fs.existsSync(custom)) {
        try {
            const p = fs.readFileSync(custom, 'utf8').trim();
            if (p && fs.existsSync(p)) return p;
        } catch (e) { }
    }
    return path.join(process.cwd(), 'data');
}

const dir = getS();
const sf = path.join(dir, 'settings.json');
if (fs.existsSync(sf)) {
    console.log("Found settings.json at", sf);
    const d = JSON.parse(fs.readFileSync(sf, 'utf8'));
    if (!d.general) d.general = {};
    const bg = d.general.backgroundImage;
    if (bg && bg.length > 500) {
        console.log('Cleared huge background! Size was: ' + bg.length);
        d.general.backgroundImage = '';
        fs.writeFileSync(sf, JSON.stringify(d, null, 2));
    } else {
        console.log('Background size is normal: ' + (bg ? bg.length : 'none'));
    }
} else {
    console.log('Settings file not found at ' + sf);
}
