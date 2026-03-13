export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  email: string;
  createdAt: any; // Timestamp
  isOnline?: boolean;
  lastSeen?: any; // Timestamp
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
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  type?: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  createdAt: any; // Timestamp
  readBy?: string[]; // Array of userIds who have read this message
}
