import { useState, useEffect } from 'react';
import { filterApplications } from './trackingFilter';

type Application = {
  id: number;
  jobId: number | null;
  company: string;
  role: string;
  status: string;
  appliedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'] as const;

export default function Tracking() {
  const [apps, setApps] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [newStatus, setNewStatus] = useState<string>('saved');
  const [notes, setNotes] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let data: unknown;
      if (query.trim()) {
        const searched = (await window.electronAPI.searchApplications(query.trim())) as Application[];
        data = filterApplications(searched, '', statusFilter);
      } else {
        data = await window.electronAPI.listApplications(statusFilter);
      }
      setApps(data as Application[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const create = async () => {
    if (!company.trim() || !role.trim()) {
      setError('Company and role are required.');
      return;
    }
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      await window.electronAPI.createApplication({
        company: company.trim(),
        role: role.trim(),
        status: newStatus,
        notes: notes.trim() || null,
      });
      setCompany('');
      setRole('');
      setNotes('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    if (updatingId === id) return;
    setUpdatingId(id);
    setError(null);
    try {
      await window.electronAPI.updateApplication(id, { status });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this application?')) return;
    setError(null);
    try {
      await window.electronAPI.deleteApplication(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="p-4 bg-white border border-slate-200 rounded-lg mt-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Application Tracking</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1 text-sm rounded border ${statusFilter === null ? 'bg-slate-900 text-white' : 'bg-white'}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-sm rounded border ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or role"
          className="flex-1 p-2 border border-slate-200 rounded text-sm"
        />
        <button onClick={load} className="px-3 py-2 bg-slate-900 text-white rounded text-sm">
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          className="p-2 border border-slate-200 rounded text-sm"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          className="p-2 border border-slate-200 rounded text-sm"
        />
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="p-2 border border-slate-200 rounded text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="p-2 border border-slate-200 rounded text-sm"
        />
      </div>
      <button onClick={create} disabled={creating} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm mb-3 disabled:opacity-50">
        Add Application
      </button>

      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      {loading && <p className="text-sm text-slate-500 mb-3">Loading…</p>}

      {!loading && apps.length === 0 && (
        <p className="text-sm text-slate-500">No applications found.</p>
      )}

      <ul className="space-y-2">
        {apps.map((a) => (
          <li key={a.id} className="p-3 border border-slate-200 rounded">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-slate-900">
                  {a.company} — {a.role}
                </div>
                <div className="text-xs text-slate-500">
                  {a.appliedDate ? `Applied ${a.appliedDate}` : 'No applied date'}
                </div>
                {a.notes && <div className="text-xs text-slate-600 mt-1">{a.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={a.status}
                  onChange={(e) => updateStatus(a.id, e.target.value)}
                  disabled={updatingId === a.id}
                  className="text-xs p-1 border border-slate-200 rounded disabled:opacity-50"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(a.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
