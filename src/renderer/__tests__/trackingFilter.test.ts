import { describe, it, expect } from 'vitest';
import { filterApplications } from '../trackingFilter';

const apps = [
  { id: 1, company: 'Acme', role: 'Dev', status: 'applied' },
  { id: 2, company: 'Acme', role: 'PM', status: 'interview' },
  { id: 3, company: 'Globex', role: 'Dev', status: 'applied' },
];

describe('filterApplications', () => {
  it('includes match on both query and status', () => {
    const r = filterApplications(apps, 'Acme', 'applied');
    expect(r.map((a) => a.id)).toEqual([1]);
  });
  it('excludes query match with wrong status', () => {
    const r = filterApplications(apps, 'Acme', 'applied');
    expect(r.map((a) => a.id)).not.toContain(2);
  });
  it('excludes status match without query', () => {
    const r = filterApplications(apps, 'Acme', 'applied');
    expect(r.map((a) => a.id)).not.toContain(3);
  });
  it('all statuses works', () => {
    const r = filterApplications(apps, 'Acme', null);
    expect(r.map((a) => a.id)).toEqual([1, 2]);
  });
  it('empty query works', () => {
    const r = filterApplications(apps, '', 'applied');
    expect(r.map((a) => a.id)).toEqual([1, 3]);
  });
});
