import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import MealTracker from '../components/MealTracker';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState({ 
    weight: '', height: '', age: '', gender: 'male', activity: '1.2', target_weight: '', target_date: '',
    daily_goal_kcal: 2000, target_protein: 0, target_fat: 0, target_carbs: 0 
  });
  const [meals, setMeals] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

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
        target_date: data.target_date || '',
        daily_goal_kcal: data.daily_goal_kcal || 2000,
        target_protein: data.target_protein || 0,
        target_fat: data.target_fat || 0,
        target_carbs: data.target_carbs || 0
      });
    }
  };

  const fetchWeightHistory = async () => {
    const { data } = await supabase.from('weight_history').select('weight, recorded_at').eq('user_id', session.user.id).order('recorded_at', { ascending: true });
    if (data && data.length > 0) setWeightData(data.map(d => ({ date: d.recorded_at, waga: d.weight })));
  };

  const fetchMealsForDate = async () => {
    const start = `${selectedDate}T00:00:00.000Z`;
    const end = `${selectedDate}T23:59:59.999Z`;
    const { data } = await supabase.from('meals').select('*').eq('user_id', session.user.id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false });
    if (data) setMeals(data);
  };

  const deleteMeal = async (mealId) => {
    const { error } = await supabase.from('meals').delete().eq('id', mealId).eq('user_id', session.user.id);
    if (!error) fetchMealsForDate();
  };

  const saveAll = async () => {
    const w = parseFloat(profile.weight);
    const h = parseFloat(profile.height);
    const a = parseInt(profile.age);
    if (!w || !h || !a) return alert("Uzupełnij parametry ciała!");
    
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        generationConfig: { responseMimeType: "application/json" }
      });
      
      const prompt = `Jesteś dietetykiem. Oblicz dzienny limit kalorii i makroskładników (w gramach) na redukcję dla: ${profile.gender}, ${w}kg, ${h}cm, ${a}lat, aktywność ${profile.activity}. Cel: ${profile.target_weight}kg. Zwróć JSON: {"kcal": 1800, "p": 150, "f": 60, "c": 165}`;
      
      const result = await model.generateContent(prompt);
      const res = JSON.parse((await result.response).text());

      const { error } = await supabase.from('profiles').upsert({ 
        id: session.user.id, weight: w, height: h, age: a, gender: profile.gender,
        activity_level: parseFloat(profile.activity), target_weight: parseFloat(profile.target_weight),
        target_date: profile.target_date, daily_goal_kcal: res.kcal,
        target_protein: res.p, target_fat: res.f, target_carbs: res.c
      });

      if (!error) {
        setProfile(prev => ({...prev, daily_goal_kcal: res.kcal, target_protein: res.p, target_fat: res.f, target_carbs: res.c}));
        await supabase.from('weight_history').upsert({ user_id: session.user.id, weight: w, recorded_at: new Date().toISOString().split('T')[0] });
        alert(`AI wyliczyło plan: ${res.kcal} kcal (B: ${res.p}g, T: ${res.f}g, W: ${res.c}g)`);
        fetchWeightHistory();
      }
    } catch (err) {
      alert("Błąd AI podczas obliczeń.");
    } finally {
      setLoading(false);
    }
  };

  const todayKcal = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const todayProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein || 0), 0));
  const todayFat = Math.round(meals.reduce((sum, m) => sum + (m.fat || 0), 0));
  const todayCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs || 0), 0));

  const progressPercent = Math.min((todayKcal / (profile.daily_goal_kcal || 2000)) * 100, 100);

  return (
    <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>{todayKcal} / {profile.daily_goal_kcal} kcal</h2>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateStyle} />
        </div>
        <div style={progressBg}><div style={{ ...progressFill, width: `${progressPercent}%`, background: todayKcal > profile.daily_goal_kcal ? '#ef4444' : '#22c55e' }} /></div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '15px', textAlign: 'center', fontSize: '0.85em' }}>
          <div><span style={{color: '#ef4444', display: 'block'}}>Białko</span><strong>{todayProtein}/{profile.target_protein}g</strong></div>
          <div><span style={{color: '#f59e0b', display: 'block'}}>Tłuszcz</span><strong>{todayFat}/{profile.target_fat}g</strong></div>
          <div><span style={{color: '#3b82f6', display: 'block'}}>Węgle</span><strong>{todayCarbs}/{profile.target_carbs}g</strong></div>
        </div>
      </header>

      <section style={cardStyle}>
        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Trend wagi</h4>
        <div style={{ width: '100%', height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData.length > 0 ? weightData : [{date: '', waga: 0}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide /><YAxis domain={['auto', 'auto']} hide /><Tooltip />
              <Line type="monotone" dataKey="waga" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={cardStyle}>
        <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Parametry sylwetki</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} style={inputStyle}>
            <option value="male">Mężczyzna</option><option value="female">Kobieta</option>
          </select>
          <input type="number" placeholder="Wiek" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Waga" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} style={inputStyle} />
          <input type="number" placeholder="Wzrost" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} style={inputStyle} />
          <select value={profile.activity} onChange={e => setProfile({...profile, activity: e.target.value})} style={{...inputStyle, gridColumn: 'span 2'}}>
            <option value="1.2">Brak ruchu (1.2)</option><option value="1.375">Niska (1.3)</option><option value="1.5">Średnia (1.5)</option><option value="1.9">Duża (1.9)</option>
          </select>
          <input type="number" placeholder="Cel kg" value={profile.target_weight} onChange={e => setProfile({...profile, target_weight: e.target.value})} style={inputStyle} />
          <input type="date" value={profile.target_date} onChange={e => setProfile({...profile, target_date: e.target.value})} style={inputStyle} />
          <button onClick={saveAll} disabled={loading} style={btnStyle}>{loading ? 'Obliczanie...' : 'Aktualizuj Plan (AI)'}</button>
        </div>
      </section>

      <MealTracker userId={session.user.id} onMealAdded={fetchMealsForDate} />

      <div style={{ marginTop: '20px' }}>
        {meals.map(meal => (
          <div key={meal.id} style={mealItemStyle}>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block' }}>{meal.name}</strong>
              <small style={{ color: '#64748b' }}>{meal.calories} kcal | B: {meal.protein}g | T: {meal.fat}g | W: {meal.carbs}g</small>
            </div>
            <button onClick={() => deleteMeal(meal.id)} style={deleteBtnStyle}>×</button>
          </div>
        ))}
      </div>
      <button onClick={() => supabase.auth.signOut()} style={logoutStyle}>Wyloguj</button>
    </div>
  );
}

const cardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' };
const btnStyle = { gridColumn: 'span 2', padding: '12px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const progressBg = { width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' };
const progressFill = { height: '100%', transition: 'width 0.5s' };
const dateStyle = { border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '8px' };
const mealItemStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: '#fff', marginBottom: '10px', borderRadius: '15px', border: '1px solid #f1f5f9' };
const deleteBtnStyle = { background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const logoutStyle = { marginTop: '30px', width: '100%', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', paddingBottom: '20px' };