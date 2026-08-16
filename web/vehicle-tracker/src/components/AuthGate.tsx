import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseDataSource } from '../data/supabaseClient';

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isChecking, setIsChecking] = useState(isSupabaseDataSource);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseDataSource) return;
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsChecking(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseDataSource) return children;
  if (isChecking) {
    return <div className="min-h-screen bg-dark-bg flex items-center justify-center text-dark-text">Checking session…</div>;
  }
  if (!session) {
    const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError('');
      setIsSubmitting(true);
      const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      setIsSubmitting(false);
    };

    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <form className="card w-full max-w-sm p-6 space-y-4" onSubmit={submit}>
          <div>
            <h1 className="text-xl font-semibold text-dark-text">MizuWatch</h1>
            <p className="text-sm text-dark-muted mt-1">Sign in with your invited account.</p>
          </div>
          <label className="block text-sm text-dark-text">
            Email
            <input className="mt-1 w-full rounded bg-dark-bg border border-gray-700 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label className="block text-sm text-dark-text">
            Password
            <input className="mt-1 w-full rounded bg-dark-bg border border-gray-700 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </label>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button className="w-full rounded bg-dark-accent px-4 py-2 text-white disabled:opacity-60" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {children}
      <button className="fixed right-3 bottom-3 z-40 rounded bg-dark-surface border border-gray-700 px-3 py-1 text-xs text-dark-muted" onClick={() => void getSupabaseClient().auth.signOut()}>
        Sign out
      </button>
    </>
  );
}
