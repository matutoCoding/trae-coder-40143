import { checkAndExpireBookings } from './services/bookings';
import { checkAndExpireConfirmations } from './services/waitlist';
import { checkAndMarkOverdueCleanings } from './services/cleanings';

let schedulerTimer: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  schedulerTimer = setInterval(() => {
    try {
      const bookingCount = checkAndExpireBookings();
      if (bookingCount > 0) {
        console.log(`[Scheduler] Expired ${bookingCount} bookings`);
      }
    } catch (e) {
      console.error('[Scheduler] Error checking expired bookings:', e);
    }
    try {
      const confirmCount = checkAndExpireConfirmations();
      if (confirmCount > 0) {
        console.log(`[Scheduler] Expired ${confirmCount} waitlist confirmations`);
      }
    } catch (e) {
      console.error('[Scheduler] Error checking expired confirmations:', e);
    }
    try {
      const overdue = checkAndMarkOverdueCleanings();
      if (overdue > 0) {
        console.log(`[Scheduler] Marked ${overdue} cleaning tasks as overdue`);
      }
    } catch (e) {
      console.error('[Scheduler] Error checking overdue cleanings:', e);
    }
  }, 60 * 1000);

  try {
    checkAndExpireBookings();
  } catch (e) {
    console.error('[Scheduler] Initial booking check failed:', e);
  }
  try {
    checkAndExpireConfirmations();
  } catch (e) {
    console.error('[Scheduler] Initial confirmation check failed:', e);
  }
  try {
    checkAndMarkOverdueCleanings();
  } catch (e) {
    console.error('[Scheduler] Initial overdue cleanings check failed:', e);
  }
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
