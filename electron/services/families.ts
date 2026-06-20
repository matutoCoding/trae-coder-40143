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
  package_id: string | null;
  created_at: string;
}

export interface QuotaPackage {
  id: string;
  name: string;
  days: number;
  price: number;
  description: string | null;
  is_active: number;
  created_at: string;
}

function calculateDaysFromBookings(db: any, familyId: string): number {
  const result = db
    .prepare(
      `SELECT COALESCE(SUM(
        CASE
          WHEN start_date = end_date THEN 1
          ELSE CAST(julianday(end_date) - julianday(start_date) AS INTEGER) + 1
        END
      ), 0) as total_days
       FROM bookings WHERE family_id = ? AND status IN ('pending', 'checked_in')`
    )
    .get(familyId) as any;
  return result.total_days || 0;
}

export function getFamilyQuota(familyId: string): { quota_pool: number; used_quota: number; available_quota: number } {
  const db = getDb();
  const family = db.prepare('SELECT quota_pool FROM families WHERE id = ?').get(familyId) as Family | undefined;
  if (!family) throw new Error('家庭不存在');
  const usedQuota = calculateDaysFromBookings(db, familyId);
  return {
    quota_pool: family.quota_pool,
    used_quota: usedQuota,
    available_quota: Math.max(0, family.quota_pool - usedQuota),
  };
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

export function adjustFamilyQuota(familyId: string, amount: number, reason: string, operator?: string) {
  const db = getDb();
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId) as Family | undefined;
  if (!family) throw new Error('家庭不存在');

  const newTotal = family.quota_pool + amount;
  if (newTotal < 0) throw new Error('总额度不能为负数');

  const usedQuota = calculateDaysFromBookings(db, familyId);
  const newAvailable = newTotal - usedQuota;
  if (newAvailable < 0) {
    throw new Error(`调整后可用额度将为负数（已使用 ${usedQuota} 天），请先取消部分预订或增加更多额度`);
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare('UPDATE families SET quota_pool = ?, updated_at = ? WHERE id = ?').run(newTotal, now, familyId);

  const txId = uuidv4();
  db.prepare(
    `INSERT INTO quota_transactions (id, family_id, change_amount, balance_after, reason, operator, related_booking_id, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'adjust', ?)`
  ).run(txId, familyId, amount, newAvailable, reason || '管理员调整总额度', operator || null, null, now);

  return { quota_pool: newTotal, available_quota: newAvailable, transaction_id: txId };
}

export function recordQuotaChange(familyId: string, changeAmount: number, reason: string, relatedBookingId?: string, sourceType?: string) {
  const db = getDb();
  const quota = getFamilyQuota(familyId);
  const txId = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const source = sourceType || (changeAmount < 0 ? 'normal' : 'refund');
  db.prepare(
    `INSERT INTO quota_transactions (id, family_id, change_amount, balance_after, reason, operator, related_booking_id, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(txId, familyId, changeAmount, quota.available_quota, reason, null, relatedBookingId || null, source, now);
}

export function getQuotaHistory(familyId: string): QuotaTransaction[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM quota_transactions WHERE family_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(familyId) as QuotaTransaction[];
}

export function listPackages(): QuotaPackage[] {
  const db = getDb();
  return db.prepare('SELECT * FROM quota_packages WHERE is_active = 1 ORDER BY days ASC').all() as QuotaPackage[];
}

export function purchasePackage(familyId: string, packageId: string): any {
  const db = getDb();
  const tx = db.transaction(() => {
    const pkg = db.prepare('SELECT * FROM quota_packages WHERE id = ? AND is_active = 1').get(packageId) as QuotaPackage | undefined;
    if (!pkg) throw new Error('套餐不存在或已下架');

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId) as Family | undefined;
    if (!family) throw new Error('家庭不存在');

    const newTotal = family.quota_pool + pkg.days;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare('UPDATE families SET quota_pool = ?, updated_at = ? WHERE id = ?').run(newTotal, now, familyId);

    const quota = getFamilyQuota(familyId);
    const txId = uuidv4();
    db.prepare(
      `INSERT INTO quota_transactions (id, family_id, change_amount, balance_after, reason, operator, related_booking_id, package_id, source_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'package', ?)`
    ).run(txId, familyId, pkg.days, quota.available_quota, `购买${pkg.name}（+${pkg.days}天）`, null, null, packageId, now);

    return { quota_pool: newTotal, available_quota: quota.available_quota, transaction_id: txId, package: pkg };
  });
  return tx();
}

export function getMonthlyBill(familyId: string, yearMonth: string) {
  const db = getDb();
  const startDate = `${yearMonth}-01`;
  const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

  const transactions = db
    .prepare(
      `SELECT * FROM quota_transactions
       WHERE family_id = ?
         AND created_at >= ?
         AND created_at <= ?
       ORDER BY created_at ASC`
    )
    .all(familyId, `${startDate} 00:00:00`, `${endDate} 23:59:59`) as QuotaTransaction[];

  const bookings = db
    .prepare(
      `SELECT b.*, p.name as pet_name, r.name as room_name
       FROM bookings b
       JOIN pets p ON b.pet_id = p.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.family_id = ?
         AND b.created_at >= ?
         AND b.created_at <= ?
       ORDER BY b.created_at ASC`
    )
    .all(familyId, `${startDate} 00:00:00`, `${endDate} 23:59:59`) as any[];

  const packagePurchases = transactions.filter((t) => t.package_id !== null);
  const totalPurchasedDays = packagePurchases.reduce((sum, t) => sum + t.change_amount, 0);
  const totalPurchasedAmount = packagePurchases.reduce((sum, t) => {
    const pkg = db.prepare('SELECT price FROM quota_packages WHERE id = ?').get(t.package_id) as any;
    return sum + (pkg?.price || 0);
  }, 0);

  const activeBookings = bookings.filter((b) => b.status === 'checked_in' || b.status === 'checked_out');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled' || b.status === 'expired');

  const quota = getFamilyQuota(familyId);

  return {
    family_id: familyId,
    period: yearMonth,
    quota_pool: quota.quota_pool,
    used_quota: quota.used_quota,
    available_quota: quota.available_quota,
    total_purchased_days: totalPurchasedDays,
    total_purchased_amount: totalPurchasedAmount,
    active_bookings: activeBookings.length,
    cancelled_bookings: cancelledBookings.length,
    transactions,
    bookings,
  };
}
