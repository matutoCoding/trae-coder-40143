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
  is_handled: number;
  handled_at: string | null;
  created_at: string;
}

export function listNotifications(params?: { type?: string; handled?: boolean | 'all' }) {
  const db = getDb();
  let sql = 'SELECT * FROM notifications WHERE 1=1';
  const values: any[] = [];
  if (params?.type) {
    sql += ' AND type = ?';
    values.push(params.type);
  }
  if (params?.handled === true) {
    sql += ' AND is_handled = 1';
  } else if (params?.handled === false) {
    sql += ' AND is_handled = 0';
  }
  sql += ' ORDER BY created_at DESC LIMIT 300';
  return db.prepare(sql).all(...values) as Notification[];
}

export function listNotificationTypes() {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT type FROM notifications ORDER BY type').all() as any[];
  return rows.map((r) => r.type);
}

export function markNotificationRead(id: string) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead() {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1').run();
}

export function markNotificationHandled(id: string) {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare('UPDATE notifications SET is_handled = 1, handled_at = ?, is_read = 1 WHERE id = ?').run(now, id);
}

export function markNotificationsHandledByType(type: string) {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare("UPDATE notifications SET is_handled = 1, handled_at = ?, is_read = 1 WHERE type = ? AND is_handled = 0").run(now, type);
}

export function createNotification(type: string, title: string, content: string, relatedId?: string): Notification {
  const db = getDb();
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(
    'INSERT INTO notifications (id, type, title, content, related_id, is_read, is_handled, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
  ).run(id, type, title, content, relatedId || null, now);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Notification;
}
