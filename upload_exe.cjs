const fs = require('fs');
const path = require('path');

const version = require('./package.json').version;
const exePath = path.join(__dirname, 'dist-electron', `deathStuffs Setup ${version}.exe`);

if (!fs.existsSync(exePath)) {
    console.error('Exe file not found at', exePath);
    process.exit(1);
}

const token = process.env.GH_TOKEN;
if (!token) {
    console.error('No GH_TOKEN provided');
    process.exit(1);
}

const repo = 'lipex15/brain';

async function upload() {
    console.log('Fetching release for v' + version);
    const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/v${version}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!releaseRes.ok) {
        console.error('Could not find release', await releaseRes.text());
        process.exit(1);
    }

    const release = await releaseRes.json();
    const uploadUrl = release.upload_url.split('{')[0];

    const fileName = `deathStuffs-Setup-${version}.exe`;

    // Find and delete any existing asset with the same name (prevents 422 already_exists block)
    const assetsRes = await fetch(release.assets_url, { headers: { 'Authorization': `Bearer ${token}` } });
    const assets = await assetsRes.json();
    const existingExe = assets.find(a => a.name === fileName);
    if (existingExe) {
        console.log(`Found existing phantom asset ${existingExe.id}. Deleting...`);
        await fetch(existingExe.url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        console.log('Deleted existing asset.');
    }

    console.log(`Uploading ${fileName} to release ID: ${release.id}...`);

    const stat = fs.statSync(exePath);
    const stream = fs.createReadStream(exePath);

    // Note: undici fetch in recent node supports passing ReadStream as body for large files
    const res = await fetch(`${uploadUrl}?name=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': stat.size.toString()
        },
        body: stream,
        duplex: 'half'
    });

    if (!res.ok) {
        console.error('Failed to upload', res.status, await res.text());
        process.exit(1);
    }

    console.log('Successfully uploaded EXE!');
}

upload().catch(console.error);
