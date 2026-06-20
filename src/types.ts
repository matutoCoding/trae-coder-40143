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
  source: string;
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

export interface WaitlistConfirmation {
  id: string;
  waitlist_id: string;
  family_id: string;
  pet_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'confirmed' | 'declined' | 'expired';
  confirm_deadline: string;
  created_at: string;
  confirmed_at: string | null;
  pet_name?: string;
  family_name?: string;
  room_name?: string;
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
  package_id: string | null;
  source_type: string;
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
  is_handled: number;
  handled_at: string | null;
  created_at: string;
}

export interface RoomCleaning {
  id: string;
  room_id: string;
  room_name?: string;
  room_type?: string;
  room_capacity?: number;
  status: 'pending' | 'in_progress' | 'done' | 'overdue';
  booking_id: string | null;
  assigned_to: string | null;
  check_out_time: string | null;
  start_cleaning_at: string | null;
  finished_at: string | null;
  inspection_note: string | null;
  inspector: string | null;
  is_overdue: number;
  created_at: string;
  updated_at: string;
}

export interface HealthFollowup {
  id: string;
  feeding_record_id: string | null;
  pet_id: string;
  pet_name?: string;
  pet_species?: string;
  family_id: string;
  family_name?: string;
  contact_person?: string;
  family_phone?: string;
  anomaly_type: string;
  initial_note: string | null;
  assigned_to: string | null;
  status: 'open' | 'handling' | 'pending_recheck' | 'closed';
  handling_result: string | null;
  recheck_time: string | null;
  close_note: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayScheduleRoom {
  room_id: string;
  room_name: string;
  room_type: string;
  capacity: number;
  price_per_day: number;
  occupied: number;
  available: number;
  bookings: any[];
}

export interface WeekScheduleRoom {
  room_id: string;
  room_name: string;
  room_type: string;
  capacity: number;
  price_per_day: number;
  cleaning_status?: string;
  days: Record<string, { date: string; occupied: number; available: number; bookings: any[] }>;
}

export interface DailySlots {
  room_id: string;
  room_name: string;
  capacity: number;
  cleaning_status?: string;
  days: { date: string; occupied: number; available: number; isFull: boolean }[];
}

export interface MonthlyBill {
  family_id: string;
  period: string;
  quota_pool: number;
  used_quota: number;
  available_quota: number;
  total_purchased_days: number;
  total_purchased_amount: number;
  active_bookings: number;
  cancelled_bookings: number;
  transactions: QuotaTransaction[];
  bookings: any[];
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

export const ANOMALY_TYPE_LABELS: Record<string, string> = {
  food_refusal: '拒食',
  vomiting: '呕吐',
  lethargy: '精神差',
  diarrhea: '腹泻',
  other: '其他异常',
};

export const SPECIES_LABELS: Record<string, string> = {
  dog: '狗',
  cat: '猫',
  other: '其他',
};
