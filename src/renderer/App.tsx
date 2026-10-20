import { useState, useEffect } from 'react';
import Workflow from './Workflow';

type ProviderInfo = {
  id: string;
  name: string;
  localOnly: boolean;
  status: string;
  model?: string;
};

type Settings = {
  provider: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  openaiCompatibleEndpoint: string;
  openaiCompatibleModel: string;
  allowCloud: boolean;
};

export default function App() {
  const [ping, setPing] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cloudAllowed, setCloudAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePing = async () => {
    setError(null);
    try {
      const result = await window.electronAPI.ping();
      setPing(result);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadProviders = async () => {
    setError(null);
    try {
      const data = await window.electronAPI.listProviders();
      setProviders(data as ProviderInfo[]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadSettings = async () => {
    setError(null);
    try {
      const data = await window.electronAPI.getSettings();
      setSettings(data as Settings);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadCloudAllowed = async () => {
    setError(null);
    try {
      const allowed = await window.electronAPI.isCloudAllowed();
      setCloudAllowed(allowed);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleCloud = async () => {
    setError(null);
    if (!settings || cloudAllowed === null) return;
    try {
      // Request consent only when enabling cloud access.
      const enabling = !settings.allowCloud;
      if (enabling) {
        const granted = await window.electronAPI.requireConsent(
          'ai:set-cloud-toggle',
          ['settings']
        );
        if (!granted) {
          return; // consent denied; do not enable cloud access
        }
      }

      await window.electronAPI.setSettings({ allowCloud: enabling });
      setCloudAllowed(enabling);
      setSettings((prev) =>
        prev ? { ...prev, allowCloud: enabling } : prev
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    loadProviders();
    loadSettings();
    loadCloudAllowed();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Local Career Assistant
        </h1>
        <p className="text-slate-600">Local-first AI Career Assistant</p>
      </header>

      <main className="max-w-2xl">
        <section className="p-4 bg-white border border-slate-200 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            IPC smoke test
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            Verify the renderer can call the main process through the scoped
            preload bridge.
          </p>
          <button
            onClick={handlePing}
            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50"
          >
            Ping main process
          </button>
          {ping && (
            <p className="mt-2 text-sm text-emerald-700">
              Main process replied: {ping}
            </p>
          )}
        </section>

        <section className="p-4 bg-white border border-slate-200 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            AI Providers
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            Configure the AI provider. Cloud AI is disabled by default and
            requires explicit per-action consent.
          </p>

          {error && (
            <p className="text-sm text-red-700 mb-3">{error}</p>
          )}

          <ul className="space-y-2">
            {providers.map((p) => (
              <li key={p.id} className="p-3 border border-slate-200 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.localOnly ? 'Local only' : 'Cloud provider'}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    p.status === 'available'
                      ? 'bg-emerald-100 text-emerald-700'
                      : p.status === 'unavailable'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {p.status}
                  </span>
                </div>
                {p.model && (
                  <div className="text-xs text-slate-500 mt-1">
                    Model: {p.model}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="p-4 bg-white border border-slate-200 rounded-lg">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Settings
          </h2>
          {settings && (
            <>
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.allowCloud}
                    onChange={toggleCloud}
                    disabled={cloudAllowed === null}
                  />
                  <span className="text-sm text-slate-700">
                    Allow cloud AI (disabled by default)
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Cloud AI sends personal data to a remote provider. Requires
                  explicit per-action consent for each transmission.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Ollama endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.ollamaEndpoint}
                    readOnly
                    className="w-full p-2 border border-slate-200 rounded bg-slate-50 text-sm"
                  />
                  <label className="block text-xs text-slate-500 mt-2 mb-1">
                    Ollama model
                  </label>
                  <input
                    type="text"
                    value={settings.ollamaModel}
                    readOnly
                    className="w-full p-2 border border-slate-200 rounded bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Cloud allowed
                  </label>
                  <input
                    type="text"
                    value={String(settings.allowCloud)}
                    readOnly
                    className="w-full p-2 border border-slate-200 rounded bg-slate-50 text-sm"
                  />
                </div>
              </div>
            </>
          )}
          {!settings && <p className="text-sm text-slate-500">Loading settings…</p>}
        </section>
      </main>
    <Workflow />
</div>
  );
}
