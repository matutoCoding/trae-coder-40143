import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { createBooking, createNotification } from './bookings';
import { getFamilyQuota, recordQuotaChange } from './families';
import { checkRoomAvailability } from './rooms';

export interface WaitlistEntry {
  id: string;
  family_id: string;
  pet_id: string;
  room_type: string;
  start_date: string;
  end_date: string;
  position: number;
  status: 'waiting' | 'notified' | 'confirmed' | 'cancelled';
  notified_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface WaitlistConfirmation {
  id: string;
  waitlist_id: string;
  family_id: string;
  pet_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'confirmed' | 'declined' | 'expired';
  confirm_deadline: string;
  created_at: string;
  confirmed_at: string | null;
}

function calculateDays(startDate: string, endDate: string): number {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return Math.max(1, end.diff(start, 'day') + 1);
}

export function listWaitlist() {
  const db = getDb();
  return db
    .prepare(
      `SELECT w.*, p.name as pet_name, f.name as family_name, f.contact_person, f.phone
       FROM waitlist w
       JOIN pets p ON w.pet_id = p.id
       JOIN families f ON w.family_id = f.id
       WHERE w.status IN ('waiting', 'notified')
       ORDER BY w.room_type, w.position, w.created_at`
    )
    .all() as any[];
}

export function listConfirmations() {
  const db = getDb();
  return db
    .prepare(
      `SELECT wc.*, p.name as pet_name, f.name as family_name, f.contact_person, f.phone, r.name as room_name
       FROM waitlist_confirmations wc
       JOIN pets p ON wc.pet_id = p.id
       JOIN families f ON wc.family_id = f.id
       JOIN rooms r ON wc.room_id = r.id
       WHERE wc.status = 'pending'
       ORDER BY wc.confirm_deadline ASC`
    )
    .all() as any[];
}

function getNextPosition(roomType: string): number {
  const db = getDb();
  const result = db
    .prepare("SELECT MAX(position) as max_pos FROM waitlist WHERE room_type = ? AND status IN ('waiting', 'notified')")
    .get(roomType) as any;
  return (result.max_pos || 0) + 1;
}

export function addToWaitlist(data: {
  family_id: string;
  pet_id: string;
  room_type: string;
  start_date: string;
  end_date: string;
  notes?: string;
}): WaitlistEntry {
  const db = getDb();
  const tx = db.transaction(() => {
    const position = getNextPosition(data.room_type);
    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(
      `INSERT INTO waitlist (id, family_id, pet_id, room_type, start_date, end_date, position, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`
    ).run(
      id,
      data.family_id,
      data.pet_id,
      data.room_type,
      data.start_date,
      data.end_date,
      position,
      data.notes || null,
      now
    );
    return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(id) as WaitlistEntry;
  });
  return tx();
}

export function removeFromWaitlist(waitlistId: string, reason?: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const entry = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId) as WaitlistEntry | undefined;
    if (!entry) return;

    db.prepare("UPDATE waitlist SET status = 'cancelled', notes = COALESCE(?, notes) WHERE id = ?").run(
      reason || null,
      waitlistId
    );

    db.prepare("UPDATE waitlist_confirmations SET status = 'declined' WHERE waitlist_id = ? AND status = 'pending'").run(waitlistId);

    const remaining = db
      .prepare(
        "SELECT id FROM waitlist WHERE room_type = ? AND status IN ('waiting', 'notified') AND position > ? ORDER BY position"
      )
      .all(entry.room_type, entry.position) as WaitlistEntry[];
    for (const r of remaining) {
      db.prepare('UPDATE waitlist SET position = position - 1 WHERE id = ?').run(r.id);
    }
  });
  tx();
}

