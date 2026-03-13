export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  email: string;
  createdAt: any; // Timestamp
  isOnline?: boolean;
  lastSeen?: any; // Timestamp
  blockedUsers?: string[]; // Array of UIDs
  status?: string;
  bio?: string;
  phoneNumber?: string;
  theme?: 'light' | 'dark';
}

export interface Chat {
  id: string;
  participants: string[];
  updatedAt: any; // Timestamp
  lastMessage?: string;
  lastMessageSenderId?: string;
  lastMessageReadBy?: string[];
  otherUser?: UserProfile; // Added client-side
  unreadCount?: Record<string, number>;
  typing?: Record<string, boolean>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  type?: 'text' | 'audio';
  mediaUrl?: string;
  createdAt: any; // Timestamp
  readBy?: string[]; // Array of userIds who have read this message
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
  };
}
