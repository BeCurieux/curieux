// `server-only` throws on import outside a React Server Component, which is
// the point of it — it stops a module that reads secrets from being pulled
// into a client bundle by accident.
//
// Vitest is neither, so importing the real package fails before a single
// assertion runs. Aliased to this no-op rather than deleted from the modules
// that use it: the guard is worth keeping in the build, and the alternative
// is leaving lib/email/notifications.ts untested because of a lint rule.
export {};
