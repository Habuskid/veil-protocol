export default function HistoryTab({ txHistory }) {
  return (
    <div className="h-full flex flex-col items-center justify-start animate-fade-in pb-12 w-full">
      <div className="solid-card w-full max-w-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold mb-2">Transaction History</h2>
        {(!txHistory || txHistory.length === 0) ? (
          <p className="text-white/50 text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-2 w-full max-w-xl">
            {txHistory.map((tx, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors gap-3">
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-white">{tx.type}</span>
                  <span className="text-sm text-white/60">{tx.details}</span>
                  <span className="text-xs text-white/40 mt-1">{new Date(tx.timestamp).toLocaleString()}</span>
                </div>
                {tx.hash && (
                  <a href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors shrink-0 text-center uppercase tracking-wider">
                    Explorer
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
