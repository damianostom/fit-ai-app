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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await fetchProfile();
      await fetchWeightHistory();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchMealsForDate();
  }, [selectedDate]);

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
    const act = parseFloat(profile.activity);
    const tw = parseFloat(profile.target_weight);

    if (!w || !h || !a) return 2000;

    // Podstawa (Mifflin-St Jeor)
    const base = 10 * w + 6.25 * h - 5 * a;
    const maintenance = Math.round((profile.gender === 'male' ? base + 5 : base - 161) * act);

    if (!tw || !profile.target_date) return maintenance - 500;

    const today = new Date();
    today.setHours(0,0,0,0);
    const tDate = new Date(profile.target_date);
    const diffDays = Math.ceil((tDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return maintenance - 500;

    const totalKgToLose = w - tw;
    const totalKcalToBurn = totalKgToLose * 7700;
    const dailyDeficit = totalKcalToBurn / diffDays;

    const finalGoal = Math.round(maintenance - dailyDeficit);
    const minKcal = profile.gender === 'female' ? 1200 : 1500;
    
    return Math.max(finalGoal, minKcal);
  };

  const saveAll = async () => {
    const newBmr = calculateDynamicCalories();
    
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      weight: parseFloat(profile.weight),
      height: parseFloat(profile.height),
      age: parseInt(profile.age),
      gender: profile.gender,
      activity_level: parseFloat(profile.activity),
      target_weight: parseFloat(profile.target_weight),
      target_date: profile.target_date,
      daily_goal_kcal: newBmr
    });

    if (error) {
      alert("Błąd: " + error.message);
    } else {
      setBmr(newBmr);
      await supabase.from('weight_history').upsert({ 
        user_id: session.user.id, weight: parseFloat(profile.weight), recorded_at: new Date().toISOString().split('T')[0] 
      }, { onConflict: 'user_id, recorded_at' });
      fetchWeightHistory();
      alert("Zapisano! Nowy cel: " + newBmr + " kcal");
    }
  };

  const deleteMeal = async (id) => {
    await supabase.from('meals').delete().eq('id', id);
    fetchMealsForDate();
  };

  if (loading) return <div style={{padding: '20px'}}>Ładowanie...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: '#1e293b' }}>
      
      {/* SEKCJA KALORII */}
      <header style={cardStyle({ bg: '#f0fdf4', border: '#22c55e' })}>
        <h2 style={{ margin: 0 }}>Cel: {bmr} kcal</h2>
        <div style={{ margin: '10px 0', fontSize: '1.1rem' }}>
          Zjedzono: <strong>{todayKcal}</strong> / Zostało: <strong style={{color: bmr-todayKcal < 0 ? 'red' : 'green'}}>{bmr - todayKcal}</strong>
        </div>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={inputStyle} />
      </header>

      {/* PROFIL I CEL */}
      <section style={cardStyle({ bg: '#fff', border: '#e2e8f0' })}>
        <h4 style={{marginTop: 0}}>Twoje Dane i Cel</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} style={inputStyle}>
            <option value="male">Mężczyzna</option>
            <option value="female">Kobieta</option>
          </select>
          <input type="number" placeholder="Wiek" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Waga (kg)" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Wzrost (cm)" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Cel (kg)" value={profile.target_weight} onChange={e => setProfile({...profile, target_weight: e.target.value})} style={inputStyle} />
          <input type="date" value={profile.target_date} onChange={e => setProfile({...profile, target_date: e.target.value})} style={inputStyle} />
          <select value={profile.activity} onChange={e => setProfile({...profile, activity: e.target.value})} style={{...inputStyle, gridColumn: 'span 2'}}>
            <option value="1.2">Siedzący (1.2)</option>
            <option value="1.5">Umiarkowany (1.5)</option>
            <option value="1.9">Sportowiec (1.9)</option>
          </select>
        </div>
        <button onClick={saveAll} style={primaryButtonStyle}>Oblicz inteligentny limit kcal</button>
      </section>

      <MealTracker userId={session.user.id} onMealAdded={fetchMealsForDate} />

      {/* WYKRES */}
      <div style={{ height: 200, margin: '20px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weightData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
            <Tooltip />
            <Line type="monotone" dataKey="waga" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
            {profile.target_weight && <ReferenceLine y={profile.target_weight} stroke="red" strokeDasharray="3 3" label="CEL" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* HISTORIA POSIŁKÓW */}
      <div>
        <h4 style={{borderBottom: '1px solid #eee', paddingBottom: '5px'}}>Posiłki z dnia {selectedDate}</h4>
        {meals.length === 0 ? <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>Brak posiłków w tym dniu.</p> : meals.map(meal => (
          <div key={meal.id} style={mealItemStyle}>
            <div>
              <strong>{meal.name}</strong>
              <div style={{fontSize: '0.8rem', color: '#64748b'}}>{meal.calories} kcal | B:{meal.protein} T:{meal.fat} W:{meal.carbs}</div>
            </div>
            <button onClick={() => deleteMeal(meal.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer', fontWeight:'bold'}}>usuń</button>
          </div>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut()} style={logoutButtonStyle}>Wyloguj</button>
    </div>
  );
}

const cardStyle = ({ bg, border }) => ({ backgroundColor: bg, padding: '20px', borderRadius: '16px', border: `2px solid ${border}`, marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' });
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%', boxSizing: 'border-box' };
const primaryButtonStyle = { width: '100%', marginTop: '15px', padding: '14px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const mealItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fff', marginBottom: '8px', borderRadius: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' };
const logoutButtonStyle = { marginTop: '40px', width: '100%', padding: '10px', background: 'none', border: '1px solid #e2e8f0', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer' };