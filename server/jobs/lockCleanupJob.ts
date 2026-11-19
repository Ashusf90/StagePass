import { releaseExpiredLocks } from '../services/seatLockService.ts';

let timer: ReturnType<typeof setInterval> | null = null;

export function startLockCleanupJob(intervalMs = 15_000): void {
  if (timer) return;

  timer = setInterval(() => {
    releaseExpiredLocks().catch((err) => {
      console.error('[lockCleanupJob] Failed to release expired locks:', err);
    });
  }, intervalMs);

  // Do not block process exit
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function stopLockCleanupJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
