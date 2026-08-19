import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "firebase/auth";
import { auth, db } from "@/src/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { sendSystemNotification } from "@/src/utils/notifications";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// One-time backfill: the first time a Firebase Auth user's email matches a
// TeamMember record that has no `uid` yet, stamp the uid onto that record.
// This is what makes `lead.agentId === request.auth.uid` (Firestore rules)
// and role-based scoping actually work — without it, TeamMember records are
// only ever matched by email/name, which the rules layer cannot check.
async function linkUidToTeamMember(user: User) {
  try {
    const teamRef = doc(db, "settings", "teamSettings");
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) return;

    const data = teamSnap.data() as Record<string, any[]>;
    let changed = false;

    Object.keys(data).forEach((teamKey) => {
      if (!Array.isArray(data[teamKey])) return;
      data[teamKey] = data[teamKey].map((member: any) => {
        const sameEmail = member?.email?.toLowerCase().trim() === user.email?.toLowerCase().trim();
        if (sameEmail && !member.uid) {
          changed = true;
          return { ...member, uid: user.uid };
        }
        return member;
      });
    });

    if (changed) {
      await setDoc(teamRef, data, { merge: true });
    }
  } catch (error) {
    console.warn("UID backfill to teamSettings skipped:", error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          // Check if user is signing in for the first time
          const userSnap = await getDoc(userRef);
          const isNewUser = !userSnap.exists();

          // Updated user in Firestore
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString()
          }, { merge: true });

          // Keep TeamMember.uid in sync so role-scoped Firestore rules can match this user.
          await linkUidToTeamMember(user);

          if (isNewUser) {
            // Trigger system notification
            await sendSystemNotification({
              title: "موظف جديد سجل بالسيستم",
              message: `قام الموظف الجديد "${user.displayName || user.email?.split("@")[0]}" بتسجيل الدخول للسيستم بالبريد: ${user.email}`,
              type: "system",
              category: "general",
              triggeredBy: user.displayName || "السيستم"
            });
          }
        } catch (error) {
          console.warn("Auth state synchronization skipped or offline mode: ", error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Auth Error:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
