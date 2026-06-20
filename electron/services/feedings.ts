import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export interface FeedingRecord {
  id: string;
  booking_id: string;
  pet_id: string;
  date: string;
  time_slot: string;
  operator: string;
  note: string | null;
  created_at: string;
}

export const TIME_SLOTS = ['morning', 'noon', 'evening'];
export const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '早餐',
  noon: '午餐',
  evening: '晚餐',
};

export function listFeedingByDate(date: string) {
  const db = getDb();
  const bookings = db
    .prepare(
      `SELECT b.id as booking_id, b.pet_id, p.name as pet_name, f.name as family_name, r.name as room_name
       FROM bookings b
       JOIN pets p ON b.pet_id = p.id
       JOIN families f ON b.family_id = f.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.status = 'checked_in'
         AND b.start_date <= ?
         AND b.end_date >= ?`
    )
    .all(date, date) as any[];

  const records = db
    .prepare('SELECT * FROM feeding_records WHERE date = ?')
    .all(date) as FeedingRecord[];

  const recordMap = new Map<string, FeedingRecord>();
  for (const r of records) {
    recordMap.set(`${r.booking_id}_${r.time_slot}`, r);
  }

  return bookings.map((b) => ({
    booking_id: b.booking_id,
    pet_id: b.pet_id,
    pet_name: b.pet_name,
    family_name: b.family_name,
    room_name: b.room_name,
    slots: TIME_SLOTS.map((slot) => ({
      key: slot,
      label: TIME_SLOT_LABELS[slot],
      done: recordMap.has(`${b.booking_id}_${slot}`),
      record: recordMap.get(`${b.booking_id}_${slot}`) || null,
    })),
  }));
}

export function checkinFeeding(
  bookingId: string,
  date: string,
  timeSlot: string,
  operator: string,
  note?: string
): FeedingRecord {
  const db = getDb();
  const tx = db.transaction(() => {
    const existing = db
      .prepare('SELECT id FROM feeding_records WHERE booking_id = ? AND date = ? AND time_slot = ?')
      .get(bookingId, date, timeSlot);
    if (existing) {
      throw new Error('该时段已打卡');
    }

    const booking = db.prepare('SELECT pet_id FROM bookings WHERE id = ?').get(bookingId) as any;
    if (!booking) {
      throw new Error('预订不存在');
    }

    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(
      `INSERT INTO feeding_records (id, booking_id, pet_id, date, time_slot, operator, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, bookingId, booking.pet_id, date, timeSlot, operator, note || null, now);

    return db.prepare('SELECT * FROM feeding_records WHERE id = ?').get(id) as FeedingRecord;
  });
  return tx();
}

export function getFeedingStats(startDate: string, endDate: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT date, COUNT(*) as total
       FROM feeding_records
       WHERE date >= ? AND date <= ?
       GROUP BY date
       ORDER BY date`
    )
    .all(startDate, endDate) as any[];
}
