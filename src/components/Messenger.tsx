import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { Chat, UserProfile } from "../types";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export function Messenger({ currentUserProfile }: { currentUserProfile: UserProfile }) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const prevChatsRef = useRef<Chat[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const otherUserId = data.participants.find((id: string) => id !== auth.currentUser!.uid);
          
          let otherUser;
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            if (userDoc.exists()) {
              otherUser = userDoc.data() as UserProfile;
            }
          }

          return {
            id: docSnap.id,
            ...data,
            otherUser,
          } as Chat;
        })
      );
      
      // Check for new messages to show notifications
      if (prevChatsRef.current.length > 0) {
        chatsData.forEach(newChat => {
          const oldChat = prevChatsRef.current.find(c => c.id === newChat.id);
          if (
            oldChat && 
            newChat.updatedAt && 
            oldChat.updatedAt && 
            newChat.updatedAt.toMillis() > oldChat.updatedAt.toMillis() &&
            newChat.lastMessageSenderId !== auth.currentUser?.uid &&
            newChat.id !== activeChatId
          ) {
            // New message received in a background chat
            toast(newChat.otherUser?.displayName || "New Message", {
              description: newChat.lastMessage,
              action: {
                label: "View",
                onClick: () => setActiveChatId(newChat.id)
              }
            });
          }
        });
      }
      
      prevChatsRef.current = chatsData;
      setChats(chatsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const handleStartChat = async (otherUser: UserProfile) => {
    if (!auth.currentUser) return;
    
    // Check if chat already exists
    const existingChat = chats.find(c => c.participants.includes(otherUser.uid));
    if (existingChat) {
      setActiveChatId(existingChat.id);
      return;
    }

    // Create new chat
    const newChatRef = doc(collection(db, "chats"));
    await setDoc(newChatRef, {
      participants: [auth.currentUser.uid, otherUser.uid],
      updatedAt: serverTimestamp(),
      lastMessage: ""
    });
    
    setActiveChatId(newChatRef.id);
  };

  return (
    <div className="flex h-screen bg-white text-black overflow-hidden relative">
      <div className={cn(
        "w-full md:w-80 lg:w-96 h-full flex-shrink-0 transition-transform duration-300 md:translate-x-0",
        activeChatId ? "-translate-x-full md:translate-x-0 absolute md:relative" : "translate-x-0 relative"
      )}>
        <Sidebar 
          chats={chats} 
          activeChatId={activeChatId} 
          onSelectChat={setActiveChatId} 
          onStartChat={handleStartChat}
          currentUserProfile={currentUserProfile}
        />
      </div>
      
      <div className={cn(
        "flex-1 flex flex-col border-l border-gray-200 bg-white h-full transition-transform duration-300 md:translate-x-0",
        activeChatId ? "translate-x-0 relative" : "translate-x-full md:translate-x-0 absolute md:relative w-full"
      )}>
        {activeChatId ? (
          <ChatArea 
            chatId={activeChatId} 
            chat={chats.find(c => c.id === activeChatId)} 
            currentUserProfile={currentUserProfile}
            onBack={() => setActiveChatId(null)}
          />
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-gray-400 bg-gray-50">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p>Select a chat or search for a username to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
