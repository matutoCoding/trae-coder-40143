import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export interface Room {
  id: string;
  name: string;
  type: string;
  capacity: number;
  description: string | null;
  price_per_day: number;
  status: string;
  cleaning_status: string;
  last_cleaned_at: string | null;
  created_at: string;
  updated_at: string;
}

export function listRooms(): Room[] {
  const db = getDb();
  return db.prepare('SELECT * FROM rooms ORDER BY created_at DESC').all() as Room[];
}

export function createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: string }): Room {
  const db = getDb();
  const id = uuidv4();
  const status = data.status || 'active';
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(
    'INSERT INTO rooms (id, name, type, capacity, description, price_per_day, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, data.name, data.type, data.capacity, data.description || null, data.price_per_day, status, now, now);
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as Room;
}

export function updateRoom(id: string, data: Partial<Room>): Room {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['name', 'type', 'capacity', 'description', 'price_per_day', 'status'];
  for (const key of allowed) {
    if (data[key as keyof Room] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key as keyof Room]);
    }
  }
  fields.push('updated_at = ?');
  values.push(now, id);
  db.prepare(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as Room;
}

export function deleteRoom(id: string): void {
  const db = getDb();
  db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run('inactive', id);
}

export function getRoomSchedule(startDate: string, endDate: string) {
  const db = getDb();
  const rooms = listRooms().filter((r) => r.status === 'active');
  const bookings = db
    .prepare(
      `SELECT b.*, p.name as pet_name, f.name as family_name
       FROM bookings b
       JOIN pets p ON b.pet_id = p.id
       JOIN families f ON b.family_id = f.id
       WHERE b.status IN ('pending', 'checked_in')
         AND b.start_date <= ?
         AND b.end_date >= ?`
    )
    .all(endDate, startDate) as any[];

  const cleanings = db.prepare(
    `SELECT room_id, status as cleaning_status FROM rooms WHERE cleaning_status IN ('pending', 'in_progress', 'overdue')`
  ).all() as any[];
  const cleaningMap = new Map(cleanings.map((c: any) => [c.room_id, c.cleaning_status]));

  return rooms.map((room) => {
    const roomBookings = bookings.filter((b) => b.room_id === room.id);
    return {
      ...room,
      bookings: roomBookings,
      cleaning_status: cleaningMap.get(room.id) || 'clean',
    };
  });
}

export function getDaySchedule(date: string) {
  const db = getDb();
  const rooms = listRooms().filter((r) => r.status === 'active');
  const bookings = db
    .prepare(
      `SELECT b.id, b.pet_id, b.start_date, b.end_date, b.status, b.deadline,
              p.name as pet_name, f.name as family_name
       FROM bookings b
       JOIN pets p ON b.pet_id = p.id
       JOIN families f ON b.family_id = f.id
       WHERE b.room_id = ?
         AND b.status IN ('pending', 'checked_in')
         AND b.start_date <= ?
         AND b.end_date >= ?`
    );

  const cleanings = db.prepare(
    `SELECT id, room_id, status as cleaning_status FROM rooms WHERE cleaning_status IN ('pending', 'in_progress', 'overdue')`
  ).all() as any[];
  const cleaningMap = new Map(cleanings.map((c: any) => [c.room_id, c.cleaning_status]));

  return rooms.map((room) => {
    const roomBookings = bookings.all(room.id, date, date) as any[];
    const occupied = roomBookings.length;
    return {
      room_id: room.id,
      room_name: room.name,
      room_type: room.type,
      capacity: room.capacity,
      price_per_day: room.price_per_day,
      occupied,
      available: Math.max(0, room.capacity - occupied),
      bookings: roomBookings,
      cleaning_status: cleaningMap.get(room.id) || 'clean',
    };
  });
}

