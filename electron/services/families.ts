import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export interface Family {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string | null;
  quota_pool: number;
  created_at: string;
  updated_at: string;
}

export interface QuotaTransaction {
  id: string;
  family_id: string;
  change_amount: number;
  balance_after: number;
  reason: string | null;
  operator: string | null;
  related_booking_id: string | null;
  created_at: string;
}

let quotaLocks = new Map<string, Promise<any>>();

async function withFamilyLock<T>(familyId: string, fn: () => T): Promise<T> {
  const existingLock = quotaLocks.get(familyId);
  if (existingLock) {
    await existingLock;
  }
  let resolveLock: (value: any) => void;
  const lockPromise = new Promise<any>((resolve) => {
    resolveLock = resolve;
  });
  quotaLocks.set(familyId, lockPromise);
  try {
    return fn();
  } finally {
    quotaLocks.delete(familyId);
    resolveLock!(null);
  }
}

export function listFamilies(): Family[] {
  const db = getDb();
  return db.prepare('SELECT * FROM families ORDER BY created_at DESC').all() as Family[];
}

export function createFamily(data: Omit<Family, 'id' | 'created_at' | 'updated_at' | 'quota_pool'> & { quota_pool?: number }): Family {
  const db = getDb();
  const id = uuidv4();
  const quotaPool = data.quota_pool ?? 0;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(
    'INSERT INTO families (id, name, contact_person, phone, address, quota_pool, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, data.name, data.contact_person, data.phone, data.address || null, quotaPool, now, now);
  return db.prepare('SELECT * FROM families WHERE id = ?').get(id) as Family;
}

export function updateFamily(id: string, data: Partial<Family>): Family {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['name', 'contact_person', 'phone', 'address'];
  for (const key of allowed) {
    if (data[key as keyof Family] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key as keyof Family]);
    }
  }
  fields.push('updated_at = ?');
  values.push(now, id);
  db.prepare(`UPDATE families SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM families WHERE id = ?').get(id) as Family;
}

export function getFamilyQuota(familyId: string): { quota_pool: number; used_quota: number; available_quota: number } {
  const db = getDb();
  const family = db.prepare('SELECT quota_pool FROM families WHERE id = ?').get(familyId) as Family | undefined;
  if (!family) {
    throw new Error('家庭不存在');
  }
  const used = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(julianday(end_date) - julianday(start_date) AS INTEGER)), 0) as total_days
       FROM bookings WHERE family_id = ? AND status IN ('pending', 'checked_in')`
    )
    .get(familyId) as any;
  const usedQuota = used.total_days || 0;
  return {
    quota_pool: family.quota_pool,
    used_quota: usedQuota,
    available_quota: Math.max(0, family.quota_pool - usedQuota),
  };
}

export function adjustFamilyQuota(familyId: string, amount: number, reason: string, operator?: string, relatedBookingId?: string) {
  return withFamilyLock(familyId, () => {
    const db = getDb();
    const tx = db.transaction(() => {
      const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId) as Family | undefined;
      if (!family) {
        throw new Error('家庭不存在');
      }
      const newBalance = family.quota_pool + amount;
      if (newBalance < 0) {
        throw new Error('额度不足');
      }
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      db.prepare('UPDATE families SET quota_pool = ?, updated_at = ? WHERE id = ?').run(newBalance, now, familyId);

      const txId = uuidv4();
      db.prepare(
        `INSERT INTO quota_transactions (id, family_id, change_amount, balance_after, reason, operator, related_booking_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(txId, familyId, amount, newBalance, reason || null, operator || null, relatedBookingId || null, now);

      return {
        quota_pool: newBalance,
        transaction_id: txId,
      };
    });
    return tx();
  });
}

export function consumeQuota(familyId: string, amount: number, relatedBookingId: string, operator?: string) {
  if (amount <= 0) {
    throw new Error('扣减额度必须大于0');
  }
  return adjustFamilyQuota(familyId, -amount, '预订寄养扣减额度', operator, relatedBookingId);
}

export function refundQuota(familyId: string, amount: number, relatedBookingId: string, operator?: string) {
  if (amount <= 0) {
    throw new Error('退还额度必须大于0');
  }
  return adjustFamilyQuota(familyId, amount, '取消预订退还额度', operator, relatedBookingId);
}

export function getQuotaHistory(familyId: string): QuotaTransaction[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM quota_transactions WHERE family_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(familyId) as QuotaTransaction[];
}
