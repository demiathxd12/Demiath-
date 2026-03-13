import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Chat, UserProfile } from "../types";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "motion/react";

export function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onStartChat,
  currentUserProfile,
}: {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onStartChat: (user: UserProfile) => void;
  currentUserProfile: UserProfile;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        const q = query(
          collection(db, "users"),
          where("username", ">=", searchQuery.toLowerCase()),
          where("username", "<=", searchQuery.toLowerCase() + "\uf8ff")
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map((doc) => doc.data() as UserProfile)
          .filter((user) => user.uid !== auth.currentUser?.uid);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-gray-200/50">
      <div className="px-4 pt-6 pb-2 flex justify-between items-center bg-white/70 backdrop-blur-xl sticky top-0 z-10">
        <h1 className="text-[32px] font-bold tracking-tight text-black">Messages</h1>
        <button
          onClick={() => auth.signOut()}
          className="text-[17px] text-[#007aff] font-normal hover:opacity-70 transition-opacity"
        >
          Sign Out
        </button>
      </div>

      <div className="px-4 pb-3 pt-2 bg-white/70 backdrop-blur-xl sticky top-[68px] z-10">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#007aff] transition-colors" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f2f2f7] rounded-[10px] pl-9 pr-4 py-2 text-[17px] text-black placeholder:text-gray-500 focus:outline-none focus:bg-[#e5e5ea] transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <AnimatePresence mode="popLayout">
          {searchQuery ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 space-y-0"
            >
              <h3 className="py-2 text-[13px] font-semibold text-gray-500 uppercase tracking-wider px-2">Search Results</h3>
              {isSearching ? (
                <div className="py-8 flex justify-center">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full"
                  />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <motion.button
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={user.uid}
                    onClick={() => {
                      onStartChat(user);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-[#f2f2f7] transition-all text-left group active:scale-[0.98]"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 shrink-0 text-lg font-medium shadow-sm">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-black truncate text-[17px]">{user.displayName}</p>
                      <p className="text-[15px] text-gray-500 truncate">@{user.username}</p>
                    </div>
                  </motion.button>
                ))
              ) : (
                <p className="py-8 text-center text-[15px] text-gray-500">No users found</p>
              )}
            </motion.div>
          ) : (
            <div className="px-2 space-y-0.5">
              {chats.length > 0 ? (
                chats.map((chat) => {
                  const isActive = activeChatId === chat.id;
                  const isUnread = chat.lastMessageSenderId !== auth.currentUser?.uid && 
                                   chat.lastMessageReadBy && 
                                   !chat.lastMessageReadBy.includes(auth.currentUser?.uid || '');

                  return (
                    <motion.button
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={chat.id}
                      onClick={() => onSelectChat(chat.id)}
                      className={cn(
                        "w-full flex items-center gap-3 py-3 px-3 rounded-2xl transition-all text-left relative group active:scale-[0.98]",
                        isActive ? "bg-[#007aff] shadow-lg shadow-blue-500/30" : "hover:bg-[#f2f2f7]"
                      )}
                    >
                      {chat.otherUser?.photoURL ? (
                        <img src={chat.otherUser.photoURL} alt="Profile" className="w-12 h-12 rounded-full object-cover shrink-0 shadow-sm" referrerPolicy="no-referrer" />
                      ) : (
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg font-medium shadow-sm",
                          isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
                        )}>
                          {chat.otherUser?.displayName?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <p className={cn("font-semibold truncate pr-2 text-[17px]", isActive ? "text-white" : "text-black")}>
                            {chat.otherUser?.displayName || "Unknown User"}
                          </p>
                          {chat.updatedAt && (
                            <span className={cn("text-[13px] shrink-0", isActive ? "text-blue-100" : (isUnread ? "text-[#007aff] font-semibold" : "text-gray-400"))}>
                              {formatDistanceToNow(chat.updatedAt.toDate(), { addSuffix: false }).replace('about ', '')}
                            </span>
                          )}
                        </div>
                        <p className={cn("text-[15px] truncate leading-snug", 
                          isActive ? "text-blue-100" : (isUnread ? "text-black font-medium" : "text-gray-500")
                        )}>
                          {chat.lastMessage || "Start a conversation"}
                        </p>
                      </div>
                      {isUnread && !isActive && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#007aff] rounded-full shadow-sm"></div>
                      )}
                    </motion.button>
                  );
                })
              ) : (
                <div className="py-12 text-center text-gray-500">
                  <p className="text-[17px] font-medium text-gray-400">No messages yet</p>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
