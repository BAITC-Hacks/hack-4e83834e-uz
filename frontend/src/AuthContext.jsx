import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "admin" | "citizen" | null
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Listen for auth state changes from Firebase
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Check whether this user signed in via phone or email/password
      const isPhoneUser =
        Boolean(currentUser.phoneNumber) ||
        currentUser.providerData.some((p) => p.providerId === "phone");

      if (isPhoneUser) {
        // Citizens sign in via phone number unconditionally
        setRole("citizen");
        setAuthError(null);
        setLoading(false);
        return;
      }

      // Email/password user -> verify against backend analyst allowlist in config.py
      const email = currentUser.email;
      if (email) {
        try {
          const res = await api.checkAdmin(email);
          if (res?.is_admin) {
            setRole("admin");
            setAuthError(null);
          } else {
            // Not in admin allowlist -> sign out immediately without citizen fallback
            await fbSignOut(auth);
            setUser(null);
            setRole(null);
            setAuthError("This account is not registered as an analyst");
          }
        } catch (err) {
          console.error("Failed to check admin status:", err);
          await fbSignOut(auth);
          setUser(null);
          setRole(null);
          setAuthError("Failed to verify analyst authorization");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Analyst / Admin email & password sign-in.
   * If check-admin returns false, signs out immediately and returns an error.
   */
  const signInAdmin = async (email, password) => {
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const res = await api.checkAdmin(userCredential.user.email);
      if (res?.is_admin) {
        setUser(userCredential.user);
        setRole("admin");
        return { success: true, role: "admin" };
      } else {
        await fbSignOut(auth);
        setUser(null);
        setRole(null);
        const msg = "This account is not registered as an analyst";
        setAuthError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || "Failed to sign in";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Signs the current user out.
   */
  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn("Sign out error", err);
    } finally {
      setUser(null);
      setRole(null);
      setAuthError(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      authError,
      setAuthError,
      signInAdmin,
      signOut,
    }),
    [user, role, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
