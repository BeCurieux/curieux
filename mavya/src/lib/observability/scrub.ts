// Strips anything that could identify a person or child from a Sentry event
// before it is sent. Request bodies, cookies, headers and query strings go;
// the user is reduced to an opaque id. Kept free of Sentry imports so it can
// be unit tested directly.

type ScrubbableEvent = {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    query_string?: unknown;
    url?: string;
  };
  user?: { id?: string | number; [key: string]: unknown };
  extra?: unknown;
};

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split(/[?#]/)[0];
  }
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  delete event.extra;
  return event;
}