export function promoteFromWaitlist(roomId: string, startDate: string, endDate: string): boolean {
  const db = getDb();
  const room = db.prepare('SELECT type, capacity FROM rooms WHERE id = ?').get(roomId) as any;
  if (!room) return false;

  const candidates = db
    .prepare(
      `SELECT w.*, p.name as pet_name, f.name as family_name
       FROM waitlist w
       JOIN pets p ON w.pet_id = p.id
       JOIN families f ON w.family_id = f.id
       WHERE w.room_type = ?
         AND w.status IN ('waiting')
         AND w.start_date <= ?
         AND w.end_date >= ?
       ORDER BY w.position, w.created_at
       LIMIT 20`
    )
    .all(room.type, endDate, startDate) as any[];

  for (const candidate of candidates) {
    try {
      if (candidate.last_notified_room_id === roomId) {
        continue;
      }

      const days = calculateDays(candidate.start_date, candidate.end_date);
      const quota = getFamilyQuota(candidate.family_id);
      if (quota.available_quota < days) {
        createNotification(
          'waitlist_skipped',
          '候补补位跳过',
          `候补 ${candidate.pet_name} 家庭额度不足，已跳过`,
          candidate.id
        );
        continue;
      }

      if (!checkRoomAvailability(roomId, candidate.start_date, candidate.end_date)) {
        continue;
      }

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const confirmDeadline = dayjs().add(2, 'hour').format('YYYY-MM-DD HH:mm:ss');
      const confirmId = uuidv4();

      db.prepare(
        `INSERT INTO waitlist_confirmations (id, waitlist_id, family_id, pet_id, room_id, start_date, end_date, status, confirm_deadline, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(
        confirmId,
        candidate.id,
        candidate.family_id,
        candidate.pet_id,
        roomId,
        candidate.start_date,
        candidate.end_date,
        confirmDeadline,
        now
      );

      db.prepare("UPDATE waitlist SET status = 'notified', notified_at = ?, last_notified_room_id = ? WHERE id = ?").run(now, roomId, candidate.id);

      createNotification(
        'waitlist_confirm_pending',
        '候补补位通知 - 请确认',
        `${candidate.family_name} 的 ${candidate.pet_name} 有空位了！请在 ${dayjs(confirmDeadline).format('HH:mm')} 前确认，否则将通知下一位`,
        confirmId
      );

      return true;
    } catch (e: any) {
      console.error('Promote waitlist failed:', candidate.id, e.message);
      continue;
    }
  }
  return false;
}

export function confirmWaitlist(confirmationId: string): any {
  const db = getDb();
  const tx = db.transaction(() => {
    const confirm = db.prepare('SELECT * FROM waitlist_confirmations WHERE id = ?').get(confirmationId) as WaitlistConfirmation | undefined;
    if (!confirm) throw new Error('确认记录不存在');
    if (confirm.status !== 'pending') throw new Error(`当前状态 ${confirm.status} 无法确认`);

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    if (dayjs(confirm.confirm_deadline).isBefore(dayjs())) {
      db.prepare("UPDATE waitlist_confirmations SET status = 'expired' WHERE id = ?").run(confirmationId);
      throw new Error('确认已超时');
    }

    if (!checkRoomAvailability(confirm.room_id, confirm.start_date, confirm.end_date)) {
      db.prepare("UPDATE waitlist_confirmations SET status = 'declined' WHERE id = ?").run(confirmationId);
      throw new Error('房间已满，无法确认');
    }

    const days = calculateDays(confirm.start_date, confirm.end_date);
    const quota = getFamilyQuota(confirm.family_id);
    if (quota.available_quota < days) {
      db.prepare("UPDATE waitlist_confirmations SET status = 'declined' WHERE id = ?").run(confirmationId);
      throw new Error('额度不足，无法确认');
    }

    const booking = createBooking({
      family_id: confirm.family_id,
      pet_id: confirm.pet_id,
      room_id: confirm.room_id,
      start_date: confirm.start_date,
      end_date: confirm.end_date,
      notes: `候补补位确认，确认ID: ${confirmationId}`,
      source: 'waitlist',
    });

    db.prepare("UPDATE waitlist_confirmations SET status = 'confirmed', confirmed_at = ? WHERE id = ?").run(now, confirmationId);
    db.prepare("UPDATE waitlist SET status = 'confirmed', notified_at = COALESCE(notified_at, ?) WHERE id = ?").run(now, confirm.waitlist_id);

    createNotification(
      'waitlist_confirmed',
      '候补补位成功',
      `候补确认成功，已转为正式预订`,
      confirmationId
    );

    return booking;
  });
  return tx();
}

export function declineWaitlist(confirmationId: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const confirm = db.prepare('SELECT * FROM waitlist_confirmations WHERE id = ?').get(confirmationId) as WaitlistConfirmation | undefined;
    if (!confirm) throw new Error('确认记录不存在');
    if (confirm.status !== 'pending') throw new Error(`当前状态 ${confirm.status} 无法操作`);

    db.prepare("UPDATE waitlist_confirmations SET status = 'declined' WHERE id = ?").run(confirmationId);
    db.prepare("UPDATE waitlist SET status = 'cancelled' WHERE id = ?").run(confirm.waitlist_id);

    createNotification(
      'waitlist_declined',
      '候补补位放弃',
      `家庭已放弃候补补位，将通知下一位`,
      confirmationId
    );

    promoteFromWaitlist(confirm.room_id, confirm.start_date, confirm.end_date);
  });
  tx();
}

export function checkAndExpireConfirmations(): number {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const expired = db
    .prepare("SELECT * FROM waitlist_confirmations WHERE status = 'pending' AND confirm_deadline < ?")
    .all(now) as WaitlistConfirmation[];
  let count = 0;
  for (const c of expired) {
    try {
      const tx = db.transaction(() => {
        db.prepare("UPDATE waitlist_confirmations SET status = 'expired' WHERE id = ?").run(c.id);
        db.prepare("UPDATE waitlist SET status = 'cancelled' WHERE id = ?").run(c.waitlist_id);

        createNotification(
          'waitlist_confirm_expired',
          '候补确认超时',
          `候补确认已超时，将自动通知下一位，原候补不再重复通知`,
          c.id
        );

        promoteFromWaitlist(c.room_id, c.start_date, c.end_date);
      });
      tx();
      count++;
    } catch (e) {
      console.error('Failed to expire confirmation', c.id, e);
    }
  }
  return count;
}
