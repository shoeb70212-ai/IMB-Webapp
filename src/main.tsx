import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initializeDatabase } from './db.ts';
import './dbSync.ts';
import './index.css';

function Main() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        setError(err.message || 'IndexedDB Initialization Error. Please verify your browser storage settings.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <h2 className="text-lg font-bold font-display mt-6 tracking-wide text-white">Initializing Kisan Mitra...</h2>
        <p className="text-xs text-slate-500 mt-2">Setting up local IndexedDB storage and offline databases.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-400 p-6 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 max-w-md">
          <h2 className="text-xl font-bold font-display text-white">Database Initialization Failed</h2>
          <p className="text-sm text-slate-400 mt-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
);
