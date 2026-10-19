import { useState } from 'react';

export default function App() {
  const [ping, setPing] = useState<string | null>(null);

  const handlePing = async () => {
    const result = await window.electronAPI.ping();
    setPing(result);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Local Career Assistant</h1>
        <p className="text-slate-600">Local-first AI Career Assistant — MVP scaffolding</p>
      </header>

      <main className="max-w-2xl">
        <section className="p-4 bg-white border border-slate-200 rounded-lg">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">IPC smoke test</h2>
          <p className="text-sm text-slate-600 mb-3">
            Verify the renderer can call the main process through the scoped preload bridge.
          </p>
          <button
            onClick={handlePing}
            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50"
          >
            Ping main process
          </button>
          {ping && (
            <p className="mt-2 text-sm text-emerald-700">Main process replied: {ping}</p>
          )}
        </section>
      </main>
    </div>
  );
}
