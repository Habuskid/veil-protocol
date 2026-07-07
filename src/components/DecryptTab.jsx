import { useState } from 'react';
import { Contract, formatUnits, getAddress } from 'ethers';
import { ERC7984_ABI } from '../config/addresses';
import { KeyIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { decryptFhevm } from '../lib/zama';

export default function DecryptTab({ provider, signer, address, fhevmReady, showToast }) {
  const [tokenAddress, setTokenAddress] = useState('');
  const [decryptedBalance, setDecryptedBalance] = useState(null);
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDecrypt = async () => {
    if (!signer || !address) return showToast("Please connect wallet", "error");
    if (!fhevmReady) return showToast("FHEVM is still initializing...", "info");
    if (!tokenAddress) return showToast("Please enter an ERC-7984 token address", "error");

    let validAddress;
    try {
      validAddress = getAddress(tokenAddress);
    } catch {
      return showToast("Invalid token address format", "error");
    }

    setLoading(true);
    setDecryptedBalance(null);
    setSymbol('');

    try {
      const contract = new Contract(validAddress, ERC7984_ABI, signer);
      const [decimals, sym] = await Promise.all([
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNK')
      ]);
      setSymbol(sym);

      showToast("Fetching encrypted balance from contract...", "info");
      let balanceHandle;
      try {
        balanceHandle = await contract.confidentialBalanceOf(address);
      } catch (e) {
        balanceHandle = await contract.balanceOf(address);
      }
      
      
      showToast("Decrypting via Zama KMS... Please check wallet for signature if needed.", "info");
      const decrypted = await decryptFhevm(validAddress, address, provider, balanceHandle);

      setDecryptedBalance(formatUnits(decrypted, decimals));
      showToast("Balance decrypted successfully!", "success");
      
    } catch (e) {
      console.error(e);
      const msg = e.message || String(e);
      if (msg.includes("not authorized to user decrypt handle") || msg.includes("Unknown FheType") || msg.includes("is invalid")) {
        showToast("Error: Invalid handle. You pasted a plaintext ERC-20 address instead of the Confidential Wrapper (ERC-7984) address. Plaintext tokens cannot be decrypted.", "error");
      } else {
        showToast("Decryption failed: " + msg, "error");
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-start animate-fade-in pb-4 w-full">
      <div className="solid-card w-full max-w-lg p-5 space-y-5">
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-white/5">
            <KeyIcon className="w-6 h-6 text-black" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Decrypt Balance</h2>
          <p className="text-[#a1a1aa] text-sm leading-relaxed">
            Enter the address of a confidential wrapper token to reveal your balance securely.
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <input 
            type="text" 
            className="input-solid w-full text-center text-lg placeholder-white/20" 
            placeholder="0x..." 
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
          />

          <button 
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
            onClick={handleDecrypt}
            disabled={loading || !signer || !tokenAddress}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Reveal Balance'
            )}
          </button>
        </div>

        {/* Result Modal */}
        {decryptedBalance !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl relative flex flex-col items-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <KeyIcon className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-sm text-[#a1a1aa] font-semibold mb-2 uppercase tracking-widest">True Balance</h3>
              <div className="text-4xl font-bold text-white flex items-center justify-center gap-2 mb-8">
                {decryptedBalance} <span className="text-xl text-[#a1a1aa] font-medium">{symbol}</span>
              </div>
              
              <button 
                onClick={() => setDecryptedBalance(null)}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
