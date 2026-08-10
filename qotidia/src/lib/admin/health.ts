// Is it running?
//
// The failure this exists for is the quiet one. Everything else that goes
// wrong in this product announces itself — a card declines and Stripe emails,
// a page throws and somebody sees it, a print order fails and the status
// column says so. A job runner that has stopped says nothing at all. Uploads
// still work, memories still save, the archive still opens; it is only three
// days later, when a family asks why their book never appeared, that anybody
// finds out nothing has been processed since Tuesday.
//
// A queue with a thousand things in it and no runner looks exactly like a
// queue with nothing in it, from every page except this one.
//
// ## What "healthy" means here
//
// Not "no failures". Failures are normal — a model returns nonsense, a print
// API times out, somebody uploads a file that turns out to be a video. The
// retry machinery exists for that and a handful of failed jobs is a Tuesday.
//
// The two things that are not normal:
//
//   **Work waiting with nothing moving.** Queue depth on its own means
//   nothing; queue depth plus a stale heartbeat means the runner is gone.
//   Both halves are required, which is why STALE_MINUTES is generous — a
//   quiet product at 4am legitimately has nothing to do.
//
//   **Jobs that have given up.** A dead job is one no retry will fix, and
//   each one is a family waiting for something that will never arrive. It is
//   the number that should be zero rather than small.

export type Verdict = "fine" | "slow" | "stopped" | "stuck";

/**
 * How long without a completed job counts as stopped, when there is work.
 *
 * Fifteen minutes. Long enough that a slow book render or a batch of scans
 * does not raise a false alarm; short enough that a runner which died after
 * breakfast is not still unnoticed at lunch.
 */
export const STALE_MINUTES = 15;

/** Waiting this long with a live runner is slow rather than broken. */
export const SLOW_MINUTES = 30;

export interface Queue {
  queued: number;
  running: number;
  failed: number;
  /** Given up on. No retry will fix these. */
  dead: number;
  /** ISO of the most recent job to finish, or null if none ever has. */
  lastFinishedAt: string | null;
  /** ISO of the oldest thing still waiting, or null if nothing is. */
  oldestWaitingAt: string | null;
}

export interface Health {
  verdict: Verdict;
  /** What is wrong, in the operator's terms. Null when nothing is. */
  because: string | null;
  /** Minutes the oldest waiting job has been waiting. */
  waitingMinutes: number;
  /** Minutes since anything finished. */
  quietMinutes: number;
}

const minutesBetween = (from: string | null, now: string): number =>
  from === null ? Infinity : Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000));

/**
 * What the queue is doing, and whether anybody should be worried.
 *
 * Ordered by how bad it is. A stopped runner outranks a stuck job because
 * one of them means everything is broken and the other means one thing is.
 */
export function healthOf(queue: Queue, now: string): Health {
  const waitingMinutes = minutesBetween(queue.oldestWaitingAt, now);
  const quietMinutes = minutesBetween(queue.lastFinishedAt, now);
  const waiting = queue.queued + queue.running;

  // Work waiting and nothing has finished in a long time. Both halves
  // required: a quiet 4am with an empty queue is a healthy 4am.
  if (waiting > 0 && quietMinutes >= STALE_MINUTES) {
    return {
      verdict: "stopped",
      because:
        `${waiting} job${waiting === 1 ? "" : "s"} waiting and nothing has finished for ` +
        `${quietMinutes === Infinity ? "as long as this queue has existed" : `${quietMinutes} minutes`}. ` +
        `The runner is probably not running.`,
      waitingMinutes,
      quietMinutes,
    };
  }

  if (queue.dead > 0) {
    return {
      verdict: "stuck",
      because:
        `${queue.dead} job${queue.dead === 1 ? " has" : "s have"} given up. No retry will ` +
        `fix ${queue.dead === 1 ? "it" : "them"}, and somebody is waiting for each one.`,
      waitingMinutes,
      quietMinutes,
    };
  }

  if (waiting > 0 && waitingMinutes >= SLOW_MINUTES) {
    return {
      verdict: "slow",
      because: `Something has been waiting ${waitingMinutes} minutes. Still moving, but behind.`,
      waitingMinutes,
      quietMinutes,
    };
  }

  return { verdict: "fine", because: null, waitingMinutes, quietMinutes };
}

/** Whether this needs somebody's attention now, rather than at some point. */
export const needsSomebody = (health: Health): boolean =>
  health.verdict === "stopped" || health.verdict === "stuck";
