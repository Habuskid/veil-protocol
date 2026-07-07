const fs = require('fs');
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
const pairs = JSON.parse(fs.readFileSync('src/config/pairs.json'));
const abi = ['function symbol() view returns (string)'];

async function run() {
  let md = '## Deployed Contracts (Sepolia)\n\n### Core Infrastructure\n- **WrappersRegistry:** `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`\n\n### Official Confidential Wrapper Pairs\n| Public Token (ERC-20) | Symbol | Confidential Wrapper (ERC-7984) | Wrapper Symbol |\n| --- | --- | --- | --- |\n';
  for(let p of pairs) {
    if(p.erc20 === '0x0000000000000000000000000000000000000000') continue;
    try {
      const c1 = new ethers.Contract(p.erc20, abi, provider);
      const s1 = await c1.symbol();
      const c2 = new ethers.Contract(p.erc7984, abi, provider);
      const s2 = await c2.symbol();
      md += `| \`${p.erc20}\` | **${s1}** | \`${p.erc7984}\` | **${s2}** |\n`;
    } catch(e) { }
  }
  fs.writeFileSync('contracts_table.md', md);
  console.log('done');
}
run();
