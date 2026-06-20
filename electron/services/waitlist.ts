import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { createBooking, createNotification } from './bookings';
import { getFamilyQuota } from './families';
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
  const room = db.prepare('SELECT type FROM rooms WHERE id = ?').get(roomId) as any;
  if (!room) return false;

  const candidates = db
    .prepare(
      `SELECT w.*, p.name as pet_name, f.name as family_name
       FROM waitlist w
       JOIN pets p ON w.pet_id = p.id
       JOIN families f ON w.family_id = f.id
       WHERE w.room_type = ?
         AND w.status IN ('waiting', 'notified')
         AND w.start_date <= ?
         AND w.end_date >= ?
       ORDER BY w.position, w.created_at
       LIMIT 5`
    )
    .all(room.type, endDate, startDate) as any[];

  for (const candidate of candidates) {
    try {
      const days = calculateDays(candidate.start_date, candidate.end_date);
      const quota = getFamilyQuota(candidate.family_id);
      if (quota.available_quota < days) {
        createNotification(
          'waitlist_skipped',
          '候补补位跳过',
          `候补 ${candidate.pet_name} 家庭额度不足，已跳过，继续通知下一位`,
          candidate.id
        );
        continue;
      }

      if (!checkRoomAvailability(roomId, candidate.start_date, candidate.end_date)) {
        continue;
      }

      createBooking({
        family_id: candidate.family_id,
        pet_id: candidate.pet_id,
        room_id: roomId,
        start_date: candidate.start_date,
        end_date: candidate.end_date,
        notes: `候补补位，原候补ID: ${candidate.id}`,
      });

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      db.prepare("UPDATE waitlist SET status = 'confirmed', notified_at = ? WHERE id = ?").run(now, candidate.id);

      createNotification(
        'waitlist_confirmed',
        '候补补位成功',
        `${candidate.family_name} 的 ${candidate.pet_name} 已从候补转为正式预订，房间已分配`,
        candidate.id
      );

      return true;
    } catch (e: any) {
      console.error('Promote waitlist failed:', candidate.id, e.message);
      continue;
    }
  }
  return false;
}
