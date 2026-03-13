import { useState, FormEvent } from "react";
import { auth, db } from "../firebase";
import { doc, setDoc, getDocs, query, collection, where, serverTimestamp } from "firebase/firestore";

export function SetupProfile({ onComplete }: { onComplete: () => void }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if username is taken
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", cleanUsername));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError("Username is already taken.");
        setLoading(false);
        return;
      }

      // Create user profile
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        username: cleanUsername,
        displayName: auth.currentUser.displayName || "User",
        photoURL: auth.currentUser.photoURL || "",
        email: auth.currentUser.email || "",
        createdAt: serverTimestamp(),
      });

      onComplete();
    } catch (err: any) {
      console.error(err);
      setError("Failed to set up profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black">
      <div className="flex flex-col gap-6 p-8 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Choose a Username</h1>
          <p className="text-sm text-gray-500">This is how friends will find you.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="username"
              className="w-full bg-gray-100 border-none rounded-xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              maxLength={30}
              required
            />
            {error && <p className="text-red-500 text-sm px-1">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading || !username}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3.5 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
