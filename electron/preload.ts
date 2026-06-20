import { contextBridge, ipcRenderer } from 'electron';

const api = {
  rooms: {
    list: () => ipcRenderer.invoke('rooms:list'),
    create: (data: any) => ipcRenderer.invoke('rooms:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('rooms:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('rooms:delete', id),
    getSchedule: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('rooms:schedule', startDate, endDate),
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
  },
  feedings: {
    listByDate: (date: string) => ipcRenderer.invoke('feedings:listByDate', date),
    checkin: (bookingId: string, date: string, timeSlot: string, operator: string, note?: string) =>
      ipcRenderer.invoke('feedings:checkin', bookingId, date, timeSlot, operator, note),
    stats: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('feedings:stats', startDate, endDate),
  },
  notifications: {
    list: () => ipcRenderer.invoke('notifications:list'),
    markRead: (id: string) => ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
  },
};

export type ApiType = typeof api;

contextBridge.exposeInMainWorld('api', api);
