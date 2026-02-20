import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Ładowanie FitAI...</div>;

  return (
    <div style={{ 
      minHeight: '100vh', 
      width: '100vw', 
      margin: 0, 
      padding: 0, 
      display: 'flex', 
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>
      {!session ? <Auth /> : <Dashboard session={session} />}
    </div>
  );
}