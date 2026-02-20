import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

  useEffect(() => {
    fetchProfile();
    fetchWeightHistory();
  }, []);

  useEffect(() => { fetchMealsForDate(); }, [selectedDate, session.user.id]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (data) {
      setProfile({
        weight: data.weight || '',
        height: data.height || '',
        age: data.age || '',
        gender: data.gender || 'male',
        activity: (data.activity_level || 1.2).toString(),
        target_weight: data.target_weight || '',
        target_date: data.target_date || ''
      });
      setBmr(data.daily_goal_kcal || 2000);
    }
  };

  const fetchWeightHistory = async () => {
    const { data } = await supabase.from('weight_history').select('weight, recorded_at').eq('user_id', session.user.id).order('recorded_at', { ascending: true });
    if (data && data.length > 0) {
      setWeightData(data.map(d => ({ date: d.recorded_at, waga: d.weight })));
    } else {
      setWeightData([{ date: selectedDate, waga: parseFloat(profile.weight) || 0 }]);
    }
  };

  const fetchMealsForDate = async () => {
    const start = `${selectedDate}T00:00:00.000Z`;
    const end = `${selectedDate}T23:59:59.999Z`;
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });
    
    if (data) {
      setMeals(data);
      setTodayKcal(data.reduce((sum, m) => sum + (m.calories || 0), 0));
    }
  };

  const deleteMeal = async (mealId) => {
    const { error } = await supabase.from('meals').delete().eq('id', mealId).eq('user_id', session.user.id);
    if (!error) fetchMealsForDate();
  };

  const saveAll = async () => {
    const w = parseFloat(profile.weight) || 0;
    const h = parseFloat(profile.height) || 0;
    const a = parseInt(profile.age) || 0;
    const base = 10 * w + 6.25 * h - 5 * a;
    const maintenance = Math.round((profile.gender === 'male' ? base + 5 : base - 161) * parseFloat(profile.activity));

    const { error } = await supabase.from('profiles').upsert({ 
      id: session.user.id, 
      weight: w, height: h, age: a, gender: profile.gender,
      activity_level: parseFloat(profile.activity), 
      target_weight: parseFloat(profile.target_weight) || 0,
      target_date: profile.target_date,
      daily_goal_kcal: maintenance || 2000
    });

    if (error) {
      alert("Błąd zapisu: " + error.message);
    } else {
      setBmr(maintenance);
      await supabase.from('weight_history').upsert({ user_id: session.user.id, weight: w, recorded_at: new Date().toISOString().split('T')[0] });
      fetchWeightHistory();
      alert("Dane profilu zostały zaktualizowane!");
    }
  };

  const safeBmr = bmr || 2000;
  const progressPercent = Math.min((todayKcal / safeBmr) * 100, 100);

  return (
    <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* NAGŁÓWEK KALORII */}
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>{todayKcal} / {safeBmr} kcal</h2>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '8px' }} />
        </div>
        <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: todayKcal > safeBmr ? '#ef4444' : '#22c55e', transition: 'width 0.5s' }} />
        </div>
      </header>

      {/* WYKRES WAGI */}
      <section style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '20px', marginBottom: '15px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Trend wagi</h4>
        <div style={{ width: '100%', height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip />
              <Line type="monotone" dataKey="waga" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* FORMULARZ PROFILU (Przywrócony) */}
      <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Parametry sylwetki</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Płeć</label>
            <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} style={inputStyle}>
              <option value="male">Mężczyzna</option>
              <option value="female">Kobieta</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Wiek</label>
            <input type="number" placeholder="Wiek" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Waga (kg)</label>
            <input type="number" placeholder="Waga" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Wzrost (cm)</label>
            <input type="number" placeholder="Wzrost" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Aktywność</label>
            <select value={profile.activity} onChange={e => setProfile({...profile, activity: e.target.value})} style={inputStyle}>
              <option value="1.2">Brak ruchu (Siedzący)</option>
              <option value="1.375">Niska aktywność (1-2 treningi)</option>
              <option value="1.55">Średnia aktywność (3-4 treningi)</option>
              <option value="1.725">Wysoka aktywność (Codziennie)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cel wagi (kg)</label>
            <input type="number" placeholder="Cel" value={profile.target_weight} onChange={e => setProfile({...profile, target_weight: e.target.value})} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Data celu</label>
            <input type="date" value={profile.target_date} onChange={e => setProfile({...profile, target_date: e.target.value})} style={inputStyle} />
          </div>
          <button onClick={saveAll} style={{ gridColumn: 'span 2', padding: '12px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', marginTop: '10px' }}>
            Aktualizuj Plan i Cel
          </button>
        </div>
      </section>

      {/* KOMPONENT DODAWANIA POSIŁKÓW (AI + FOTO) */}
      <MealTracker userId={session.user.id} onMealAdded={fetchMealsForDate} />

      {/* LISTA POSIŁKÓW */}
      <div style={{ marginTop: '20px' }}>
        {meals.map(meal => (
          <div key={meal.id} style={mealItemStyle}>
            <div>
              <span style={{ fontWeight: '600', display: 'block' }}>{meal.name}</span>
              <span style={{ fontSize: '0.85em', color: '#64748b' }}>{meal.calories} kcal | B: {meal.protein}g | T: {meal.fat}g | W: {meal.carbs}g</span>
            </div>
            <button onClick={() => deleteMeal(meal.id)} style={deleteButtonStyle}>×</button>
          </div>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: '40px', width: '100%', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Wyloguj się</button>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.75em', color: '#64748b', marginBottom: '4px', marginLeft: '4px' };
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontSize: '0.9em' };
const mealItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fff', marginBottom: '8px', borderRadius: '12px', border: '1px solid #eee' };
const deleteButtonStyle = { color: '#ef4444', border: 'none', background: '#fee2e2', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', cursor: 'pointer' };