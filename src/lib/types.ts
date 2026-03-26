export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SessionMode = "local" | "session";

export interface AppProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  address: string | null;
  phone: string | null;
  alt_email: string | null;
  metadata: Json;
  is_admin: boolean;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirectoryProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  is_online: boolean;
  is_admin: boolean;
  last_seen: string | null;
}

export interface MessageRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  message_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface AdminUserEngagement {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  is_online: boolean;
  notifications_received: number;
  notifications_read: number;
  messages_sent: number;
}

export interface AdminDeliveryLog {
  message_id: string;
  sender_id: string;
  sender_username: string;
  receiver_id: string;
  receiver_username: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export type Database = any;

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  sender?: { username: string; full_name: string | null; avatar_path: string | null };
  receiver?: { username: string; full_name: string | null; avatar_path: string | null };
}
