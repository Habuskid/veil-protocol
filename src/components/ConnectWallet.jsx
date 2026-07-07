import { useState } from 'react';
import { BoltIcon, DocumentDuplicateIcon, ArrowRightOnRectangleIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function ConnectWallet({ address, isSepolia, connect, disconnect }) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) {
    return (
      <button onClick={connect} className="btn-primary py-2 px-4 text-sm md:text-base">
        <BoltIcon className="w-4 h-4 md:w-5 md:h-5" />
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-4 relative">
      <div className={`hidden md:block px-3 py-1 rounded-full text-xs font-medium border ${isSepolia ? 'bg-white text-black border-white' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
        {isSepolia ? 'Sepolia' : 'Wrong Network'}
      </div>
      
      <div className="relative">
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="bg-[#1a1a1a] hover:bg-[#262626] transition-colors border border-white/10 px-3 md:px-4 py-2 rounded-lg text-white font-mono text-sm shadow-sm flex items-center gap-2"
        >
          <div className={`w-2 h-2 rounded-full ${isSepolia ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`}></div>
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-[#111111] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
            <button 
              onClick={() => { handleCopy(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#1a1a1a] flex items-center gap-3 transition-colors"
            >
              {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <DocumentDuplicateIcon className="w-4 h-4 text-[#a1a1aa]" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            <div className="h-px bg-white/5 w-full"></div>
            <button 
              onClick={() => { disconnect(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-[#ff4444] hover:bg-[#ff4444]/10 flex items-center gap-3 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
