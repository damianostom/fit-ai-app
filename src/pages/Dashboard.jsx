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
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Błąd pobierania posiłków:", error);
    if (data) {
      setMeals(data);
      setTodayKcal(data.reduce((sum, m) => sum + (m.calories || 0), 0));
    }
  };

  // NOWA FUNKCJA USUWANIA
  const deleteMeal = async (mealId) => {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId)
      .eq('user_id', session.user.id); // Dodatkowe zabezpieczenie

    if (error) {
      alert("Nie udało się usunąć posiłku.");
    } else {
      // Odśwież listę po usunięciu
      fetchMealsForDate();
    }
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
      daily_goal_kcal: maintenance || 2000
    });

    if (error) {
      alert("Błąd zapisu: " + error.message);
    } else {
      setBmr(maintenance);
      await supabase.from('weight_history').upsert({ user_id: session.user.id, weight: w, recorded_at: new Date().toISOString().split('T')[0] });
      fetchWeightHistory();
      alert("Zaktualizowano dane!");
    }
  };

  const safeBmr = bmr || 2000;
  const progressPercent = Math.min((todayKcal / safeBmr) * 100, 100);

  return (
    <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>{todayKcal} / {safeBmr} kcal</h2>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '8px' }} />
        </div>
        <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: todayKcal > safeBmr ? '#ef4444' : '#22c55e', transition: 'width 0.5s' }} />
        </div>
      </header>

      <section style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '20px', marginBottom: '15px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Trend wagi</h4>
        <div style={{ width: '100%', height: '220px', minHeight: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip />
              <Line type="monotone" dataKey="waga" stroke="#22c55e" strokeWidth={4} dot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <MealTracker userId={session.user.id} onMealAdded={fetchMealsForDate} />

      {/* LISTA POSIŁKÓW Z POPRAWIONYM USUWANIEM */}
      <div style={{ marginTop: '20px' }}>
        {meals.map(meal => (
          <div key={meal.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fff', marginBottom: '8px', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div>
              <span style={{ fontWeight: '500', display: 'block' }}>{meal.name}</span>
              <span style={{ fontSize: '0.9em', color: '#64748b' }}>{meal.calories} kcal | B: {meal.protein}g | T: {meal.fat}g | W: {meal.carbs}g</span>
            </div>
            <button 
              onClick={() => deleteMeal(meal.id)} 
              style={{ 
                color: '#ef4444', 
                border: 'none', 
                background: '#fee2e2', 
                borderRadius: '50%', 
                width: '32px', 
                height: '32px', 
                fontSize: '18px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '10px'
              }}
              title="Usuń"
            >
              ×
            </button>
          </div>
        ))}
        {meals.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px' }}>Brak posiłków w tym dniu.</p>}
      </div>
      
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: '30px', width: '100%', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9em' }}>Wyloguj się</button>
    </div>
  );
}