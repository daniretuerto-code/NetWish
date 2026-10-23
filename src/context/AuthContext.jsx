import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { myBusiness } from '../lib/data.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const MODE_KEY = 'netwish_mode';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) || 'customer'; } catch { return 'customer'; }
  });

  const loadBusiness = useCallback(async (u) => {
    if (!u) { setBusiness(null); return null; }
    try {
      const b = await myBusiness(u.id);
      setBusiness(b);
      return b;
    } catch {
      setBusiness(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const u = data.session?.user || null;
      setUser(u);
      await loadBusiness(u);
      if (alive) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      loadBusiness(u);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadBusiness]);

  const setMode = useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo(() => ({
    user,
    business,
    ready,
    mode: business && mode === 'business' ? 'business' : 'customer',
    setMode,
    refreshBusiness: () => loadBusiness(user),
    displayName: user ? (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]) : null,
    avatar: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
    },
    async signUp({ email, password, name, surname }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, surname, full_name: `${name} ${surname}`.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/cuenta', queryParams: { prompt: 'select_account' } },
      });
      if (error) throw new Error(error.message);
    },
    async resetPassword(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/cuenta' });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await supabase.auth.signOut();
      setMode('customer');
    },
  }), [user, business, ready, mode, setMode, loadBusiness]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
