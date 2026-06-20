import { contextBridge, ipcRenderer } from 'electron';

const api = {
  rooms: {
    list: () => ipcRenderer.invoke('rooms:list'),
    create: (data: any) => ipcRenderer.invoke('rooms:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('rooms:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('rooms:delete', id),
    getSchedule: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('rooms:schedule', startDate, endDate),
    getDaySchedule: (date: string) => ipcRenderer.invoke('rooms:daySchedule', date),
    getWeekSchedule: (weekStart: string) => ipcRenderer.invoke('rooms:weekSchedule', weekStart),
    getDailySlots: (roomId: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke('rooms:dailySlots', roomId, startDate, endDate),
  },
  families: {
    list: () => ipcRenderer.invoke('families:list'),
    create: (data: any) => ipcRenderer.invoke('families:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('families:update', id, data),
    getQuota: (familyId: string) => ipcRenderer.invoke('families:getQuota', familyId),
    adjustQuota: (familyId: string, amount: number, reason: string) =>
      ipcRenderer.invoke('families:adjustQuota', familyId, amount, reason),
    getQuotaHistory: (familyId: string) =>
      ipcRenderer.invoke('families:getQuotaHistory', familyId),
    listPackages: () => ipcRenderer.invoke('families:listPackages'),
    purchasePackage: (familyId: string, packageId: string) =>
      ipcRenderer.invoke('families:purchasePackage', familyId, packageId),
    getMonthlyBill: (familyId: string, yearMonth: string) =>
      ipcRenderer.invoke('families:getMonthlyBill', familyId, yearMonth),
  },
  pets: {
    listByFamily: (familyId: string) => ipcRenderer.invoke('pets:listByFamily', familyId),
    create: (data: any) => ipcRenderer.invoke('pets:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('pets:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('pets:delete', id),
  },
  bookings: {
    list: (params?: any) => ipcRenderer.invoke('bookings:list', params),
    create: (data: any) => ipcRenderer.invoke('bookings:create', data),
    checkin: (bookingId: string) => ipcRenderer.invoke('bookings:checkin', bookingId),
    checkout: (bookingId: string) => ipcRenderer.invoke('bookings:checkout', bookingId),
    cancel: (bookingId: string, reason?: string) =>
      ipcRenderer.invoke('bookings:cancel', bookingId, reason),
  },
  waitlist: {
    list: () => ipcRenderer.invoke('waitlist:list'),
    add: (data: any) => ipcRenderer.invoke('waitlist:add', data),
    remove: (waitlistId: string, reason?: string) =>
      ipcRenderer.invoke('waitlist:remove', waitlistId, reason),
    listConfirmations: () => ipcRenderer.invoke('waitlist:listConfirmations'),
    confirm: (confirmationId: string) => ipcRenderer.invoke('waitlist:confirm', confirmationId),
    decline: (confirmationId: string) => ipcRenderer.invoke('waitlist:decline', confirmationId),
  },
  feedings: {
    listByDate: (date: string) => ipcRenderer.invoke('feedings:listByDate', date),
    checkin: (bookingId: string, date: string, timeSlot: string, operator: string, note?: string, isAnomaly?: boolean, anomalyType?: string) =>
      ipcRenderer.invoke('feedings:checkin', bookingId, date, timeSlot, operator, note, isAnomaly, anomalyType),
    stats: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('feedings:stats', startDate, endDate),
    anomalies: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('feedings:anomalies', startDate, endDate),
  },
  notifications: {
    list: () => ipcRenderer.invoke('notifications:list'),
    markRead: (id: string) => ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
  },
};

export type ApiType = typeof api;

contextBridge.exposeInMainWorld('api', api);
