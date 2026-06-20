import type { ApiType } from '../electron/preload';

declare global {
  interface Window {
    api: ApiType;
  }
}

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

export interface Booking {
  id: string;
  family_id: string;
  pet_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  checkin_time: string | null;
  checkout_time: string | null;
  status: 'pending' | 'checked_in' | 'checked_out' | 'cancelled' | 'expired';
  deadline: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pet_name?: string;
  family_name?: string;
  room_name?: string;
}

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
  pet_name?: string;
  family_name?: string;
  contact_person?: string;
  phone?: string;
}

export interface QuotaInfo {
  quota_pool: number;
  used_quota: number;
  available_quota: number;
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

export interface FeedingSlot {
  key: string;
  label: string;
  done: boolean;
  record: any | null;
}

export interface FeedingRow {
  booking_id: string;
  pet_id: string;
  pet_name: string;
  family_name: string;
  room_name: string;
  slots: FeedingSlot[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  related_id: string | null;
  is_read: number;
  created_at: string;
}

export const ROOM_TYPE_LABELS: Record<string, string> = {
  luxury: '豪华间',
  standard: '标准间',
  family: '家庭套房',
  cat: '猫咪专属',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: '待入住',
  checked_in: '已入住',
  checked_out: '已退房',
  cancelled: '已取消',
  expired: '已过期',
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  checked_in: 'green',
  checked_out: 'default',
  cancelled: 'red',
  expired: 'gray',
};

export const SPECIES_LABELS: Record<string, string> = {
  dog: '狗',
  cat: '猫',
  other: '其他',
};
