import { useState, useEffect } from 'react';


type Cv = { id: number; title: string; content: string };
type Job = { id: number; title: string; company: string | null; url: string | null; description: string };
type Evidence = { quote: string; verified: boolean };
type EvalResult = { score: number; verdict: string; evidence: Evidence[]; supported: string[]; missing: string[]; suggestions: string[] };
type Doc = { id: number; kind: string; content: string };
export default function Workflow() {
  const [cvTitle, setCvTitle] = useState('');
  const [cvContent, setCvContent] = useState('');
  const [cvs, setCvs] = useState<Cv[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedCv, setSelectedCv] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { load(); }, []);

  const load = async () => {
    setCvs((await window.electronAPI.listCvs()) as any[]);
    setJobs((await window.electronAPI.listJobs()) as any[]);
  };

  const createCv = async () => {
    await window.electronAPI.createCv(cvTitle, cvContent);
    setCvTitle(''); setCvContent('');
    await load();
  };

  const createJob = async () => {
    await window.electronAPI.createJob(jobTitle, null, null, jobDesc);
    setJobTitle(''); setJobDesc('');
    await load();
  };

  const runEval = async () => {
    if (!selectedCv || !selectedJob) return;
    setStatus('Evaluating...');
    try {
      const r = await window.electronAPI.evaluate(selectedCv, selectedJob) as EvalResult;
      setEvalResult(r);
      setStatus(null);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const genDoc = async (kind: 'tailored-cv' | 'cover-letter') => {
    if (!selectedCv || !selectedJob) return;
    setStatus('Generating...');
    try {
      const r = await window.electronAPI.generateDocument(selectedCv, selectedJob, kind) as Doc;
      setDoc(r);
      const list = await window.electronAPI.listDocuments(selectedCv, selectedJob);
      setDocs(list as any[]);
      setStatus(null);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const exportDoc = async (format: 'md' | 'txt') => {
    if (!doc) return;
    const r: any = await window.electronAPI.exportDocument(doc.id, format);
    if (r.canceled) setStatus('Export cancelled');
    else setStatus('Exported');
  };

  return (
    <section>
      <h2>CVs</h2>
      <input placeholder="Title" value={cvTitle} onChange={(e) => setCvTitle(e.target.value)} />
      <textarea placeholder="Content" value={cvContent} onChange={(e) => setCvContent(e.target.value)} />
      <button onClick={createCv}>Create CV</button>
      <button onClick={load}>Refresh</button>
      <ul>{cvs.map((c) => <li key={c.id}>{c.title}</li>)}</ul>

      <h2>Jobs</h2>
      <input placeholder="Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      <textarea placeholder="Description" value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} />
      <button onClick={createJob}>Create Job</button>
      <ul>{jobs.map((j) => <li key={j.id}>{j.title}</li>)}</ul>

      <h2>Evaluate</h2>
      <select onChange={(e) => setSelectedCv(Number(e.target.value))}>
        <option value="">CV</option>
        {cvs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <select onChange={(e) => setSelectedJob(Number(e.target.value))}>
        <option value="">Job</option>
        {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
      </select>
      <button onClick={runEval}>Run evaluation</button>
      {evalResult && (
        <div>
          <p>Score: {evalResult.score}</p>
          <p>Verdict: {evalResult.verdict}</p>
          <p>Evidence:</p>
          <ul>{evalResult.evidence.map((e: any, i: number) => <li key={i}>{e.quote} {e.verified ? '(verified)' : '(unverified)'}</li>)}</ul>
          <p>Supported: {evalResult.supported.join(', ')}</p>
          <p>Missing: {evalResult.missing.join(', ')}</p>
          <p>Suggestions: {evalResult.suggestions.join(', ')}</p>
        </div>
      )}

      <h2>Documents</h2>
      <button onClick={() => genDoc('tailored-cv')}>Generate tailored CV</button>
      <button onClick={() => genDoc('cover-letter')}>Generate cover letter</button>
      {doc && <pre>{doc.content}</pre>}
      <select onChange={(e) => { const found = docs.find((d) => d.id === Number(e.target.value)); setDoc(found ?? null); } }>
        <option value="">History</option>
        {docs.map((d) => <option key={d.id} value={d.id}>{d.kind}</option>)}
      </select>
      <button onClick={() => exportDoc('md')}>Export MD</button>
      <button onClick={() => exportDoc('txt')}>Export TXT</button>
      {status && <p>{status}</p>}
    </section>
  );
}
