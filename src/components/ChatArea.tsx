import React, { useState, useEffect, useRef, FormEvent } from "react";
import { auth, db, storage } from "../firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Chat, Message, UserProfile } from "../types";
import { Send, User as UserIcon, Mic, Check, CheckCheck, X, ChevronLeft, Smile, Trash2, Search, Slash } from "lucide-react";
import { cn } from "../lib/utils";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useAppStore } from "../store";

export function ChatArea({
  chatId,
  chat,
  currentUserProfile,
  onBack,
}: {
  chatId: string;
  chat?: Chat;
  currentUserProfile: UserProfile;
  onBack?: () => void;
}) {
  const { theme: globalTheme } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUserStatus, setOtherUserStatus] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to typing status
  useEffect(() => {
    if (!chatId || !chat?.otherUser?.uid) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const typingStatus = data.typing || {};
        setOtherUserTyping(typingStatus[chat.otherUser.uid] === true);
      }
    });
    return () => unsubscribe();
  }, [chatId, chat?.otherUser?.uid]);

  const handleTyping = async (isTypingNow: boolean) => {
    if (!chatId || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, "chats", chatId), {
        [`typing.${auth.currentUser.uid}`]: isTypingNow
      });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      handleTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      handleTyping(false);
    }, 2000);
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Filter messages based on search query
  const filteredMessages = searchQuery.trim() 
    ? messages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen to other user's online status
  useEffect(() => {
    if (!chat?.otherUser?.uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", chat.otherUser.uid), (doc) => {
      if (doc.exists()) {
        setOtherUserStatus(doc.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [chat?.otherUser?.uid]);

  // Listen to messages and mark as read
  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(msgs);
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Mark unread messages as read
      const unreadMsgs = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.senderId !== auth.currentUser?.uid && 
               (!data.readBy || !data.readBy.includes(auth.currentUser?.uid));
      });

      if (unreadMsgs.length > 0) {
        const batch = writeBatch(db);
        unreadMsgs.forEach(msgDoc => {
          const data = msgDoc.data();
          const readBy = data.readBy || [];
          batch.update(msgDoc.ref, {
            readBy: [...readBy, auth.currentUser?.uid]
          });
        });
        
        // Also update the chat document's lastMessageReadBy if the last message was unread
        const lastMsg = snapshot.docs[snapshot.docs.length - 1]?.data();
        if (lastMsg && lastMsg.senderId !== auth.currentUser?.uid) {
          batch.update(doc(db, "chats", chatId), {
            lastMessageReadBy: [...(lastMsg.readBy || []), auth.currentUser?.uid]
          });
        }
        
        await batch.commit();
      }
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleBlockUser = async () => {
    if (!chat?.otherUser?.uid || !auth.currentUser) return;
    
    const isBlocked = currentUserProfile.blockedUsers?.includes(chat.otherUser.uid);
    const updatedBlockedUsers = isBlocked
      ? currentUserProfile.blockedUsers?.filter(id => id !== chat.otherUser.uid)
      : [...(currentUserProfile.blockedUsers || []), chat.otherUser.uid];

    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        blockedUsers: updatedBlockedUsers
      });
      toast.success(isBlocked ? "User unblocked" : "User blocked");
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to update block status");
    }
  };

  const isOtherUserBlocked = currentUserProfile.blockedUsers?.includes(chat?.otherUser?.uid || "");
  const amIBlocked = otherUserStatus?.blockedUsers?.includes(auth.currentUser?.uid || "");

  const handleSendMessage = async (e?: FormEvent, type: 'text' | 'audio' = 'text', mediaUrl?: string) => {
    if (e) e.preventDefault();
    if ((type === 'text' && !newMessage.trim()) || !auth.currentUser) return;

    const text = type === 'text' ? newMessage.trim() : '🎤 Voice Note';
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderId: replyingTo.senderId
    } : null;

    if (type === 'text') {
      setNewMessage("");
      setIsTyping(false);
      handleTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
    setReplyingTo(null);

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: auth.currentUser.uid,
        text,
        type,
        ...(mediaUrl && { mediaUrl }),
        ...(replyData && { replyTo: replyData }),
        createdAt: serverTimestamp(),
        readBy: [auth.currentUser.uid]
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        lastMessageSenderId: auth.currentUser.uid,
        lastMessageReadBy: [auth.currentUser.uid],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setIsUploading(true);
        try {
          const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_audio.webm`);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          await handleSendMessage(undefined, 'audio', url);
        } catch (error) {
          console.error("Error uploading audio:", error);
          toast.error("Failed to send voice note");
        } finally {
          setIsUploading(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  if (!chat) return null;

  const displayUser = otherUserStatus || chat.otherUser;

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7]">
      <div className="px-2 py-2 border-b border-gray-200/50 flex flex-col bg-white/70 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between min-h-[48px]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onBack && (
              <button 
                onClick={onBack}
                className="md:hidden p-2 -ml-1 text-[#007aff] hover:bg-blue-50/50 rounded-full transition-colors flex items-center gap-0.5"
              >
                <ChevronLeft className="w-7 h-7" />
                <span className="text-[17px] -ml-1 font-medium">Back</span>
              </button>
            )}
            
            <div className="flex items-center gap-2 mx-auto md:mx-0 truncate">
              {displayUser?.photoURL ? (
                <img src={displayUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 shrink-0 shadow-sm">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <h2 className="font-semibold text-[15px] text-black leading-tight truncate">{displayUser?.displayName || "Unknown User"}</h2>
                {otherUserTyping ? (
                  <span className="text-[11px] text-[#007aff] font-medium animate-pulse">typing...</span>
                ) : displayUser?.isOnline ? (
                  <span className="text-[11px] text-[#34c759] font-medium">Online</span>
                ) : displayUser?.lastSeen ? (
                  <span className="text-[11px] text-gray-500 truncate">
                    {formatDistanceToNow(displayUser.lastSeen.toDate(), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-500">Offline</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery("");
              }}
              className={cn(
                "p-2 rounded-full transition-colors",
                showSearch ? "text-[#007aff] bg-blue-50" : "text-gray-400 hover:text-[#007aff] hover:bg-blue-50"
              )}
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={handleBlockUser}
              className={cn(
                "p-2 rounded-full transition-colors",
                isOtherUserBlocked ? "text-red-500 bg-red-50" : "text-gray-400 hover:text-red-500 hover:bg-red-50"
              )}
              title={isOtherUserBlocked ? "Unblock User" : "Block User"}
            >
              <Slash className="w-5 h-5" />
            </button>
            <div className="w-10 md:hidden"></div>
          </div>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 pt-1">
                <div className="relative flex items-center bg-[#f2f2f7] rounded-lg px-3 py-1.5">
                  <Search className="w-4 h-4 text-gray-400 mr-2" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="bg-transparent text-[14px] text-black focus:outline-none w-full"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f2f2f7] dark:bg-black">
        <AnimatePresence initial={false}>
          {filteredMessages.map((msg, index) => {
            const isMine = msg.senderId === auth.currentUser?.uid;
            const msgDate = msg.createdAt?.toDate();
            const prevMsgDate = filteredMessages[index - 1]?.createdAt?.toDate();
            
            const showDateSeparator = msgDate && (!prevMsgDate || !isSameDay(msgDate, prevMsgDate));
            
            const showTime = index === 0 || 
              (msg.createdAt && filteredMessages[index - 1]?.createdAt && 
               msg.createdAt.toMillis() - filteredMessages[index - 1].createdAt.toMillis() > 300000);
            
            const isRead = msg.readBy && msg.readBy.length > 1;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center my-6"
                  >
                    <span className="px-3 py-1 bg-gray-300/30 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[11px] font-bold rounded-full uppercase tracking-wider backdrop-blur-sm">
                      {format(msgDate, "EEEE, MMM d")}
                    </span>
                  </motion.div>
                )}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10, x: isMine ? 10 : -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  transition={{ type: "spring", damping: 20, stiffness: 150 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 50 && !isMine) {
                      setReplyingTo(msg);
                    } else if (info.offset.x < -50 && isMine) {
                      setReplyingTo(msg);
                    }
                  }}
                  className={cn("flex flex-col", isMine ? "items-end" : "items-start")}
                >
                  {showTime && msg.createdAt && (
                    <span className="text-[11px] font-medium text-gray-400 mb-1.5 mt-4 px-2">
                      {format(msg.createdAt.toDate(), "h:mm a")}
                    </span>
                  )}
                  <div
                    className={cn(
                      "relative max-w-[85%] px-4 py-2.5 text-[16px] flex flex-col gap-1 group shadow-sm transition-all",
                      isMine
                        ? "bg-[#007aff] text-white rounded-[20px] rounded-br-[4px] ml-auto"
                        : "bg-white dark:bg-[#262629] text-black dark:text-white rounded-[20px] rounded-bl-[4px] mr-auto"
                    )}
                  >
                    {msg.replyTo && (
                      <div className={cn(
                        "mb-1 p-2 rounded-lg text-xs border-l-4",
                        isMine ? "bg-white/10 border-white/50 text-white/90" : "bg-gray-100 dark:bg-black/20 border-[#007aff] text-gray-600 dark:text-gray-400"
                      )}>
                        <p className="font-bold mb-0.5">
                          {msg.replyTo.senderId === auth.currentUser?.uid ? "You" : (otherUserStatus?.displayName || chat?.otherUser?.displayName || "User")}
                        </p>
                        <p className="truncate opacity-80">{msg.replyTo.text}</p>
                      </div>
                    )}
                    {msg.type === 'audio' && msg.mediaUrl ? (
                      <div className="flex items-center gap-2">
                        <audio controls src={msg.mediaUrl} className="max-w-[220px] h-10 filter invert brightness-200" />
                        {isMine && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-2 text-white/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <span className="leading-tight break-words">{msg.text}</span>
                        {isMine && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 text-white/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 -mr-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    {isMine && (
                      <div className="self-end flex items-center -mb-1 -mr-1 mt-1">
                        {isRead ? (
                          <span className="text-[10px] text-blue-100/90 font-medium tracking-wide uppercase">Read</span>
                        ) : (
                          <span className="text-[10px] text-blue-100/60 font-medium tracking-wide uppercase">Delivered</span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 sticky bottom-0 z-20">
        {isOtherUserBlocked ? (
          <div className="py-2 text-center">
            <p className="text-[15px] text-gray-500 dark:text-gray-400 font-medium italic">
              You have blocked this user. Unblock to send messages.
            </p>
          </div>
        ) : amIBlocked ? (
          <div className="py-2 text-center">
            <p className="text-[15px] text-gray-500 dark:text-gray-400 font-medium italic">
              You cannot send messages to this user.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => handleSendMessage(e, 'text')} className="flex flex-col gap-2">
            <AnimatePresence>
              {replyingTo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-gray-100 dark:bg-white/5 rounded-xl px-3 py-2 border-l-4 border-[#007aff] flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#007aff]">Replying to {replyingTo.senderId === auth.currentUser?.uid ? "yourself" : (displayUser?.displayName || "User")}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{replyingTo.text}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2">
              <button 
                type="button"
                className="p-2 text-[#007aff] hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors shrink-0"
              >
                <Mic className="w-6 h-6" />
              </button>
              
              <div className="flex-1 relative">
                <input 
                  type="text"
                  value={newMessage}
                  onChange={onInputChange}
                  placeholder="iMessage"
                  className="w-full bg-white dark:bg-black border border-gray-300 dark:border-white/20 rounded-[20px] px-4 py-2 text-[17px] focus:outline-none focus:border-[#007aff] dark:focus:border-[#007aff] transition-colors dark:text-white"
                />
                <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <Smile className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-[#007aff] text-white rounded-full disabled:opacity-30 active:scale-95 transition-all shadow-sm shrink-0"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
          </form>
        )}
        
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-full right-4 mb-2 z-50">
            <EmojiPicker 
              onEmojiClick={onEmojiClick}
              theme={globalTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
              lazyLoadEmojis={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
