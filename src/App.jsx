import { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { initZama } from './lib/zama';
import ConnectWallet from './components/ConnectWallet';
import RegistryTab from './components/RegistryTab';
import FaucetTab from './components/FaucetTab';
import DecryptTab from './components/DecryptTab';
import HistoryTab from './components/HistoryTab';

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [isSepolia, setIsSepolia] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('registry');
  const [fhevmReady, setFhevmReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [showApp, setShowApp] = useState(false);
  const [showToS, setShowToS] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [canAcceptToS, setCanAcceptToS] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);

  const [txHistory, setTxHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('veil_tx_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addTxHistory = (tx) => {
    const newTx = { ...tx, timestamp: Date.now() };
    setTxHistory(prev => {
      const updated = [newTx, ...prev];
      localStorage.setItem('veil_tx_history', JSON.stringify(updated));
      return updated;
    });
  };

  const tabs = [
    { id: 'registry', label: 'Registry' },
    { id: 'faucet', label: 'Faucet' },
    { id: 'decrypt', label: 'Decrypt' },
    { id: 'history', label: 'History' }
  ];
  
  const activeTabIndex = tabs.findIndex(t => t.id === activeTab);

  useEffect(() => {
    initZama().then(() => {
      setFhevmReady(true);
    }).catch(e => {
      console.error(e);
      setInitError(e.message || String(e));
    });

    const verifyNetwork = async () => {
      if (!window.ethereum) return;
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const hex = typeof chainId === 'string' ? chainId.toLowerCase() : '';
        const num = Number(chainId);
        setIsSepolia(hex === '0xaa36a7' || num === 11155111);
        setNetworkChecked(true);
      } catch (e) {
        console.error(e);
        setNetworkChecked(true);
      }
    };

    if (window.ethereum) {
      const p = new BrowserProvider(window.ethereum);
      setProvider(p);
      verifyNetwork();

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0) {
      setAddress(accounts[0]);
      if (window.ethereum) {
        const p = new BrowserProvider(window.ethereum);
        setProvider(p);
        p.getSigner().then(setSigner);
        verifyNetwork();
      }
    } else {
      setAddress('');
      setSigner(null);
    }
  };

  const connect = async () => {
    if (!window.ethereum) return alert('Please install MetaMask');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Require wallet signature to proceed
      const p = new BrowserProvider(window.ethereum);
      const s = await p.getSigner();
      const message = `Welcome to Veil Protocol!\n\nPlease sign this message to verify your wallet ownership and securely access the dashboard.\n\nWallet: ${accounts[0]}\nTimestamp: ${new Date().toISOString()}`;
      
      await s.signMessage(message);
      
      handleAccountsChanged(accounts);
      return true;
    } catch (e) {
      console.error(e);
      if (e.code === 4001 || e.message?.includes('User denied')) {
        showToast("Signature rejected by user", "error");
      }
      return false;
    }
  };

  const proceedToApp = async () => {
    if (!address) {
      const success = await connect();
      if (success) {
        setShowApp(true);
      }
    } else {
      setShowApp(true);
    }
  };

  const handleLaunchApp = () => {
    if (tosAccepted) {
      proceedToApp();
    } else {
      setShowToS(true);
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
      });
    } catch (error) {
      console.error(error);
      if (error.code === 4902) {
        alert("Sepolia network is not added to your wallet. Please add it manually.");
      }
    }
  };

  const disconnect = () => {
    setAddress('');
    setSigner(null);
    setShowApp(false);
  };

  // 15-minute inactivity timeout
  useEffect(() => {
    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 15 minutes = 900,000 ms
      timeoutId = setTimeout(() => {
        if (address || showApp) {
          disconnect();
          showToast("Session expired due to inactivity", "info");
        }
      }, 900000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    
    // Initialize timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [address, showApp]);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="min-h-screen text-white selection:bg-white/20 flex flex-col font-sans relative bg-[#0a0a0a]">
      <header className="border-b border-white/5 relative z-10 bg-black/20 backdrop-blur-xl shrink-0">
        <div className="w-full px-6 sm:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowApp(false)}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-2xl">V</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Veil</span>
          </div>
          {showApp && (
            <ConnectWallet 
              address={address} 
              isSepolia={isSepolia}
              connect={connect} 
              disconnect={disconnect}
            />
          )}
        </div>
      </header>

      {(!isSepolia && networkChecked && address) && (
        <div 
          onClick={switchNetwork}
          className="bg-white text-black py-3 px-6 text-center text-sm font-bold cursor-pointer hover:bg-gray-200 transition-colors shadow-lg"
        >
          Warning: You are on the wrong network. Click here to switch to the Sepolia testnet network.
        </div>
      )}

      {!showApp ? (
        <main className="flex-1 w-full relative z-10 flex flex-col items-center pt-8 pb-32 animate-fade-in overflow-y-auto custom-scrollbar">
          
          {/* Hero Section */}
          <div className="w-full max-w-4xl px-4 flex flex-col items-center justify-center min-h-[75vh] text-center mb-16">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
              <span className="text-black font-black text-6xl">V</span>
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
              Veil<span className="text-white/40">Protocol</span>
            </h1>
            <p className="max-w-2xl text-lg sm:text-xl text-[#a1a1aa] mb-12 leading-relaxed">
              A seamless interface for wrapping, unwrapping, and managing confidential ERC-20 tokens on the Sepolia testnet using Zama's Fully Homomorphic Encryption (FHEVM).
            </p>
            <button 
              onClick={handleLaunchApp}
              className="bg-white text-black font-bold text-lg px-10 py-5 rounded-full hover:scale-105 hover:bg-gray-100 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              Launch App
            </button>
          </div>

          {/* How It Works Section */}
          <div className="w-full max-w-6xl px-6 flex flex-col items-center">
            <h2 className="text-3xl font-bold mb-12 tracking-tight">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full">
              
              {/* Step 1 */}
              <div className="solid-card p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <span className="text-2xl font-black text-white">1</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">Wrap Tokens</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">
                  Convert standard public ERC-20 tokens into confidential ERC-7984 wrappers. Your public balance decreases, and your encrypted balance increases seamlessly.
                </p>
              </div>

              {/* Step 2 */}
              <div className="solid-card p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <span className="text-2xl font-black text-white">2</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">Stay Encrypted</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">
                  Your confidential balance is encrypted entirely on-chain using Zama's FHEVM. Computations occur blindly, and only you hold the keys to view the data.
                </p>
              </div>

              {/* Step 3 */}
              <div className="solid-card p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-2">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <span className="text-2xl font-black text-white">3</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">Decrypt Safely</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">
                  When you need to verify your true balance, you can request a secure decryption via the Key Management System (KMS) via a wallet signature.
                </p>
              </div>

            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col pt-4 pb-8">
          <div className="flex w-full sm:w-fit mx-auto p-1 bg-black/40 backdrop-blur-md rounded-xl mb-6 sm:mb-8 relative z-10 border border-white/10 shadow-lg overflow-x-auto snap-x hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-300 relative whitespace-nowrap snap-center
                  ${activeTab === tab.id ? 'text-black bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full">
            {activeTab === 'registry' && (
              <div className="animate-fade-in">
                <RegistryTab provider={provider} signer={signer} address={address} fhevmReady={fhevmReady} showToast={showToast} addTxHistory={addTxHistory} />
              </div>
            )}
            {activeTab === 'faucet' && (
              <div className="animate-fade-in">
                <FaucetTab provider={provider} signer={signer} address={address} showToast={showToast} addTxHistory={addTxHistory} />
              </div>
            )}
            {activeTab === 'decrypt' && (
              <div className="animate-fade-in">
                <DecryptTab provider={provider} signer={signer} address={address} fhevmReady={fhevmReady} showToast={showToast} />
              </div>
            )}
            {activeTab === 'history' && (
              <div className="animate-fade-in">
                <HistoryTab txHistory={txHistory} />
              </div>
            )}
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="w-full py-6 text-center text-[#52525b] text-xs font-medium tracking-wide mt-auto relative z-10">
        &copy; 2026 Veil Protocol. All rights reserved.
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4 animate-fade-in">
          <div className={`pointer-events-auto px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border bg-black text-white ${
            toast.type === 'error' ? 'border-red-500/50' :
            toast.type === 'success' ? 'border-green-500/50' :
            'border-white/20'
          }`}>
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-4 opacity-60 hover:opacity-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ToS Modal */}
      {showToS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-2xl shadow-[0_0_100px_rgba(255,255,255,0.05)] relative flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
                  <span className="text-black font-black text-lg">V</span>
                </div>
                Terms of Service
              </h3>
            </div>

            {/* Scrollable Content */}
            <div className="relative flex-1 overflow-hidden flex flex-col">
              <div 
                className="px-8 py-6 overflow-y-auto custom-scrollbar flex-1 text-[#a1a1aa] text-sm leading-relaxed space-y-6"
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } = e.target;
                  if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 30) {
                    setCanAcceptToS(true);
                  }
                }}
              >
                <div className="space-y-4">
                  <p className="font-medium text-white/80">Last Updated: July 2026</p>
                  <p>Welcome to Veil Protocol. Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Veil Protocol decentralized application (the "Service").</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-base tracking-wide">1. Acceptance of Terms</h4>
                  <p>By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-base tracking-wide">2. Experimental Technology & Testnet Usage</h4>
                  <p>The Service leverages Zama's Fully Homomorphic Encryption Virtual Machine (FHEVM). This technology is highly experimental and is currently deployed strictly on the Sepolia testnet.</p>
                  <ul className="list-disc pl-5 space-y-2 text-[#737373]">
                    <li>You acknowledge that all tokens used are <strong>mock or testnet tokens</strong> with no real-world value.</li>
                    <li>You agree not to attempt to bridge, wrap, or utilize real assets on this interface.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-base tracking-wide">3. Privacy and On-Chain Data</h4>
                  <p>While FHE provides computational encryption on-chain, you understand that:</p>
                  <ul className="list-disc pl-5 space-y-2 text-[#737373]">
                    <li>RPC requests and interactions with the Key Management System (KMS) may be visible to node operators.</li>
                    <li>Testnet explorers log all standard EVM transaction metadata (sender, receiver, gas).</li>
                    <li>Do not submit sensitive personal identifiable information (PII) to the blockchain.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-base tracking-wide">4. Limitation of Liability</h4>
                  <p>In no event shall Veil Protocol, its developers, or its affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold text-base tracking-wide">5. User Responsibility</h4>
                  <p>You are solely responsible for the security of your cryptographic wallets and private keys. Veil Protocol never takes custody of your assets and cannot recover lost keys or testnet funds.</p>
                </div>

                <div className="pt-12 pb-4 text-center">
                  <p className="text-white/40 italic flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    End of Terms
                  </p>
                </div>
              </div>
              
              {/* Bottom Gradient Fade (disappears when scrolled to bottom) */}
              {!canAcceptToS && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
              )}
            </div>

            {/* Footer with Checkbox and Actions */}
            <div className="p-8 border-t border-white/5 bg-white/[0.01]">
              <label 
                className={`flex items-center gap-4 cursor-pointer p-4 rounded-xl transition-all duration-300 mb-6 border ${
                  canAcceptToS ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-transparent border-transparent opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    disabled={!canAcceptToS}
                    checked={tosChecked}
                    onChange={(e) => setTosChecked(e.target.checked)}
                  />
                  <div className={`w-6 h-6 rounded border transition-colors flex items-center justify-center ${
                    tosChecked ? 'bg-white border-white' : 'bg-black border-white/30'
                  }`}>
                    {tosChecked && (
                      <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-medium select-none ${tosChecked ? 'text-white' : 'text-[#a1a1aa]'}`}>
                  I have scrolled, read, and agree to the Terms of Service
                </span>
              </label>

              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setShowToS(false)}
                  className="px-8 py-3 text-sm font-semibold text-white/60 hover:text-white transition-colors rounded-xl hover:bg-white/5"
                >
                  Decline
                </button>
                <button 
                  disabled={!tosChecked}
                  onClick={() => {
                    setTosAccepted(true);
                    setShowToS(false);
                    proceedToApp();
                  }}
                  className={`px-10 py-3 text-sm font-bold rounded-xl transition-all duration-300 shadow-lg ${
                    tosChecked 
                      ? 'bg-white text-black hover:bg-gray-200 hover:shadow-white/20' 
                      : 'bg-white/10 text-white/30 cursor-not-allowed shadow-none'
                  }`}
                >
                  Confirm & Connect
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
