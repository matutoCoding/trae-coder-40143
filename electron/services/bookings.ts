import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { checkRoomAvailability } from './rooms';
import { getFamilyQuota, recordQuotaChange } from './families';
import { promoteFromWaitlist } from './waitlist';
import { createCleaningTask } from './cleanings';

export type BookingStatus = 'pending' | 'checked_in' | 'checked_out' | 'cancelled' | 'expired';

export interface Booking {
  id: string;
  family_id: string;
  pet_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  checkin_time: string | null;
  checkout_time: string | null;
  status: BookingStatus;
  deadline: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function calculateDays(startDate: string, endDate: string): number {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return Math.max(1, end.diff(start, 'day') + 1);
}

export function listBookings(params?: { status?: string; family_id?: string; start_date?: string; end_date?: string }) {
  const db = getDb();
  let sql = `SELECT b.*, p.name as pet_name, f.name as family_name, r.name as room_name
             FROM bookings b
             JOIN pets p ON b.pet_id = p.id
             JOIN families f ON b.family_id = f.id
             JOIN rooms r ON b.room_id = r.id
             WHERE 1=1`;
  const values: any[] = [];
  if (params?.status) {
    sql += ' AND b.status = ?';
    values.push(params.status);
  }
  if (params?.family_id) {
    sql += ' AND b.family_id = ?';
    values.push(params.family_id);
  }
  if (params?.start_date) {
    sql += ' AND b.end_date >= ?';
    values.push(params.start_date);
  }
  if (params?.end_date) {
    sql += ' AND b.start_date <= ?';
    values.push(params.end_date);
  }
  sql += ' ORDER BY b.created_at DESC';
  return db.prepare(sql).all(...values) as any[];
}

export function createBooking(data: {
  family_id: string;
  pet_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  notes?: string;
  operator?: string;
  source?: string;
}): Booking {
  const db = getDb();
  const alreadyInTx = db.inTransaction;
  if (!alreadyInTx) {
    db.exec('BEGIN IMMEDIATE');
  }
  try {
    if (!checkRoomAvailability(data.room_id, data.start_date, data.end_date)) {
      throw new Error('该房间在所选日期已满，请选择其他日期或加入候补队列');
    }

    const days = calculateDays(data.start_date, data.end_date);
    const quota = getFamilyQuota(data.family_id);
    if (quota.available_quota < days) {
      throw new Error(`家庭共享额度不足，需要 ${days} 天额度，仅剩 ${quota.available_quota} 天`);
    }

    const room = db.prepare('SELECT price_per_day FROM rooms WHERE id = ?').get(data.room_id) as any;
    const totalAmount = (room?.price_per_day || 0) * days;
    const id = uuidv4();
    const deadline = `${data.start_date} 23:59:59`;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const source = data.source || 'normal';

    db.prepare(
      `INSERT INTO bookings (id, family_id, pet_id, room_id, start_date, end_date, status, deadline, total_amount, source, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.family_id,
      data.pet_id,
      data.room_id,
      data.start_date,
      data.end_date,
      deadline,
      totalAmount,
      source,
      data.notes || null,
      now,
      now
    );

    recordQuotaChange(data.family_id, -days, source === 'waitlist' ? '候补转正扣减额度' : '预订寄养扣减额度', id, source);

    if (!alreadyInTx) {
      db.exec('COMMIT');
    }
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Booking;
  } catch (e) {
    if (!alreadyInTx) {
      try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
    }
    throw e;
  }
}

export function checkinBooking(bookingId: string): Booking {
  const db = getDb();
  const tx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking | undefined;
    if (!booking) throw new Error('预订不存在');
    if (booking.status !== 'pending') throw new Error(`当前状态 ${booking.status} 无法办理入住`);

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare("UPDATE bookings SET status = 'checked_in', checkin_time = ?, updated_at = ? WHERE id = ?").run(
      now,
      now,
      bookingId
    );
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking;
  });
  return tx();
}

export function checkoutBooking(bookingId: string): Booking {
  const db = getDb();
  const tx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking | undefined;
    if (!booking) throw new Error('预订不存在');
    if (booking.status !== 'checked_in') throw new Error(`当前状态 ${booking.status} 无法办理退房`);

    const days = calculateDays(booking.start_date, booking.end_date);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare("UPDATE bookings SET status = 'checked_out', checkout_time = ?, updated_at = ? WHERE id = ?").run(
      now,
      now,
      bookingId
    );

    recordQuotaChange(booking.family_id, days, '退房释放额度', bookingId, booking.source || 'normal');
    promoteFromWaitlist(booking.room_id, booking.start_date, booking.end_date);
    createCleaningTask(booking.room_id, bookingId, now);

    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking;
  });
  return tx();
}

export function cancelBooking(bookingId: string, reason?: string): Booking {
  const db = getDb();
  const tx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking | undefined;
    if (!booking) throw new Error('预订不存在');
    if (booking.status === 'cancelled' || booking.status === 'checked_out' || booking.status === 'expired') {
      throw new Error(`当前状态 ${booking.status} 无法取消`);
    }

    const days = calculateDays(booking.start_date, booking.end_date);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare("UPDATE bookings SET status = 'cancelled', notes = COALESCE(?, notes), updated_at = ? WHERE id = ?").run(
      reason || null,
      now,
      bookingId
    );

    recordQuotaChange(booking.family_id, days, reason || '取消预订退还额度', bookingId, booking.source || 'normal');
    promoteFromWaitlist(booking.room_id, booking.start_date, booking.end_date);

    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking;
  });
  return tx();
}

export function expireBooking(bookingId: string): Booking {
  const db = getDb();
  const tx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking | undefined;
    if (!booking) throw new Error('预订不存在');
    if (booking.status !== 'pending') throw new Error(`当前状态 ${booking.status} 无法过期释放`);

    const days = calculateDays(booking.start_date, booking.end_date);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare("UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ?").run(now, bookingId);

    recordQuotaChange(booking.family_id, days, '超时自动释放退还额度', bookingId, booking.source || 'normal');
    promoteFromWaitlist(booking.room_id, booking.start_date, booking.end_date);
    createNotification('booking_expired', '预订超时释放', `预订 ${bookingId} 已超时自动释放，候补用户将收到通知`, bookingId);

    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking;
  });
  return tx();
}

export function checkAndExpireBookings(): number {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const expired = db
    .prepare("SELECT id FROM bookings WHERE status = 'pending' AND deadline < ?")
    .all(now) as Booking[];
  let count = 0;
  for (const b of expired) {
    try {
      expireBooking(b.id);
      count++;
    } catch (e) {
      console.error('Failed to expire booking', b.id, e);
    }
  }
  return count;
}

export function createNotification(type: string, title: string, content: string, relatedId?: string) {
  const db = getDb();
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(
    'INSERT INTO notifications (id, type, title, content, related_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id, type, title, content, relatedId || null, now);
}
