import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (type) => {
    setLoading(true);
    const { error } = type === 'login' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    
    if (error) alert(error.message);
    else if (type === 'signup') alert("Zarejestrowano! Sprawdź e-mail lub zaloguj się.");
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>FitAI 🍏</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px' }} />
        <input type="password" placeholder="Hasło" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px' }} />
        <button onClick={() => handleAuth('login')} disabled={loading} style={{ padding: '10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px' }}>Zaloguj</button>
        <button onClick={() => handleAuth('signup')} disabled={loading} style={{ padding: '10px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '5px' }}>Zarejestruj się</button>
      </div>
    </div>
  );
}