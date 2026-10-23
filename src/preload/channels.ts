/**
 * IPC channels the renderer is permitted to invoke.
 *
 * This list is the single source of truth for the preload allow-list. Every
 * channel exposed through the `electronAPI` bridge must appear here, and the
 * regression test in `src/main/__tests__/preload/allowlist.test.ts` fails if
 * the two ever drift apart.
 *
 * No generic database execution, unrestricted filesystem access, or secret
 * retrieval channel is (or may be) included.
 */
export const allowedChannels = [
  // Application / database
  'app:ping',
  'db:ping',
  'db:version',

  // AI provider, settings, consent, secrets
  'ai:providers',
  'ai:getSettings',
  'ai:setSettings',
  'ai:isCloudAllowed',
  'ai:requireConsent',
  'ai:grantConsent',
  'ai:denyConsent',
  'ai:generateText',
  'ai:generateJSON',
  'ai:setSecret',
  'ai:deleteSecret',
  'ai:listAuditLog',

  // Core workflow: CVs, job descriptions, evaluation, documents
  'wf:listCvs',
  'wf:getCv',
  'wf:createCv',
  'wf:updateCv',
  'wf:deleteCv',
  'wf:listJobs',
  'wf:getJob',
  'wf:createJob',
  'wf:updateJob',
  'wf:deleteJob',
  'wf:evaluate',
  'wf:generateDocument',
  'wf:listDocuments',
  'wf:exportDocument',

  // Application tracking
  'tr:list',
  'tr:create',
  'tr:update',
  'tr:delete',
  'tr:search',

  // Backup and restore
  'backup:create',
  'backup:restore',
] as const;

export type AllowedChannel = (typeof allowedChannels)[number];
