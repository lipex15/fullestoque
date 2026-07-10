const fs = require('fs');

async function run() {
    const version = require('./package.json').version;
    const token = process.env.GH_TOKEN;
    if (!token) throw new Error("GH_TOKEN is missing");

    console.log(`Getting Github releases to find v${version}`);
    const res = await fetch(`https://api.github.com/repos/lipex15/fullestoque/releases`, {
        headers: { 'Authorization': `token ${token}` }
    });
    const releases = await res.json();
    const release = releases.find(r => r.tag_name === `v${version}` || r.name === `v${version}`);

    if (!release) {
        console.error("Release not found", releases.map(r => ({ name: r.name, tag: r.tag_name })));
        return;
    }
    const releaseId = release.id;
    console.log(`Found release ID: ${releaseId}, preparing latest.yml`);

    // 1. Undraft it if it is a draft
    if (release.draft) {
        console.log("Release is a draft. Setting draft to false.");
        await fetch(`https://api.github.com/repos/lipex15/fullestoque/releases/${releaseId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ draft: false, tag_name: `v${version}` })
        });
    }

    const file = fs.readFileSync('dist-electron/latest.yml');

    // Delete existing latest.yml if present
    const existingAsset = release.assets.find(a => a.name === 'latest.yml');
    if (existingAsset) {
        console.log("Deleting old latest.yml");
        await fetch(`https://api.github.com/repos/lipex15/fullestoque/releases/assets/${existingAsset.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `token ${token}` }
        });
    }

    console.log("Uploading fresh latest.yml...");
    const uploadRes = await fetch(`https://uploads.github.com/repos/lipex15/fullestoque/releases/${releaseId}/assets?name=latest.yml`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/x-yaml'
        },
        body: file
    });

    const uploadData = await uploadRes.json();
    console.log("Uploaded successfully!", uploadData.name);
}

run();
