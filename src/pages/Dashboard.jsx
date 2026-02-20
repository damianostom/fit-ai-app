import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import MealTracker from '../components/MealTracker';

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState({ 
    weight: '', height: '', age: '', gender: 'male', activity: '1.2', target_weight: '', target_date: '' 
  });
  const [bmr, setBmr] = useState(0);
  const [meals, setMeals] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayKcal, setTodayKcal] = useState(0);
  const [water, setWater] = useState(0);

  useEffect(() => {
    fetchProfile();
    fetchWeightHistory();
  }, []);

  useEffect(() => {
    fetchMealsForDate();
    // Losujemy wodę (w prawdziwej wersji warto dodać tabelę w Supabase)
    setWater(Math.floor(Math.random() * 3)); 
  }, [selectedDate]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (data) {
      setProfile({
        weight: data.weight || '', height: data.height || '', age: data.age || '',
        gender: data.gender || 'male', activity: (data.activity_level || 1.2).toString(),
        target_weight: data.target_weight || '', target_date: data.target_date || ''
      });
      setBmr(data.daily_goal_kcal || 0);
    }
  };

  const fetchWeightHistory = async () => {
    const { data } = await supabase.from('weight_history').select('weight, recorded_at').eq('user_id', session.user.id).order('recorded_at', { ascending: true });
    if (data) setWeightData(data.map(d => ({ date: d.recorded_at, waga: d.weight })));
  };

  const fetchMealsForDate = async () => {
    const start = `${selectedDate}T00:00:00.000Z`;
    const end = `${selectedDate}T23:59:59.999Z`;
    const { data } = await supabase.from('meals').select('*').eq('user_id', session.user.id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false });
    if (data) {
      setMeals(data);
      setTodayKcal(data.reduce((sum, m) => sum + m.calories, 0));
    }
  };

  const calculateDynamicCalories = () => {
    const w = parseFloat(profile.weight);
    const h = parseFloat(profile.height);
    const a = parseInt(profile.age);
    const base = 10 * w + 6.25 * h - 5 * a;
    const maintenance = Math.round((profile.gender === 'male' ? base + 5 : base - 161) * parseFloat(profile.activity));
    
    if (!profile.target_weight || !profile.target_date) return maintenance - 500;
    const days = Math.ceil((new Date(profile.target_date) - new Date()) / (1000*60*60*24));
    const deficit = ((w - parseFloat(profile.target_weight)) * 7700) / (days > 0 ? days : 1);
    return Math.max(Math.round(maintenance - deficit), 1200);
  };

  const saveAll = async () => {
    const newBmr = calculateDynamicCalories();
    await supabase.from('profiles').upsert({ id: session.user.id, ...profile, activity_level: parseFloat(profile.activity), daily_goal_kcal: newBmr });
    setBmr(newBmr);
    alert("Zapisano dane!");
  };

  const progressPercent = Math.min((todayKcal / (bmr || 1)) * 100, 100);

  return (
    <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      
      {/* WIZUALNY LICZNIK KALORII */}
      <section style={cardStyle({ bg: '#fff', border: '#e2e8f0' })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>{todayKcal} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/ {bmr} kcal</span></h2>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '5px', borderRadius: '5px' }} />
        </div>
        <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent > 100 ? '#ef4444' : '#22c55e', transition: 'width 0.5s ease' }} />
        </div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>
          {todayKcal > bmr ? `Przekroczono o ${todayKcal - bmr} kcal!` : `Zostało ${bmr - todayKcal} kcal do celu.`}
        </p>
      </section>

      {/* LICZNIK WODY */}
      <section style={cardStyle({ bg: '#eff6ff', border: '#3b82f6' })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>💧 Nawodnienie</strong>
          <div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <span key={i} onClick={() => setWater(i)} style={{ cursor: 'pointer', fontSize: '1.2rem', opacity: i <= water ? 1 : 0.3 }}>💧</span>
            ))}
          </div>
        </div>
      </section>

      {/* PROFIL I CEL */}
      <section style={cardStyle({ bg: '#fff', border: '#e2e8f0' })}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} style={inputStyle}>
            <option value="male">Facet</option><option value="female">Kobieta</option>
          </select>
          <input type="number" placeholder="Wiek" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Waga kg" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Cel kg" value={profile.target_weight} onChange={e => setProfile({...profile, target_weight: e.target.value})} style={inputStyle} />
          <input type="date" value={profile.target_date} onChange={e => setProfile({...profile, target_date: e.target.value})} style={{...inputStyle, gridColumn: 'span 2'}} />
        </div>
        <button onClick={saveAll} style={primaryButtonStyle}>Aktualizuj Plan</button>
      </section>

      <MealTracker userId={session.user.id} onMealAdded={fetchMealsForDate} />

      {/* LISTA POSIŁKÓW */}
      <div style={{ marginTop: '20px' }}>
        {meals.map(meal => (
          <div key={meal.id} style={mealItemStyle}>
            <span><strong>{meal.name}</strong> ({meal.calories} kcal)</span>
            <button onClick={async () => { await supabase.from('meals').delete().eq('id', meal.id); fetchMealsForDate(); }} style={{ color: 'red', border: 'none', background: 'none' }}>usuń</button>
          </div>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut()} style={logoutButtonStyle}>Wyloguj</button>
    </div>
  );
}

const cardStyle = ({ bg, border }) => ({ backgroundColor: bg, padding: '15px', borderRadius: '15px', border: `1px solid ${border}`, marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' });
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' };
const primaryButtonStyle = { width: '100%', marginTop: '10px', padding: '12px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' };
const mealItemStyle = { display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff', marginBottom: '5px', borderRadius: '8px', borderBottom: '1px solid #eee' };
const logoutButtonStyle = { marginTop: '30px', width: '100%', padding: '10px', background: 'none', border: '1px solid #e2e8f0', color: '#94a3b8', borderRadius: '8px' };