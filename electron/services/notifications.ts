import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  related_id: string | null;
  is_read: number;
  created_at: string;
}

export function listNotifications() {
  const db = getDb();
  return db
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')
    .all() as Notification[];
}

export function markNotificationRead(id: string) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead() {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1').run();
}

export function createNotification(type: string, title: string, content: string, relatedId?: string): Notification {
  const db = getDb();
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(
    'INSERT INTO notifications (id, type, title, content, related_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id, type, title, content, relatedId || null, now);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification;
}