export function getWeekSchedule(weekStart: string) {
  const db = getDb();
  const rooms = listRooms().filter((r) => r.status === 'active');
  const start = dayjs(weekStart);
  const end = start.add(6, 'day');
  const startDateStr = start.format('YYYY-MM-DD');
  const endDateStr = end.format('YYYY-MM-DD');

  const allBookings = db
    .prepare(
      `SELECT b.id, b.room_id, b.pet_id, b.start_date, b.end_date, b.status, b.deadline,
              p.name as pet_name, f.name as family_name
       FROM bookings b
       JOIN pets p ON b.pet_id = p.id
       JOIN families f ON b.family_id = f.id
       WHERE b.status IN ('pending', 'checked_in')
         AND b.start_date <= ?
         AND b.end_date >= ?`
    )
    .all(endDateStr, startDateStr) as any[];

  const cleanings = db.prepare(
    `SELECT id, room_id, status as cleaning_status FROM rooms WHERE cleaning_status IN ('pending', 'in_progress', 'overdue')`
  ).all() as any[];
  const cleaningMap = new Map(cleanings.map((c: any) => [c.room_id, c.cleaning_status]));

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(start.add(i, 'day').format('YYYY-MM-DD'));
  }

  return {
    days,
    rooms: rooms.map((room) => {
      const roomBookings = allBookings.filter((b) => b.room_id === room.id);
      const dayMap: Record<string, { date: string; occupied: number; available: number; bookings: any[] }> = {};
      for (const d of days) {
        const dayBookings = roomBookings.filter(
          (b) => b.start_date <= d && b.end_date >= d
        );
        dayMap[d] = {
          date: d,
          occupied: dayBookings.length,
          available: Math.max(0, room.capacity - dayBookings.length),
          bookings: dayBookings,
        };
      }
      return {
        room_id: room.id,
        room_name: room.name,
        room_type: room.type,
        capacity: room.capacity,
        price_per_day: room.price_per_day,
        cleaning_status: cleaningMap.get(room.id) || 'clean',
        days: dayMap,
      };
    }),
  };
}

export function checkRoomAvailability(roomId: string, startDate: string, endDate: string, excludeBookingId?: string): boolean {
  const db = getDb();
  const room = db.prepare('SELECT capacity, cleaning_status FROM rooms WHERE id = ?').get(roomId) as { capacity: number; cleaning_status: string } | undefined;
  if (!room) throw new Error('房间不存在');
  if (['pending', 'in_progress', 'overdue'].includes(room.cleaning_status)) {
    throw new Error('房间正在清洁中，暂时无法预订');
  }
  const capacity = room.capacity;

  let sql = `SELECT start_date, end_date FROM bookings
             WHERE room_id = ?
               AND status IN ('pending', 'checked_in')
               AND start_date <= ?
               AND end_date >= ?`;
  const params: any[] = [roomId, endDate, startDate];
  if (excludeBookingId) {
    sql += ' AND id != ?';
    params.push(excludeBookingId);
  }
  const overlapping = db.prepare(sql).all(...params) as { start_date: string; end_date: string }[];

  let current = dayjs(startDate);
  const end = dayjs(endDate);
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const countOnDay = overlapping.filter(
      (b) => b.start_date <= dateStr && b.end_date >= dateStr
    ).length;
    if (countOnDay >= capacity) {
      return false;
    }
    current = current.add(1, 'day');
  }

  return true;
}

export function getRoomDailySlots(roomId: string, startDate: string, endDate: string) {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as Room | undefined;
  if (!room) throw new Error('房间不存在');

  const isCleaning = ['pending', 'in_progress', 'overdue'].includes(room.cleaning_status || 'clean');

  let sql = `SELECT start_date, end_date FROM bookings
             WHERE room_id = ?
               AND status IN ('pending', 'checked_in')
               AND start_date <= ?
               AND end_date >= ?`;
  const params: any[] = [roomId, endDate, startDate];
  const overlapping = db.prepare(sql).all(...params) as { start_date: string; end_date: string }[];

  const days: { date: string; occupied: number; available: number; isFull: boolean }[] = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const countOnDay = overlapping.filter(
      (b) => b.start_date <= dateStr && b.end_date >= dateStr
    ).length;
    days.push({
      date: dateStr,
      occupied: countOnDay,
      available: isCleaning ? 0 : Math.max(0, room.capacity - countOnDay),
      isFull: isCleaning || countOnDay >= room.capacity,
    });
    current = current.add(1, 'day');
  }

  return { room_id: roomId, room_name: room.name, capacity: room.capacity, cleaning_status: room.cleaning_status || 'clean', days };
}
