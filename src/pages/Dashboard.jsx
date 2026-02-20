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
    // Możesz tu dodać zapisywanie wody w Supabase, na razie zostawiamy lokalnie
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
    if (!w || !h || !a) return 2000; // Domyślna wartość jeśli brak danych

    const base = 10 * w + 6.25 * h - 5 * a;
    const maintenance = Math.round((profile.gender === 'male' ? base + 5 : base - 161) * parseFloat(profile.activity));
    
    if (!profile.target_weight || !profile.target_date) return maintenance - 500;
    
    const diffDays = Math.ceil((new Date(profile.target_date) - new Date()) / (1000*60*60*24));
    if (diffDays <= 0) return maintenance - 500;

    const deficit = ((w - parseFloat(profile.target_weight)) * 7700) / diffDays;
    return Math.max(Math.round(maintenance - deficit), 1200);
  };

  const saveAll = async () => {
    const newBmr = calculateDynamicCalories();
    const { error } = await supabase.from('profiles').upsert({ 
      id: session.user.id, 
      ...profile, 
      activity_level: parseFloat(profile.activity), 
      daily_goal_kcal: newBmr 
    });

    if (error) {
      alert("Błąd: " + error.message);
    } else {
      setBmr(newBmr);
      // Dodaj wpis do historii wagi
      await supabase.from('weight_history').upsert({ 
        user_id: session.user.id, 
        weight: parseFloat(profile.weight), 
        recorded_at: new Date().toISOString().split('T')[0] 
      }, { onConflict: 'user_id, recorded_at' });
      
      fetchWeightHistory();
      alert("Zapisano dane i zaktualizowano cel!");
    }
  };

  // BEZPIECZNIKI DLA UI
  const safeBmr = bmr || 2000;
  const progressPercent = Math.min((todayKcal / safeBmr) * 100, 100);
  const caloriesLeft = safeBmr - todayKcal;

  return (
    <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', color: '#1e293b' }}>
      
      {/* NAGŁÓWEK Z PASKIEM POSTĘPU */}
      <header style={cardStyle({ bg: '#fff', border: '#e2e8f0' })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{todayKcal} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'normal' }}>/ {safeBmr} kcal</span></h2>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateInputStyle} />
        </div>
        <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: todayKcal > safeBmr ? '#ef4444' : '#22c55e', transition: 'width 0.5s ease' }} />
        </div>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '10px', marginBottom: 0 }}>
          {caloriesLeft >= 0 ? `Pozostało ${caloriesLeft} kcal do celu` : `Przekroczono o ${Math.abs(caloriesLeft)} kcal!`}
        </p>
      </header>

      {/* LICZNIK WODY */}
      <section style={cardStyle({ bg: '#eff6ff', border: '#3b82f6' })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#1d4ed8' }}>💧 Nawodnienie</strong>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <span key={i} onClick={() => setWater(i)} style={{ cursor: 'pointer', fontSize: '1.4rem', opacity: i <= water ? 1 : 0.2, filter: i <= water ? 'none' : 'grayscale(100%)' }}>💧</span>
            ))}
          </div>
        </div>
      </section>

      {/* WYKRES WAGI */}
      <section style={cardStyle({ bg: '#fff', border: '#e2e8f0' })}>
        <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Trend wagi</h4>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="waga" stroke="#22c55e" strokeWidth={3} dot={{ r: 4, fill: '#22c55e' }} activeDot={{ r: 6 }} />
              {profile.target_weight && (
                <ReferenceLine y={parseFloat(profile.target_weight)} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'CEL', fill: '#ef4444', fontSize: 10 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* PROFIL I KONFIGURACJA */}
      <section style={cardStyle({ bg: '#fff', border: '#e2e8f0' })}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} style={inputStyle}>
            <option value="male">Mężczyzna</option><option value="female">Kobieta</option>
          </select>
          <input type="number" placeholder="Wiek" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Waga kg" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Cel kg" value={profile.target_weight} onChange={e => setProfile({...profile, target_weight: e.target.value})} style={inputStyle} />
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '5px' }}>Data osiągnięcia celu:</label>
            <input type="date" value={profile.target_date} onChange={e => setProfile({...profile, target_date: e.target.value})} style={inputStyle} />
          </div>
          <select value={profile.activity} onChange={e => setProfile({...profile, activity: e.target.value})} style={{...inputStyle, gridColumn: 'span 2'}}>
            <option value="1.2">Brak ruchu (1.2)</option>
            <option value="1.5">Lekka aktywność (1.5)</option>
            <option value="1.9">Dużo sportu (1.9)</option>
          </select>
        </div>
        <button onClick={saveAll} style={primaryButtonStyle}>Aktualizuj Dane i Cel</button>
      </section>

      <MealTracker userId={session.user.id} onMealAdded={fetchMealsForDate} />

      {/* LISTA POSIŁKÓW */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '10px' }}>Dziennik posiłków</h4>
        {meals.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem' }}>Brak wpisów dla tego dnia.</p>
        ) : meals.map(meal => (
          <div key={meal.id} style={mealItemStyle}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600' }}>{meal.name}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>B: {meal.protein}g | T: {meal.fat}g | W: {meal.carbs}g</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <strong style={{ color: '#22c55e' }}>{meal.calories} kcal</strong>
              <button onClick={async () => { await supabase.from('meals').delete().eq('id', meal.id); fetchMealsForDate(); }} style={deleteButtonStyle}>×</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut()} style={logoutButtonStyle}>Wyloguj się</button>
    </div>
  );
}

// STYLE CSS-IN-JS
const cardStyle = ({ bg, border }) => ({ backgroundColor: bg, padding: '15px', borderRadius: '18px', border: `1px solid ${border}`, marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' });
const inputStyle = { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', marginTop: '4px' };
const dateInputStyle = { border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' };
const primaryButtonStyle = { width: '100%', marginTop: '12px', padding: '14px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const mealItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#fff', marginBottom: '8px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' };
const deleteButtonStyle = { background: '#fee2e2', color: '#ef4444', border: 'none', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const logoutButtonStyle = { marginTop: '40px', width: '100%', padding: '12px', background: 'none', border: '1px solid #f1f5f9', color: '#94a3b8', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' };