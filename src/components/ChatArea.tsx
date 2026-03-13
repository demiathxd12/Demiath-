import React, { useState, useEffect, useRef, FormEvent } from "react";
import { auth, db, storage } from "../firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDoc, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Chat, Message, UserProfile } from "../types";
import { Send, User as UserIcon, Plus, Mic, Check, CheckCheck, X, ChevronLeft, Download } from "lucide-react";
import { cn } from "../lib/utils";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUserStatus, setOtherUserStatus] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

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

  const handleSendMessage = async (e?: FormEvent, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string) => {
    if (e) e.preventDefault();
    if ((type === 'text' && !newMessage.trim()) || !auth.currentUser) return;

    const text = type === 'text' ? newMessage.trim() : (type === 'image' ? '📷 Image' : '🎤 Voice Note');
    if (type === 'text') setNewMessage("");

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: auth.currentUser.uid,
        text,
        type,
        ...(mediaUrl && { mediaUrl }),
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await handleSendMessage(undefined, 'image', url);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  if (!chat) return null;

  const displayUser = otherUserStatus || chat.otherUser;

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7]">
      <div className="px-2 py-2 border-b border-gray-200/50 flex items-center justify-between bg-white/70 backdrop-blur-xl sticky top-0 z-10 min-h-[56px] shadow-sm">
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
              {displayUser?.isOnline ? (
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
        
        <div className="w-10 md:hidden"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f2f2f7]">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isMine = msg.senderId === auth.currentUser?.uid;
            const msgDate = msg.createdAt?.toDate();
            const prevMsgDate = messages[index - 1]?.createdAt?.toDate();
            
            const showDateSeparator = msgDate && (!prevMsgDate || !isSameDay(msgDate, prevMsgDate));
            
            const showTime = index === 0 || 
              (msg.createdAt && messages[index - 1]?.createdAt && 
               msg.createdAt.toMillis() - messages[index - 1].createdAt.toMillis() > 300000);
            
            const isRead = msg.readBy && msg.readBy.length > 1;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center my-6"
                  >
                    <span className="px-3 py-1 bg-gray-300/30 text-gray-500 text-[11px] font-bold rounded-full uppercase tracking-wider backdrop-blur-sm">
                      {format(msgDate, "EEEE, MMM d")}
                    </span>
                  </motion.div>
                )}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10, x: isMine ? 10 : -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  transition={{ type: "spring", damping: 20, stiffness: 150 }}
                  className={cn("flex flex-col", isMine ? "items-end" : "items-start")}
                >
                  {showTime && msg.createdAt && (
                    <span className="text-[11px] font-medium text-gray-400 mb-1.5 mt-4 px-2">
                      {format(msg.createdAt.toDate(), "h:mm a")}
                    </span>
                  )}
                  <div
                    className={cn(
                      "relative max-w-[75%] px-4 py-2.5 text-[16px] flex flex-col gap-1 group shadow-sm",
                      isMine
                        ? "bg-[#007aff] text-white rounded-[20px] rounded-br-[4px] ml-auto"
                        : "bg-white text-black rounded-[20px] rounded-bl-[4px] mr-auto"
                    )}
                  >
                    {msg.type === 'image' && msg.mediaUrl ? (
                      <div className="relative overflow-hidden rounded-lg">
                        <img src={msg.mediaUrl} alt="Shared image" className="max-w-full h-auto mb-1 max-h-80 object-cover transition-transform hover:scale-[1.02] duration-300" />
                        <button 
                          onClick={() => downloadImage(msg.mediaUrl!, `image_${msg.id}.jpg`)}
                          className="absolute bottom-2 right-2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 backdrop-blur-md"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ) : msg.type === 'audio' && msg.mediaUrl ? (
                      <audio controls src={msg.mediaUrl} className="max-w-[220px] h-10 filter invert brightness-200" />
                    ) : (
                      <span className="leading-tight">{msg.text}</span>
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

      <div className="p-3 bg-white/80 backdrop-blur-xl border-t border-gray-200/50">
        <form onSubmit={(e) => handleSendMessage(e, 'text')} className="flex items-end gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isRecording}
            className="p-2 text-[#007aff] hover:bg-blue-50/50 rounded-full transition-colors disabled:opacity-50 shrink-0"
          >
            <Plus className="w-6 h-6" />
          </button>
          
          <div className="flex-1 relative flex items-center bg-[#f2f2f7] border border-gray-200 rounded-[20px] overflow-hidden transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-[#007aff]/30">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isRecording ? "Recording..." : "iMessage"}
              disabled={isRecording || isUploading}
              className="w-full bg-transparent pl-4 pr-10 py-2 text-[16px] text-black placeholder:text-gray-400 focus:outline-none transition-all disabled:opacity-50 min-h-[40px]"
            />
            {isRecording && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-2.5 h-2.5 bg-[#ff3b30] rounded-full"
                ></motion.span>
                <span className="text-xs text-[#ff3b30] font-medium">Recording</span>
              </div>
            )}
            
            {newMessage.trim() ? (
              <button
                type="submit"
                disabled={isUploading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#007aff] text-white rounded-full hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center shrink-0 shadow-sm active:scale-95"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isUploading}
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all disabled:opacity-50 flex items-center justify-center shrink-0",
                  isRecording ? "bg-[#ff3b30] text-white hover:bg-red-600 shadow-sm" : "text-gray-400 hover:text-[#007aff]"
                )}
              >
                {isRecording ? <X className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
