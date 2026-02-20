import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export default function MealTracker({ userId, onMealAdded }) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
  }

  const handleAnalyze = async () => {
    if (!apiKey) return alert("Błąd klucza API w Vercel!");
    if (!input && !image) return alert("Wpisz opis lub dodaj zdjęcie posiłku!");
    
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { temperature: 0.1, maxOutputTokens: 350 }
      });
      
      const prompt = `Jesteś dietetykiem. Przeanalizuj posiłek: "${input}". 
      Jeśli jest zdjęcie, rozpoznaj co to jest. 
      Zwróć WYŁĄCZNIE obiekt JSON: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}. 
      Zero tekstu przed i po klamrach.`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      const response = await result.response;
      let text = response.text();

      // PANCERNY REGEX: Wyciąga czysty JSON nawet jeśli AI dopisze śmieci
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Błąd formatu odpowiedzi AI");
      
      const data = JSON.parse(jsonMatch[0]);

      await supabase.from('meals').insert({
        user_id: userId,
        name: data.name || "Posiłek AI",
        calories: Math.round(data.calories || 0),
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0
      });

      alert(`Dodano: ${data.name}!`);
      setInput('');
      setImage(null);
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error(err);
      alert("AI miało problem z formatem. Spróbuj opisać posiłek inaczej.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', borderRadius: '20px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px' }}>📸 Dodaj przez AI / Foto</h4>
      <input 
        type="text" 
        placeholder="Opisz posiłek..." 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' }} 
      />
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        onChange={e => setImage(e.target.files[0])} 
        style={{ margin: '10px 0', fontSize: '0.8em' }} 
      />
      <button onClick={handleAnalyze} disabled={loading} style={btnStyle(loading)}>
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>
    </div>
  );
}

const btnStyle = (loading) => ({ width: '100%', padding: '15px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' });