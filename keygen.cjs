const crypto = require('crypto');
const fs = require('fs');

const SECRET_KEY = "global_stock_deathzin_offline_master_secret_key_v1"; // MUST MATCH SERVER!

function generateKey(durationDays) {
    const payload = {
        type: durationDays === 'permanent' ? 'permanent' : 'duration',
        expiresAt: durationDays === 'permanent' ? null : Date.now() + (durationDays * 24 * 60 * 60 * 1000),
        issuedAt: Date.now()
    };

    const dataBuffer = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Create signature
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(dataBuffer);
    const signature = hmac.digest('hex');

    // Combine to form the key
    const rawKey = `${dataBuffer}.${signature}`;

    // Obfuscate slightly to make it look like a standard serial key
    const b64Key = Buffer.from(rawKey).toString('base64').replace(/=/g, '');

    // Format into XXXX-XXXX-XXXX-XXXX
    const chunks = b64Key.match(/.{1,6}/g).slice(0, 5).map(c => c.toUpperCase());
    const finalKey = `GS-${chunks.join('-')}`;

    console.log('\n=======================================');
    console.log(`[GLOBAL STOCK] NOVA KEY GERADA!`);
    console.log(`Duração: ${durationDays === 'permanent' ? 'VITALÍCIA' : durationDays + ' Dias'}`);
    console.log(`\nKEY: ${finalKey}`);
    console.log(`\nPAYLOAD RAW PARA O APP: ${rawKey}`);
    console.log('=======================================\n');

    // We append the rawKey into a local ledger so the user doesn't lose it
    fs.appendFileSync('keys_geradas.txt', `[${new Date().toLocaleString()}] Duração: ${durationDays} -> ${rawKey}\n`);

    return rawKey;
}

// Simple CLI
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log("Uso: node keygen.cjs <dias ou 'permanent'>");
    console.log("Exemplo 1: node keygen.cjs 30");
    console.log("Exemplo 2: node keygen.cjs permanent");
    process.exit(1);
}

const duration = args[0] === 'permanent' ? 'permanent' : parseInt(args[0]);
generateKey(duration);
