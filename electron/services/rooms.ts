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

  return rooms.map((room) => {
    const roomBookings = bookings.filter((b) => b.room_id === room.id);
    return {
      ...room,
      bookings: roomBookings,
    };
  });
}

export function checkRoomAvailability(roomId: string, startDate: string, endDate: string, excludeBookingId?: string): boolean {
  const db = getDb();
  let sql = `SELECT COUNT(*) as cnt FROM bookings
             WHERE room_id = ?
               AND status IN ('pending', 'checked_in')
               AND start_date <= ?
               AND end_date >= ?`;
  const params: any[] = [roomId, endDate, startDate];
  if (excludeBookingId) {
    sql += ' AND id != ?';
    params.push(excludeBookingId);
  }
  const result = db.prepare(sql).get(...params) as any;
  return result.cnt === 0;
}
