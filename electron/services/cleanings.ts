import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { createNotification } from './bookings';

export type CleaningStatus = 'pending' | 'in_progress' | 'done' | 'overdue';

export interface RoomCleaning {
  id: string;
  room_id: string;
  status: CleaningStatus;
  booking_id: string | null;
  assigned_to: string | null;
  check_out_time: string | null;
  start_cleaning_at: string | null;
  finished_at: string | null;
  inspection_note: string | null;
  inspector: string | null;
  is_overdue: number;
  created_at: string;
  updated_at: string;
}

export function createCleaningTask(roomId: string, bookingId?: string, checkOutTime?: string): RoomCleaning {
  const db = getDb();
  const tx = db.transaction(() => {
    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    db.prepare(
      `INSERT INTO room_cleanings (id, room_id, status, booking_id, check_out_time, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?)`
    ).run(id, roomId, bookingId || null, checkOutTime || null, now, now);

    db.prepare("UPDATE rooms SET cleaning_status = 'pending', updated_at = ? WHERE id = ?").run(now, roomId);

    const room = db.prepare('SELECT name FROM rooms WHERE id = ?').get(roomId) as any;
    createNotification(
      'room_cleaning',
      '房间待清洁',
      `房间「${room?.name}」退房后需要清洁`,
      id
    );

    return db.prepare('SELECT * FROM room_cleanings WHERE id = ?').get(id) as RoomCleaning;
  });
  return tx();
}

export function listCleanings(date?: string) {
  const db = getDb();
  const today = date || dayjs().format('YYYY-MM-DD');
  return db.prepare(`
    SELECT rc.*, r.name as room_name, r.type as room_type, r.capacity as room_capacity
    FROM room_cleanings rc
    JOIN rooms r ON rc.room_id = r.id
    WHERE DATE(rc.created_at) = ?
    ORDER BY rc.created_at DESC
  `).all(today) as any[];
}

export function getCleaningStats(status?: CleaningStatus | string, date?: string) {
  const db = getDb();
  const targetDate = date || dayjs().format('YYYY-MM-DD');
  if (status) {
    return db.prepare(
      "SELECT COUNT(*) as cnt FROM room_cleanings WHERE DATE(created_at) = ? AND status = ?"
    ).get(targetDate, status) as any;
  }
  return {
    pending: db.prepare("SELECT COUNT(*) as cnt FROM room_cleanings WHERE DATE(created_at) = ? AND status = 'pending'").get(targetDate) as any,
    inProgress: db.prepare("SELECT COUNT(*) as cnt FROM room_cleanings WHERE DATE(created_at) = ? AND status = 'in_progress'").get(targetDate) as any,
    done: db.prepare("SELECT COUNT(*) as cnt FROM room_cleanings WHERE DATE(created_at) = ? AND status = 'done'").get(targetDate) as any,
    overdue: db.prepare("SELECT COUNT(*) as cnt FROM room_cleanings WHERE DATE(created_at) = ? AND status = 'overdue'").get(targetDate) as any,
  };
}

export function startCleaning(cleaningId: string, assignedTo: string): RoomCleaning {
  const db = getDb();
  const tx = db.transaction(() => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(
      "UPDATE room_cleanings SET status = 'in_progress', assigned_to = ?, start_cleaning_at = ?, is_overdue = 0, updated_at = ? WHERE id = ?"
    ).run(assignedTo, now, now, cleaningId);

    db.prepare("UPDATE rooms SET cleaning_status = 'in_progress', updated_at = ? WHERE id = (SELECT room_id FROM room_cleanings WHERE id = ?)").run(now, cleaningId);

    return db.prepare('SELECT * FROM room_cleanings WHERE id = ?').get(cleaningId) as RoomCleaning;
  });
  return tx();
}

export function finishCleaning(cleaningId: string, inspector: string, note?: string): RoomCleaning {
  const db = getDb();
  const tx = db.transaction(() => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(
      "UPDATE room_cleanings SET status = 'done', finished_at = ?, inspection_note = ?, inspector = ?, is_overdue = 0, updated_at = ? WHERE id = ?"
    ).run(now, note || null, inspector, now, cleaningId);

    const roomInfo = db.prepare('SELECT room_id FROM room_cleanings WHERE id = ?').get(cleaningId) as any;
    db.prepare(
      "UPDATE rooms SET cleaning_status = 'clean', last_cleaned_at = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, roomInfo.room_id);

    const room = db.prepare('SELECT name FROM rooms WHERE id = ?').get(roomInfo.room_id) as any;
    createNotification(
      'room_cleaning_done',
      '房间清洁完成',
      `房间「${room?.name}」清洁检查完成，已重新开放预订`,
      roomInfo.room_id
    );

    return db.prepare('SELECT * FROM room_cleanings WHERE id = ?').get(cleaningId) as RoomCleaning;
  });
  return tx();
}

export function checkAndMarkOverdueCleanings(): number {
  const db = getDb();
  const now = dayjs();
  const overdueThreshold = dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss');
  const today = dayjs().format('YYYY-MM-DD');
  const overdue = db.prepare(`
    SELECT id FROM room_cleanings
    WHERE DATE(created_at) = ?
      AND status IN ('pending', 'in_progress')
      AND is_overdue = 0
      AND created_at < ?
  `).all(today, overdueThreshold) as any[];

  let count = 0;
  for (const c of overdue) {
    try {
      const info = db.prepare(`
        SELECT rc.id, r.name as room_name
        FROM room_cleanings rc JOIN rooms r ON rc.room_id = r.id
        WHERE rc.id = ?
      `).get(c.id) as any;

      db.prepare(
        "UPDATE room_cleanings SET status = 'overdue', is_overdue = 1, updated_at = ? WHERE id = ?"
      ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), c.id);

      createNotification(
        'cleaning_overdue',
        '⚠️ 清洁任务超时',
        `房间「${info.room_name}」的清洁任务已超时 2 小时未处理，请尽快安排`,
        c.id
      );
      count++;
    } catch (e) {
      console.error('Failed to mark overdue cleaning', c.id, e);
    }
  }
  return count;
}
