const token = process.env.GH_TOKEN;
const repo = 'lipex15/fullestoque';
const version = require('./package.json').version;

fetch(`https://api.github.com/repos/${repo}/releases`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        tag_name: `v${version}`,
        name: `v${version}`,
        draft: false,
        prerelease: false,
        body: [
            'Atualizacao estavel do Global Stock.',
            '',
            '- Nova area de Assinaturas Game Pass separada por GGMAX e GameMarket.',
            '- Cadastro de cliente, chat, produto, datas, observacoes e renovacao.',
            '- Alertas locais no app/PC para assinaturas vencendo ou vencidas.',
            '- Backup continua incluindo o banco completo do estoque e das assinaturas.'
        ].join('\n')
    })
}).then(async res => {
    if (!res.ok) {
        console.log('Release probably already exists or failed:', await res.text());
    } else {
        console.log('Created release tag ' + version);
    }
}).catch(console.error);
