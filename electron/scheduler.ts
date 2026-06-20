import { checkAndExpireBookings } from './services/bookings';

let schedulerTimer: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  schedulerTimer = setInterval(() => {
    try {
      const count = checkAndExpireBookings();
      if (count > 0) {
        console.log(`[Scheduler] Expired ${count} bookings`);
      }
    } catch (e) {
      console.error('[Scheduler] Error checking expired bookings:', e);
    }
  }, 60 * 1000);

  try {
    checkAndExpireBookings();
  } catch (e) {
    console.error('[Scheduler] Initial check failed:', e);
  }
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
