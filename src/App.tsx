import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Login } from "./components/Login";
import { SetupProfile } from "./components/SetupProfile";
import { Messenger } from "./components/Messenger";
import { UserProfile } from "./types";
import { Toaster } from "sonner";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
          // Set initial online status
          await updateDoc(docRef, {
            isOnline: true,
            lastSeen: serverTimestamp()
          });
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    const handleVisibilityChange = async () => {
      const docRef = doc(db, "users", user.uid);
      if (document.visibilityState === "visible") {
        await updateDoc(docRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        });
      } else {
        await updateDoc(docRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      }
    };

    const handleBeforeUnload = async () => {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!profile) {
    return (
      <SetupProfile
        onComplete={async () => {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            await updateDoc(docRef, {
              isOnline: true,
              lastSeen: serverTimestamp()
            });
          }
        }}
      />
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <Messenger currentUserProfile={profile} />
    </>
  );
}
