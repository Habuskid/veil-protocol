import { useState, useEffect } from 'react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import { REGISTRY_ADDRESS, REGISTRY_ABI, ERC20_ABI, ERC7984_ABI, WRAPPER_ABI } from '../config/addresses';
import localPairs from '../config/pairs.json';
import { ArrowPathIcon, LockClosedIcon, LockOpenIcon, EyeIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { getFhevmInstance, decryptFhevm, encryptFhevm } from '../lib/zama';
import { Interface, hexlify, getAddress } from 'ethers';

export default function RegistryTab({ provider, signer, address, fhevmReady, showToast, addTxHistory }) {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [modes, setModes] = useState({}); // idx -> 'wrap' | 'unwrap'
  const [balances, setBalances] = useState({}); // idx -> { plain: '0', confidential: null }
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (provider && address) loadPairs();
  }, [provider, address]);

  const loadPairs = async () => {
    setLoading(true);
    try {
      // 1. Fetch on-chain pairs
      let onChainPairs = [];
      try {
        const reg = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        const pairs = await reg.getTokenConfidentialTokenPairs();
        onChainPairs = pairs.map(p => ({ erc20: p.tokenAddress || p.t, erc7984: p.confidentialTokenAddress || p.c }));
      } catch (e) { console.warn("Registry fetch failed, falling back to local only", e); }

      // 2. Combine with local config
      const combined = [...localPairs].filter(p => p.erc20 !== "0x0000000000000000000000000000000000000000");
      onChainPairs.forEach(op => {
        if (op.erc20 && !combined.find(c => c.erc20.toLowerCase() === op.erc20.toLowerCase())) {
          combined.push({ erc20: op.erc20, erc7984: op.erc7984, isOnChain: true });
        }
      });
      
      const uniquePairs = [];
      const seen = new Set();
      for (const p of combined) {
        if (!p.erc20) continue;
        const key = p.erc20.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniquePairs.push(p);
        }
      }
      
      // 3. Process pairs sequentially to avoid RPC rate limits on public nodes
      const enrichedPairs = [];
      for (const pair of uniquePairs) {
        try {
          const erc20 = new Contract(pair.erc20, ERC20_ABI, provider);
          const erc7984 = new Contract(pair.erc7984, ERC7984_ABI, provider);
          
          let erc20Sym = 'Token';
          let erc7984Sym = 'cToken';
          let erc20Dec = 18;
          let erc7984Dec = 18;
          let isRestricted = false;
          
          try { erc20Sym = await erc20.symbol(); } catch (e) {}
          try { erc7984Sym = await erc7984.symbol(); } catch (e) {}
          try { erc20Dec = await erc20.decimals(); } catch (e) {}
          try { erc7984Dec = await erc7984.decimals(); } catch (e) {}
          
          const testAddress = address || "0x0000000000000000000000000000000000000000";
          try {
            await erc20.mint.staticCall(testAddress, 0, { from: testAddress });
          } catch (err) {
            isRestricted = true;
          }
          
          enrichedPairs.push({ ...pair, erc20Sym, erc20Dec, erc7984Sym, erc7984Dec, isRestricted });
        } catch (e) {
          // Graceful fallback if contract creation fails entirely
          enrichedPairs.push({ ...pair, erc20Sym: 'Token', erc20Dec: 18, erc7984Sym: 'cToken', erc7984Dec: 18, isRestricted: true });
        }
      }
      
      // 4. Filter out spam tokens but keep official ones
      const validPairs = enrichedPairs.filter(p => {
        // If it was explicitly in local config, always keep it
        const inLocal = localPairs.find(lp => lp.erc20.toLowerCase() === p.erc20.toLowerCase());
        if (inLocal) return true;
        
        // If it came purely from onChain, strictly filter to keep the UI clean
        const sym = p.erc20Sym.toLowerCase();
        if (sym.includes('steak') || sym.includes('spam')) return false;
        if (p.erc20Sym.startsWith('m') || p.erc20Sym.startsWith('t') || p.erc20Sym === 'ZAMA') return true;
        
        return false;
      });
      validPairs.sort((a, b) => {
        if (a.erc20Sym === 'mUSDC') return -1;
        if (b.erc20Sym === 'mUSDC') return 1;
        return 0;
      });
      setPairs(validPairs);

      const newBalances = { ...balances };
      for (let i = 0; i < validPairs.length; i++) {
        const p = validPairs[i];
        const erc20 = new Contract(p.erc20, ERC20_ABI, provider);
        const bal = await erc20.balanceOf(address);
        newBalances[i] = { 
          plain: formatUnits(bal, p.erc20Dec), 
          confidential: balances[i]?.confidential || null 
        };
      }
      setBalances(newBalances);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const executeAction = async (pair, index, isWrap) => {
    if (!signer) return showToast("Please connect wallet", "error");
    const modeStr = isWrap ? 'wrap' : 'unwrap';
    const amountStr = amounts[`${modeStr}-${index}`];
    if (!amountStr || isNaN(amountStr)) return showToast("Invalid amount", "error");
    
    setActionLoading(`${modeStr}-${index}`);
    // Yield to the browser so React can immediately paint the loading spinner
    await new Promise(r => setTimeout(r, 10));
    
    const oldPlainBalance = balances[index]?.plain || '0';
    
    try {
      // The amount to approve on the ERC20 token uses the underlying decimals
      const erc20Amount = parseUnits(amountStr, pair.erc20Dec);
      // The amount to pass to the wrapper contract uses the wrapper's decimals (e.g. 6)
      const wrapperAmount = parseUnits(amountStr, pair.erc7984Dec);
      
      const wrapper = new Contract(pair.erc7984, WRAPPER_ABI, signer);
      
      if (isWrap) {
        const erc20 = new Contract(pair.erc20, ERC20_ABI, signer);
        const allowance = await erc20.allowance(address, pair.erc7984);
        if (allowance < erc20Amount) {
          const approveTx = await erc20.approve(pair.erc7984, erc20Amount);
          await approveTx.wait();
        }
        
        let tx;
        try {
          // Older wrappers use wrap(uint64)
          tx = await wrapper["wrap(uint64)"](wrapperAmount);
        } catch (e) {
          if (e.code === 'CALL_EXCEPTION' || e.code === 'INVALID_ARGUMENT' || e.message.includes('missing revert data') || e.message.includes('require(false)')) {
            // Newer wrappers use wrap(address,uint256) and take the underlying amount
            tx = await wrapper["wrap(address,uint256)"](address, erc20Amount);
          } else {
            throw e;
          }
        }
        await tx.wait();
        if (addTxHistory) addTxHistory({ type: 'Wrap', hash: tx.hash, details: `Wrapped ${amountStr} ${pair.erc20Sym}` });
        
        // Optimistically update both balances for seamless UX
        setBalances(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            plain: String(Math.max(0, Number(prev[index].plain) - Number(amountStr))),
            confidential: prev[index].confidential !== null ? String(Number(prev[index].confidential) + Number(amountStr)) : null
          }
        }));
        
        showToast("Successfully wrapped!", "success");
      } else {
        let tx;
        try {
          // Attempt the ERC7984 2-step unwrap:
          // 1. Encrypt the wrapper amount into a FHE ciphertext
          showToast("Encrypting unwrap amount...", "info");
          const instance = getFhevmInstance();
          if (!instance) throw new Error("FHEVM not initialized");
          
          const safeContractAddress = getAddress(pair.erc7984);
          const safeUserAddress = getAddress(address);
          const enc = await instance.createEncryptedInput(safeContractAddress, safeUserAddress).add64(wrapperAmount).encrypt();
          const encHandle = hexlify(enc.handles[0]);
          const inputProof = hexlify(enc.inputProof);
          
          showToast("Requesting unwrap...", "info");
          // Send unwrap request
          const utx = await wrapper["unwrap(address,address,bytes32,bytes)"](address, address, encHandle, inputProof);
          const receipt = await utx.wait();
          
          // Parse UnwrapRequested to find the requestId and amountHandle
          const iface = new Interface(["event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)"]);
          let requestId = "";
          let amountHandle = "";
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
              if (parsed && parsed.name === "UnwrapRequested") {
                requestId = parsed.args.unwrapRequestId;
                amountHandle = parsed.args.amount;
                break;
              }
            } catch (e) {}
          }
          
          if (!requestId || !amountHandle) {
            throw new Error("UnwrapRequested event not found in transaction logs");
          }
          
          showToast("Public-decrypting unwrap amount via KMS...", "info");
          const pd = await instance.publicDecrypt([amountHandle]);
          
          const rawCleartext = pd.clearValues[amountHandle] ?? Object.values(pd.clearValues)[0];
          const cleartext = BigInt(rawCleartext);
          
          showToast("Finalizing unwrap on-chain...", "info");
          tx = await wrapper.finalizeUnwrap(requestId, cleartext, pd.decryptionProof);
          await tx.wait();
          
        } catch (e) {
          if (e.code === 'CALL_EXCEPTION' || e.message.includes('missing revert data')) {
            // Fallback for simple synchronous or Gateway unwraps if it's NOT an ERC7984 wrapper
            try {
              tx = await wrapper["unwrap(uint64)"](wrapperAmount);
              await tx.wait();
            } catch (err2) {
              try {
                 tx = await wrapper["unwrap(uint256)"](wrapperAmount);
                 await tx.wait();
              } catch (err3) {
                 tx = await wrapper["unwrap(address,uint256)"](address, erc20Amount);
                 await tx.wait();
              }
            }
          } else {
            throw e;
          }
        }
        
        if (addTxHistory) addTxHistory({ type: 'Unwrap', hash: tx?.hash, details: `Unwrapped ${amountStr} ${pair.erc20Sym}` });
        
        // Optimistically update both balances for seamless UX
        setBalances(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            plain: String(Number(prev[index].plain) + Number(amountStr)),
            confidential: prev[index].confidential !== null ? String(Math.max(0, Number(prev[index].confidential) - Number(amountStr))) : null
          }
        }));
        
        showToast("Successfully unwrapped!", "success");
      }
      
      setAmounts({ ...amounts, [`${modeStr}-${index}`]: '' });
      
      // SUCCESS path: keep the button in a 'syncing' state while we wait for the RPC to officially index the transaction
      setActionLoading(`syncing-${index}`);
      
      const pollRpc = async () => {
        try {
          const erc20 = new Contract(pair.erc20, ERC20_ABI, provider);
          let attempts = 0;
          while (attempts < 10) {
            await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds between polls
            const newRaw = await erc20.balanceOf(address);
            const newPlain = formatUnits(newRaw, pair.erc20Dec);
            // Break if the blockchain balance has successfully moved away from the old pre-transaction balance
            if (newPlain !== oldPlainBalance) {
              break; 
            }
            attempts++;
          }
        } catch(e) {
          console.error("Polling error:", e);
        }
        
        await loadPairs();
        setActionLoading(null);
      };
      
      pollRpc();
      return;
      
    } catch (e) {
      console.error(e);
      showToast(`${isWrap ? 'Wrap' : 'Unwrap'} failed: ` + (e.message || String(e)), "error");
    }
    setActionLoading(null);
  };

  const handleDecrypt = async (pair, index) => {
    if (!signer || !address) return showToast("Please connect wallet", "error");
    if (!fhevmReady) return showToast("FHEVM is still initializing...", "info");

    setActionLoading(`decrypt-${index}`);
    try {
      const contract = new Contract(pair.erc7984, ERC7984_ABI, signer);
      let balanceHandle;
      try {
        balanceHandle = await contract.confidentialBalanceOf(address);
      } catch (e) {
        balanceHandle = await contract.balanceOf(address);
      }
      
      const decrypted = await decryptFhevm(pair.erc7984, address, provider, balanceHandle);
      
      setBalances(prev => ({
        ...prev,
        [index]: { ...prev[index], confidential: formatUnits(decrypted, pair.erc7984Dec) }
      }));
      showToast("Balance decrypted successfully!", "success");
    } catch (e) {
      console.error(e);
      const msg = e.message || String(e);
      if (msg.includes("not authorized to user decrypt handle") || msg.includes("Unknown FheType") || msg.includes("is invalid")) {
        showToast("Error: Invalid handle. This address appears to be a plaintext ERC-20, not a Confidential Wrapper.", "error");
      } else {
        showToast("Decryption failed: " + msg, "error");
      }
    }
    setActionLoading(null);
  };

  return (
    <div className="flex flex-col items-center justify-start animate-fade-in pb-4 w-full">
      {pairs.length === 0 && !loading && (
        <div className="solid-card text-center text-[#737373] py-12 w-full max-w-md">
          No pairs found. Add pairs to config/pairs.json.
        </div>
      )}

      {loading && pairs.length === 0 && (
        <div className="w-full max-w-xl flex flex-col items-center animate-pulse">
          <div className="h-[20px] w-32 bg-white/5 rounded-full mb-3"></div>
          <div className="h-[56px] w-full bg-white/5 rounded-xl border border-white/10 mb-6"></div>
          <div className="h-[400px] w-full bg-white/5 rounded-xl border border-white/10"></div>
        </div>
      )}

      {pairs.length > 0 && (
        <div className="w-full max-w-lg mb-4">
          <div className="text-center text-white/60 text-xs font-bold tracking-widest uppercase mb-3 flex items-center justify-center gap-2">
            <span>ERC-20</span>
            <span>↔</span>
            <span>ERC-7984</span>
          </div>
          <div className="relative">
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="w-full bg-black/40 text-white rounded-xl p-4 outline-none focus:ring-1 focus:ring-white/30 border border-white/10 appearance-none font-medium text-center shadow-lg backdrop-blur-md"
            >
              {pairs.map((p, i) => (
                <option key={i} value={i} className="bg-[#1a1a1a]">
                  {p.erc20Sym} ↔ {p.erc7984Sym} {p.isRestricted ? '(Restricted)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      )}

      {pairs.length > 0 && (() => {
        const idx = selectedIdx;
        const pair = pairs[idx];
        if (!pair) return null;
        
        const mode = modes[idx] || 'wrap';
        const bal = balances[idx] || { plain: '0', confidential: null };
        const isWrap = mode === 'wrap';
        const actionStr = isWrap ? 'wrap' : 'unwrap';
        const isSyncing = actionLoading === `syncing-${idx}`;
        const isLoading = actionLoading === `${actionStr}-${idx}` || isSyncing;

        return (
          <div key={idx} className="solid-card w-full max-w-lg flex flex-col relative overflow-visible mb-4 p-6">
            
            {/* Action Toggle - Minimalist switch */}
            <div className="flex justify-center mb-5">
              <div className="bg-black/40 p-1 rounded-full flex border border-white/10 w-full sm:w-64 relative backdrop-blur-md">
                <div 
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full transition-transform duration-300 ease-out shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                  style={{ transform: isWrap ? 'translateX(0)' : 'translateX(100%)', left: '4px' }}
                />
                <button 
                  className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold z-10 transition-colors duration-300 ${isWrap ? 'text-black' : 'text-[#a1a1aa] hover:text-white'}`}
                  onClick={() => setModes({ ...modes, [idx]: 'wrap' })}
                >
                  Wrap
                </button>
                <button 
                  className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold z-10 transition-colors duration-300 ${!isWrap ? 'text-black' : 'text-[#a1a1aa] hover:text-white'}`}
                  onClick={() => setModes({ ...modes, [idx]: 'unwrap' })}
                >
                  Unwrap
                </button>
              </div>
            </div>

            {/* Balances Display - High contrast monochrome */}
            <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
                    <span className="text-xs text-black font-bold">{pair.erc20Sym.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{pair.erc20Sym}</span>
                </div>
                <span className="font-mono text-white text-lg">{bal.plain}</span>
              </div>
              
              <div className="h-px bg-white/10 w-full my-4"></div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#333] flex items-center justify-center">
                    <span className="text-xs text-white font-bold">{pair.erc7984Sym.charAt(0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{pair.erc7984Sym}</span>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(pair.erc7984); showToast("Confidential Wrapper Address Copied!", "success"); }}
                      className="text-white/40 hover:text-white transition-colors"
                      title="Copy Wrapper Address to paste in Decrypt Tab"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {bal.confidential !== null ? (
                  <span className="font-mono text-white text-lg font-bold">{bal.confidential}</span>
                ) : (
                  <button 
                    onClick={() => handleDecrypt(pair, idx)}
                    disabled={actionLoading === `decrypt-${idx}`}
                    className="text-xs flex items-center gap-1.5 bg-[#262626] text-white hover:bg-[#333] px-3 py-1.5 rounded-full transition-colors border border-white/10 font-medium"
                  >
                    {actionLoading === `decrypt-${idx}` ? (
                      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <EyeIcon className="w-3.5 h-3.5" />
                    )}
                    Reveal
                  </button>
                )}
              </div>
            </div>

            {/* Input & Action */}
            <div className="space-y-4 relative">
              <div className="relative">
                <input 
                  type="text" 
                  className="input-solid w-full text-center text-2xl font-light py-4" 
                  placeholder="0.0" 
                  value={amounts[`${actionStr}-${idx}`] || ''}
                  onChange={(e) => setAmounts({ ...amounts, [`${actionStr}-${idx}`]: e.target.value })}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737373] font-semibold uppercase tracking-wider text-sm">
                  {isWrap ? pair.erc20Sym : pair.erc7984Sym}
                </div>
              </div>

              <button 
                className="btn-primary w-full py-4 text-base"
                onClick={() => executeAction(pair, idx, isWrap)}
                disabled={isLoading || !signer}
              >
                {isWrap ? <LockClosedIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
                {isSyncing ? 'Syncing...' : (isLoading ? 'Processing...' : (isWrap ? 'Wrap to Confidential' : 'Unwrap to Plain'))}
              </button>
            </div>
            
            <button 
              onClick={loadPairs} 
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-[#737373] hover:text-white transition-colors"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        );
      })()}
    </div>
  );
}
