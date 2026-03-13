import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { UserProfile } from "../types";
import { toast } from "sonner";
import { motion } from "motion/react";
import { ChevronLeft, User, Camera, Bell, Shield, LogOut, Info, Check, Smile, Slash, Globe, Lock, Database, HardDrive } from "lucide-react";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";

export function Settings({ 
  profile, 
  onBack,
  onUpdateProfile
}: { 
  profile: UserProfile; 
  onBack: () => void;
  onUpdateProfile: (newProfile: UserProfile) => void;
}) {
  const { theme: globalTheme, setTheme: setGlobalTheme } = useAppStore();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [photoURL, setPhotoURL] = useState(profile.photoURL || "");
  const [status, setStatus] = useState(profile.status || "Available");
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  const blockedCount = profile.blockedUsers?.length || 0;

  const handleThemeToggle = async () => {
    const newTheme = globalTheme === 'light' ? 'dark' : 'light';
    setGlobalTheme(newTheme);
    
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        theme: newTheme
      });
    } catch (error) {
      console.error("Error updating theme:", error);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const userRef = doc(db, "users", profile.uid);
      const updates = {
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || null,
        status: status.trim() || "Available"
      };
      
      await updateDoc(userRef, updates);
      onUpdateProfile({ ...profile, ...updates });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] dark:bg-black transition-colors duration-300">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={onBack}
            className="flex items-center text-[#007aff] text-[17px] font-normal active:opacity-50 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6 -ml-2" />
            <span>Back</span>
          </button>
          <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2 dark:text-white">Settings</h1>
          <button 
            onClick={handleSave}
            disabled={isSaving || (displayName === profile.displayName && photoURL === (profile.photoURL || "") && status === (profile.status || "Available"))}
            className="text-[#007aff] text-[17px] font-semibold disabled:opacity-30 active:opacity-50 transition-opacity"
          >
            {isSaving ? "Saving..." : "Done"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10">
        {/* Profile Section */}
        <div className="mt-8 px-4 flex flex-col items-center">
          <div className="relative group">
            {photoURL ? (
              <img 
                src={photoURL} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover shadow-md border-2 border-white dark:border-white/20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-200 dark:bg-white/10 rounded-full flex items-center justify-center text-gray-400 shadow-md border-2 border-white dark:border-white/20">
                <User className="w-12 h-12" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="text-white w-6 h-6" />
            </div>
          </div>
          <h2 className="mt-4 text-[22px] font-bold text-black dark:text-white">{displayName || profile.displayName}</h2>
          <p className="text-[15px] text-gray-500 dark:text-gray-400">@{profile.username}</p>
        </div>

        {/* Settings Groups */}
        <div className="mt-8 space-y-8">
          {/* Account Group */}
          <section>
            <h3 className="px-4 mb-2 text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account</h3>
            <div className="bg-white dark:bg-[#1c1c1e] border-y border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/10">
              <div className="px-4 py-3 flex items-center gap-4">
                <span className="text-[17px] text-black dark:text-white w-24 shrink-0">Name</span>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 bg-transparent text-[17px] text-black dark:text-white focus:outline-none"
                  placeholder="Your display name"
                />
              </div>
              <div className="px-4 py-3 flex items-center gap-4">
                <span className="text-[17px] text-black dark:text-white w-24 shrink-0">Status</span>
                <input 
                  type="text" 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex-1 bg-transparent text-[17px] text-black dark:text-white focus:outline-none"
                  placeholder="Available"
                />
              </div>
              <div className="px-4 py-3 flex items-center gap-4">
                <span className="text-[17px] text-black dark:text-white w-24 shrink-0">Photo URL</span>
                <input 
                  type="text" 
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="flex-1 bg-transparent text-[17px] text-black dark:text-white focus:outline-none"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>
          </section>

          {/* Preferences Group */}
          <section>
            <h3 className="px-4 mb-2 text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wider">System Configuration</h3>
            <div className="bg-white dark:bg-[#1c1c1e] border-y border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/10">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center">
                    <Bell className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">Notifications</span>
                </div>
                <button 
                  onClick={() => setNotifications(!notifications)}
                  className={cn(
                    "w-12 h-7 rounded-full transition-all relative",
                    notifications ? "bg-[#34c759]" : "bg-gray-200 dark:bg-white/20"
                  )}
                >
                  <motion.div 
                    animate={{ x: notifications ? 22 : 2 }}
                    className="absolute top-1 left-0 w-5 h-5 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Shield className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">Read Receipts</span>
                </div>
                <button 
                  onClick={() => setReadReceipts(!readReceipts)}
                  className={cn(
                    "w-12 h-7 rounded-full transition-all relative",
                    readReceipts ? "bg-[#34c759]" : "bg-gray-200 dark:bg-white/20"
                  )}
                >
                  <motion.div 
                    animate={{ x: readReceipts ? 22 : 2 }}
                    className="absolute top-1 left-0 w-5 h-5 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Smile className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">Theme</span>
                </div>
                <button 
                  onClick={handleThemeToggle}
                  className="px-3 py-1 bg-[#f2f2f7] dark:bg-white/10 rounded-lg text-[13px] font-medium text-[#007aff]"
                >
                  {globalTheme === 'light' ? 'Light' : 'Dark'}
                </button>
              </div>
            </div>
          </section>

          {/* Privacy Group */}
          <section>
            <h3 className="px-4 mb-2 text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wider">Privacy</h3>
            <div className="bg-white dark:bg-[#1c1c1e] border-y border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/10">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-gray-900 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Slash className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">Blocked Contacts</span>
                </div>
                <span className="text-[17px] text-gray-400">{blockedCount}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <Lock className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">End-to-End Encryption</span>
                </div>
                <span className="text-[13px] text-[#34c759] font-medium">Active</span>
              </div>
            </div>
          </section>

          {/* Data & Storage Group */}
          <section>
            <h3 className="px-4 mb-2 text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data & Storage</h3>
            <div className="bg-white dark:bg-[#1c1c1e] border-y border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/10">
              <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
                    <Database className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">Data Usage</span>
                </div>
                <span className="text-[15px] text-gray-400">1.2 GB</span>
              </button>
              <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <HardDrive className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">Storage Management</span>
                </div>
                <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180" />
              </button>
            </div>
          </section>

          {/* About Group */}
          <section>
            <div className="bg-white dark:bg-[#1c1c1e] border-y border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/10">
              <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-gray-400 rounded-lg flex items-center justify-center">
                    <Info className="text-white w-4 h-4" />
                  </div>
                  <span className="text-[17px] text-black dark:text-white">About iMessage</span>
                </div>
                <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180" />
              </button>
            </div>
          </section>

          {/* Logout Group */}
          <section>
            <div className="bg-white dark:bg-[#1c1c1e] border-y border-gray-200 dark:border-white/10">
              <button 
                onClick={() => auth.signOut()}
                className="w-full px-4 py-3 flex items-center justify-center text-red-500 text-[17px] font-normal hover:bg-red-50 dark:hover:bg-red-900/10 active:bg-red-100 transition-colors"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Sign Out
              </button>
            </div>
          </section>

          <div className="px-4 text-center">
            <p className="text-[13px] text-gray-400">iMessage Clone v2.1.0</p>
            <p className="text-[13px] text-gray-400">Powered by Google AI Studio</p>
          </div>
        </div>
      </div>
    </div>
  );
}
