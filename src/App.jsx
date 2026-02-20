import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Sprawdź czy użytkownik jest już zalogowany (pobierz sesję z pamięci)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Nasłuchuj na zmiany (zalogowanie/wylogowanie)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>Ładowanie...</div>;

  // KLUCZOWY MOMENT: Jeśli nie ma sesji, renderujemy tylko ekran Auth
  return (
    <div className="container">
      {!session ? <Auth /> : <Dashboard session={session} />}
    </div>
  );
}