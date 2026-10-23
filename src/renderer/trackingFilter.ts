export type TrackableApplication = {
  id: number;
  company: string;
  role: string;
  status: string;
};

export function filterApplications<T extends TrackableApplication>(
  apps: T[],
  query: string,
  status: string | null
): T[] {
  const q = query.trim().toLowerCase();
  return apps.filter((a) => {
    if (status && a.status !== status) return false;
    if (!q) return true;
    return a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q);
  });
}
