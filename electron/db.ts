import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDatabase() {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  const dbPath = path.join(userDataPath, 'pet-hotel.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema();
  seedData();
}

function initSchema() {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      price_per_day REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      quota_pool INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quota_transactions (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      change_amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT,
      operator TEXT,
      related_booking_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      age INTEGER,
      weight REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      checkin_time TEXT,
      checkout_time TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      deadline TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES families(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      room_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      notified_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES families(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    );

    CREATE TABLE IF NOT EXISTS feeding_records (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      operator TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id),
      UNIQUE(booking_id, date, time_slot)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      related_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings(room_id, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_family ON bookings(family_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_waitlist_room_type ON waitlist(room_type, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
    CREATE INDEX IF NOT EXISTS idx_feeding_date ON feeding_records(date);
    CREATE INDEX IF NOT EXISTS idx_quota_family ON quota_transactions(family_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
  `);
}

function seedData() {
  if (!db) return;

  const roomCount = db.prepare('SELECT COUNT(*) as cnt FROM rooms').get() as any;
  if (roomCount.cnt === 0) {
    const rooms = [
      { id: 'r1', name: '豪华单间A', type: 'luxury', capacity: 1, description: '独立空调、电视、软床', price_per_day: 128 },
      { id: 'r2', name: '豪华单间B', type: 'luxury', capacity: 1, description: '独立空调、电视、软床', price_per_day: 128 },
      { id: 'r3', name: '标准单间A', type: 'standard', capacity: 1, description: '基础配置、独立空间', price_per_day: 88 },
      { id: 'r4', name: '标准单间B', type: 'standard', capacity: 1, description: '基础配置、独立空间', price_per_day: 88 },
      { id: 'r5', name: '家庭套房', type: 'family', capacity: 3, description: '大空间，适合多只宠物', price_per_day: 218 },
      { id: 'r6', name: '猫舍VIP', type: 'cat', capacity: 2, description: '猫咪专属，多层猫爬架', price_per_day: 98 },
    ];
    const stmt = db.prepare(
      'INSERT INTO rooms (id, name, type, capacity, description, price_per_day) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const tx = db.transaction((roomsData: any[]) => {
      for (const r of roomsData) {
        stmt.run(r.id, r.name, r.type, r.capacity, r.description, r.price_per_day);
      }
    });
    tx(rooms);

    const families = [
      { id: 'f1', name: '张三家', contact_person: '张三', phone: '13800138001', address: '北京市朝阳区', quota_pool: 30 },
      { id: 'f2', name: '李四家', contact_person: '李四', phone: '13800138002', address: '北京市海淀区', quota_pool: 15 },
    ];
    const famStmt = db.prepare(
      'INSERT INTO families (id, name, contact_person, phone, address, quota_pool) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const famTx = db.transaction((data: any[]) => {
      for (const f of data) {
        famStmt.run(f.id, f.name, f.contact_person, f.phone, f.address, f.quota_pool);
      }
    });
    famTx(families);

    const pets = [
      { id: 'p1', family_id: 'f1', name: '旺财', species: '狗', breed: '金毛', age: 3, weight: 28.5 },
      { id: 'p2', family_id: 'f1', name: '咪咪', species: '猫', breed: '英短', age: 2, weight: 4.2 },
      { id: 'p3', family_id: 'f2', name: '豆豆', species: '狗', breed: '柯基', age: 1, weight: 10.3 },
    ];
    const petStmt = db.prepare(
      'INSERT INTO pets (id, family_id, name, species, breed, age, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const petTx = db.transaction((data: any[]) => {
      for (const p of data) {
        petStmt.run(p.id, p.family_id, p.name, p.species, p.breed, p.age, p.weight);
      }
    });
    petTx(pets);
  }
}
