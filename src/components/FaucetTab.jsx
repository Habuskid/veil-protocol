import { useState, useEffect } from 'react';
import { Contract } from 'ethers';
import { REGISTRY_ADDRESS, REGISTRY_ABI, ERC20_ABI } from '../config/addresses';
import localPairs from '../config/pairs.json';
import { BeakerIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function FaucetTab({ provider, signer, address, showToast, addTxHistory }) {
  const [loadingMap, setLoadingMap] = useState({});
  const [mockTokens, setMockTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const fetchPairs = async () => {
      setIsLoading(true);
      // 1. Fetch on-chain pairs
      let onChainPairs = [];
      if (provider) {
        try {
          const reg = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
          const pairs = await reg.getTokenConfidentialTokenPairs();
          onChainPairs = pairs.map(p => ({ erc20: p.tokenAddress || p.t, erc7984: p.confidentialTokenAddress || p.c }));
        } catch (e) { console.warn("Registry fetch failed", e); }
      }

      // 2. Combine with local config
      const combined = [...localPairs].filter(p => p.erc20 !== "0x0000000000000000000000000000000000000000");
      onChainPairs.forEach(op => {
        if (op.erc20 && !combined.find(c => c.erc20.toLowerCase() === op.erc20.toLowerCase())) {
          combined.push({ erc20: op.erc20, erc7984: op.erc7984, isOnChain: true });
        }
      });
      
      // Deduplicate by erc20 address
      const unique = [];
      const seen = new Set();
      for (const p of combined) {
        if (p.erc20 && !seen.has(p.erc20.toLowerCase())) {
          seen.add(p.erc20.toLowerCase());
          unique.push(p);
        }
      }
      
      const enriched = [];
      for (const p of unique) {
        if (!provider) {
          enriched.push({ ...p, symbol: 'mUSDC', isRestricted: false });
          continue;
        }
        try {
          const erc20 = new Contract(p.erc20, ERC20_ABI, provider);
          let sym = 'Token';
          try { sym = await erc20.symbol(); } catch(e) {}
          
          let isRestricted = false;
          const testAddress = address || "0x0000000000000000000000000000000000000000";
          try {
            await erc20.mint.staticCall(testAddress, 0, { from: testAddress });
          } catch (err) {
            isRestricted = true;
          }
          
          enriched.push({ ...p, symbol: sym, isRestricted });
        } catch (e) {
          enriched.push({ ...p, symbol: 'Token', isRestricted: true });
        }
      }
      
      // 4. Filter out spam tokens
      const validPairs = enriched.filter(p => {
        // If it was explicitly in local config, keep it
        const inLocal = localPairs.find(lp => lp.erc20.toLowerCase() === p.erc20.toLowerCase());
        if (inLocal) return true;
        
        // If it came purely from onChain, strictly filter to keep the UI clean
        const sym = p.symbol.toLowerCase();
        if (sym.includes('steak') || sym.includes('spam')) return false;
        if (p.symbol.startsWith('m') || p.symbol.startsWith('t') || p.symbol === 'ZAMA') return true;
        
        return false;
      });
      
      validPairs.sort((a, b) => {
        if (a.symbol === 'mUSDC') return -1;
        if (b.symbol === 'mUSDC') return 1;
        return 0;
      });
      
      setMockTokens(validPairs);
      setIsLoading(false);
    };
    fetchPairs();
  }, [provider, address]);

  const handleClaim = async (tokenAddress) => {
    if (!signer) return showToast("Please connect wallet", "error");
    
    setLoadingMap(prev => ({ ...prev, [tokenAddress]: true }));
    try {
      const erc20 = new Contract(tokenAddress, ERC20_ABI, signer);
      let hash = null;
      let amount = 0n;
      let symbol = 'mUSDC';
      try {
        const decimals = await erc20.decimals().catch(() => 6);
        symbol = await erc20.symbol().catch(() => 'mUSDC');
        amount = BigInt(1000) * BigInt(10 ** Number(decimals));
      } catch(e) {}

      try {
        const tx = await erc20.faucet(address, amount);
        await tx.wait();
        hash = tx.hash;
      } catch (e) {
        const tx = await erc20.mint(address, amount);
        await tx.wait();
        hash = tx.hash;
      }
      
      if (addTxHistory && hash) {
        addTxHistory({ type: 'Faucet Claim', hash, details: `Minted 1000 ${symbol}` });
      }
      showToast(`Successfully minted 1000 ${symbol}!`, "success");
    } catch (e) {
      console.error(e);
      showToast("Claim failed: " + (e.message || String(e)), "error");
    }
    setLoadingMap(prev => ({ ...prev, [tokenAddress]: false }));
  };

  return (
    <div className="flex flex-col items-center justify-start animate-fade-in pb-4 w-full">
      <div className="solid-card w-full max-w-lg p-6 text-center space-y-4">
        
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/10">
            <BeakerIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Testnet Faucet</h2>
          <p className="text-[#a1a1aa] text-sm max-w-sm mb-3">
            Claim 1,000 test tokens to test the wrapping process. You will need Sepolia ETH for gas.
          </p>
          
          <div className="text-xs text-left bg-blue-900/20 border border-blue-500/30 text-blue-200 p-3 rounded-lg mb-3 w-full">
            <p className="mb-1"><strong>ℹ️ Note on Mock vs Official Tokens:</strong></p>
            <p className="opacity-90 mb-1">
              The <strong>mocked</strong> wrappers wrap ERC-20 tokens deployed specifically for testing, with a public `mint()` function. The <strong>non-mocked</strong> wrappers wrap official testnet tokens with restricted minting permissions.
            </p>
            <a 
              href="https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia#wrappers-registry" 
              target="_blank" 
              rel="noreferrer" 
              className="text-blue-400 hover:text-blue-300 underline decoration-blue-500/50 underline-offset-2 transition-colors font-medium inline-flex items-center gap-1"
            >
              View Documentation Reference
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
          </div>

          <a href="https://sepoliafaucet.com" target="_blank" rel="noreferrer" className="text-xs text-white/50 hover:text-white transition-colors underline decoration-white/30 underline-offset-4">
            Need Sepolia ETH? Get some here &rarr;
          </a>
        </div>

        <div className="w-full pt-2">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-[56px] w-full bg-white/5 animate-pulse rounded-xl border border-white/10"></div>
              <div className="h-[56px] w-full bg-white/5 animate-pulse rounded-xl border border-white/10"></div>
            </div>
          ) : (
            mockTokens.length > 0 ? (() => {
              const pair = mockTokens[selectedIdx] || mockTokens[0];
              return (
                <div className="space-y-4">
                  <div className="relative w-full">
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="w-full bg-black/40 text-white rounded-xl p-4 outline-none focus:ring-1 focus:ring-white/30 border border-white/10 appearance-none font-medium text-center shadow-lg backdrop-blur-md"
            >
              {mockTokens.map((t, i) => (
                <option key={i} value={i} className="bg-[#1a1a1a]">
                  {t.symbol} {t.isRestricted ? '(Restricted)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          
          {mockTokens[selectedIdx]?.isRestricted && (
            <div className="text-xs text-[#d4d4d8] bg-[#27272a] border border-[#3f3f46] rounded-lg p-3 text-left shadow-sm">
              <span className="font-bold text-yellow-500">⚠️ Minting Restricted:</span> This token refuses public minting (it may be an official Zama restricted token or a third-party token). The faucet will likely fail.
            </div>
          )}
          {!mockTokens[selectedIdx]?.isRestricted ? (
            <button 
              className="btn-primary w-full py-4 text-base"
              onClick={() => handleClaim(pair.erc20)}
              disabled={loadingMap[pair.erc20]}
            >
              {loadingMap[pair.erc20] ? (
                <span className="flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Claiming...
                </span>
              ) : (
                `Claim 1000 ${pair.symbol}`
              )}
            </button>
          ) : (
            <button 
              className="btn-primary w-full py-4 text-base opacity-50 cursor-not-allowed bg-red-900/50 text-red-200 border-red-500/50 hover:shadow-none hover:bg-red-900/50"
              disabled={true}
            >
              Unavailable
            </button>
          )}
        </div>
              );
            })() : (
              <div className="text-[#52525b] text-sm font-medium">No mock tokens configured.</div>
            )
          )}
        </div>

      </div>
    </div>
  );
}
