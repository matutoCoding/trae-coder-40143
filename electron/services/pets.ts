import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export interface Pet {
  id: string;
  family_id: string;
  name: string;
  species: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listPetsByFamily(familyId: string): Pet[] {
  const db = getDb();
  return db.prepare('SELECT * FROM pets WHERE family_id = ? ORDER BY created_at DESC').all(familyId) as Pet[];
}

export function createPet(data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>): Pet {
  const db = getDb();
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(
    `INSERT INTO pets (id, family_id, name, species, breed, age, weight, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.family_id,
    data.name,
    data.species,
    data.breed || null,
    data.age || null,
    data.weight || null,
    data.notes || null,
    now,
    now
  );
  return db.prepare('SELECT * FROM pets WHERE id = ?').get(id) as Pet;
}

export function updatePet(id: string, data: Partial<Pet>): Pet {
  const db = getDb();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['family_id', 'name', 'species', 'breed', 'age', 'weight', 'notes'];
  for (const key of allowed) {
    if (data[key as keyof Pet] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key as keyof Pet]);
    }
  }
  fields.push('updated_at = ?');
  values.push(now, id);
  db.prepare(`UPDATE pets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM pets WHERE id = ?').get(id) as Pet;
}

export function deletePet(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM pets WHERE id = ?').run(id);
}
