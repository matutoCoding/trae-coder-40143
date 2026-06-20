import { ipcMain } from 'electron';
import * as roomsService from './services/rooms';
import * as familiesService from './services/families';
import * as petsService from './services/pets';
import * as bookingsService from './services/bookings';
import * as waitlistService from './services/waitlist';
import * as feedingsService from './services/feedings';
import * as notificationsService from './services/notifications';
import * as cleaningsService from './services/cleanings';
import * as healthService from './services/health';

export function initIpcHandlers() {
  ipcMain.handle('rooms:list', () => roomsService.listRooms());
  ipcMain.handle('rooms:create', (_e, data) => roomsService.createRoom(data));
  ipcMain.handle('rooms:update', (_e, id, data) => roomsService.updateRoom(id, data));
  ipcMain.handle('rooms:delete', (_e, id) => roomsService.deleteRoom(id));
  ipcMain.handle('rooms:schedule', (_e, startDate, endDate) =>
    roomsService.getRoomSchedule(startDate, endDate)
  );
  ipcMain.handle('rooms:daySchedule', (_e, date) => roomsService.getDaySchedule(date));
  ipcMain.handle('rooms:weekSchedule', (_e, weekStart) => roomsService.getWeekSchedule(weekStart));
  ipcMain.handle('rooms:dailySlots', (_e, roomId, startDate, endDate) =>
    roomsService.getRoomDailySlots(roomId, startDate, endDate)
  );

  ipcMain.handle('families:list', () => familiesService.listFamilies());
  ipcMain.handle('families:create', (_e, data) => familiesService.createFamily(data));
  ipcMain.handle('families:update', (_e, id, data) => familiesService.updateFamily(id, data));
  ipcMain.handle('families:getQuota', (_e, familyId) => familiesService.getFamilyQuota(familyId));
  ipcMain.handle('families:adjustQuota', (_e, familyId, amount, reason) =>
    familiesService.adjustFamilyQuota(familyId, amount, reason)
  );
  ipcMain.handle('families:getQuotaHistory', (_e, familyId) =>
    familiesService.getQuotaHistory(familyId)
  );
  ipcMain.handle('families:listPackages', () => familiesService.listPackages());
  ipcMain.handle('families:purchasePackage', (_e, familyId, packageId) =>
    familiesService.purchasePackage(familyId, packageId)
  );
  ipcMain.handle('families:getMonthlyBill', (_e, familyId, yearMonth) =>
    familiesService.getMonthlyBill(familyId, yearMonth)
  );

  ipcMain.handle('pets:listByFamily', (_e, familyId) => petsService.listPetsByFamily(familyId));
  ipcMain.handle('pets:create', (_e, data) => petsService.createPet(data));
  ipcMain.handle('pets:update', (_e, id, data) => petsService.updatePet(id, data));
  ipcMain.handle('pets:delete', (_e, id) => petsService.deletePet(id));

  ipcMain.handle('bookings:list', (_e, params) => bookingsService.listBookings(params));
  ipcMain.handle('bookings:create', (_e, data) => bookingsService.createBooking(data));
  ipcMain.handle('bookings:checkin', (_e, bookingId) => bookingsService.checkinBooking(bookingId));
  ipcMain.handle('bookings:checkout', (_e, bookingId) => bookingsService.checkoutBooking(bookingId));
  ipcMain.handle('bookings:cancel', (_e, bookingId, reason) =>
    bookingsService.cancelBooking(bookingId, reason)
  );

  ipcMain.handle('waitlist:list', () => waitlistService.listWaitlist());
  ipcMain.handle('waitlist:add', (_e, data) => waitlistService.addToWaitlist(data));
  ipcMain.handle('waitlist:remove', (_e, waitlistId, reason) =>
    waitlistService.removeFromWaitlist(waitlistId, reason)
  );
  ipcMain.handle('waitlist:listConfirmations', () => waitlistService.listConfirmations());
  ipcMain.handle('waitlist:confirm', (_e, confirmationId) =>
    waitlistService.confirmWaitlist(confirmationId)
  );
  ipcMain.handle('waitlist:decline', (_e, confirmationId) =>
    waitlistService.declineWaitlist(confirmationId)
  );

  ipcMain.handle('feedings:listByDate', (_e, date) => feedingsService.listFeedingByDate(date));
  ipcMain.handle('feedings:checkin', (_e, bookingId, date, timeSlot, operator, note, isAnomaly, anomalyType) =>
    feedingsService.checkinFeeding(bookingId, date, timeSlot, operator, note, isAnomaly, anomalyType)
  );
  ipcMain.handle('feedings:stats', (_e, startDate, endDate) =>
    feedingsService.getFeedingStats(startDate, endDate)
  );
  ipcMain.handle('feedings:anomalies', (_e, startDate, endDate) =>
    feedingsService.getFeedingAnomalies(startDate, endDate)
  );

  ipcMain.handle('cleanings:list', (_e, date) => cleaningsService.listCleanings(date));
  ipcMain.handle('cleanings:stats', (_e, status, date) => cleaningsService.getCleaningStats(status, date));
  ipcMain.handle('cleanings:start', (_e, cleaningId, assignedTo) =>
    cleaningsService.startCleaning(cleaningId, assignedTo)
  );
  ipcMain.handle('cleanings:finish', (_e, cleaningId, inspector, note) =>
    cleaningsService.finishCleaning(cleaningId, inspector, note)
  );

  ipcMain.handle('health:list', (_e, status) => healthService.listFollowups(status));
  ipcMain.handle('health:stats', () => healthService.getFollowupStats());
  ipcMain.handle('health:assign', (_e, followupId, assignedTo) =>
    healthService.assignFollowup(followupId, assignedTo)
  );
  ipcMain.handle('health:recordHandling', (_e, followupId, result, recheckTime) =>
    healthService.recordHandling(followupId, result, recheckTime)
  );
  ipcMain.handle('health:close', (_e, followupId, closeNote) =>
    healthService.closeFollowup(followupId, closeNote)
  );

  ipcMain.handle('notifications:list', (_e, params) => notificationsService.listNotifications(params));
  ipcMain.handle('notifications:listTypes', () => notificationsService.listNotificationTypes());
  ipcMain.handle('notifications:markRead', (_e, id) => notificationsService.markNotificationRead(id));
  ipcMain.handle('notifications:markAllRead', () => notificationsService.markAllNotificationsRead());
  ipcMain.handle('notifications:markHandled', (_e, id) => notificationsService.markNotificationHandled(id));
  ipcMain.handle('notifications:markHandledByType', (_e, type) => notificationsService.markNotificationsHandledByType(type));
}
