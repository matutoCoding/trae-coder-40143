import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { createNotification } from './bookings';

export type HealthStatus = 'open' | 'handling' | 'pending_recheck' | 'closed';

export interface HealthFollowup {
  id: string;
  feeding_record_id: string | null;
  pet_id: string;
  family_id: string;
  anomaly_type: string;
  initial_note: string | null;
  assigned_to: string | null;
  status: HealthStatus;
  handling_result: string | null;
  recheck_time: string | null;
  close_note: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function createHealthFollowup(data: {
  feeding_record_id?: string;
  pet_id: string;
  family_id: string;
  anomaly_type: string;
  initial_note?: string;
}): HealthFollowup {
  const db = getDb();
  const tx = db.transaction(() => {
    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    db.prepare(
      `INSERT INTO health_followups (id, feeding_record_id, pet_id, family_id, anomaly_type, initial_note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`
    ).run(
      id,
      data.feeding_record_id || null,
      data.pet_id,
      data.family_id,
      data.anomaly_type,
      data.initial_note || null,
      now,
      now
    );

    const pet = db.prepare('SELECT name FROM pets WHERE id = ?').get(data.pet_id) as any;
    createNotification(
      'health_followup',
      '健康跟进单已创建',
      `宠物「${pet?.name}」的${data.anomaly_type}健康跟进单已创建，请尽快处理`,
      id
    );

    return db.prepare('SELECT * FROM health_followups WHERE id = ?').get(id) as HealthFollowup;
  });
  return tx();
}

export function listFollowups(status?: string) {
  const db = getDb();
  let sql = `
    SELECT hf.*,
           p.name as pet_name, p.species as pet_species,
           f.name as family_name, f.contact_person, f.phone as family_phone
    FROM health_followups hf
    JOIN pets p ON hf.pet_id = p.id
    JOIN families f ON hf.family_id = f.id
  `;
  const values: any[] = [];
  if (status) {
    sql += ' WHERE hf.status = ?';
    values.push(status);
  }
  sql += ' ORDER BY hf.created_at DESC';
  return db.prepare(sql).all(...values) as any[];
}

export function assignFollowup(followupId: string, assignedTo: string): HealthFollowup {
  const db = getDb();
  const tx = db.transaction(() => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(
      "UPDATE health_followups SET status = 'handling', assigned_to = ?, updated_at = ? WHERE id = ?"
    ).run(assignedTo, now, followupId);
    return db.prepare('SELECT * FROM health_followups WHERE id = ?').get(followupId) as HealthFollowup;
  });
  return tx();
}

export function recordHandling(followupId: string, result: string, recheckTime?: string): HealthFollowup {
  const db = getDb();
  const tx = db.transaction(() => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const status = recheckTime ? 'pending_recheck' : 'handling';
    db.prepare(
      "UPDATE health_followups SET status = ?, handling_result = ?, recheck_time = ?, updated_at = ? WHERE id = ?"
    ).run(status, result, recheckTime || null, now, followupId);

    const fu = db.prepare('SELECT hf.*, p.name as pet_name FROM health_followups hf JOIN pets p ON hf.pet_id = p.id WHERE hf.id = ?').get(followupId) as any;
    if (recheckTime) {
      createNotification(
        'health_recheck',
        '待复查提醒',
        `宠物「${fu.pet_name}」健康跟进等待复查，复查时间：${recheckTime}`,
        followupId
      );
    }
    return db.prepare('SELECT * FROM health_followups WHERE id = ?').get(followupId) as HealthFollowup;
  });
  return tx();
}

export function closeFollowup(followupId: string, closeNote: string): HealthFollowup {
  const db = getDb();
  const tx = db.transaction(() => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(
      "UPDATE health_followups SET status = 'closed', close_note = ?, closed_at = ?, updated_at = ? WHERE id = ?"
    ).run(closeNote, now, now, followupId);

    const fu = db.prepare('SELECT hf.*, p.name as pet_name FROM health_followups hf JOIN pets p ON hf.pet_id = p.id WHERE hf.id = ?').get(followupId) as any;
    createNotification(
      'health_closed',
      '健康跟进单关闭',
      `宠物「${fu.pet_name}」的健康跟进单已关闭：${closeNote}`,
      followupId
    );
    return db.prepare('SELECT * FROM health_followups WHERE id = ?').get(followupId) as HealthFollowup;
  });
  return tx();
}

export function getFollowupStats() {
  const db = getDb();
  return {
    open: db.prepare("SELECT COUNT(*) as cnt FROM health_followups WHERE status IN ('open', 'handling', 'pending_recheck')").get() as any,
    today: db.prepare("SELECT COUNT(*) as cnt FROM health_followups WHERE DATE(created_at) = DATE('now')").get() as any,
    closed: db.prepare("SELECT COUNT(*) as cnt FROM health_followups WHERE status = 'closed'").get() as any,
  };
}
