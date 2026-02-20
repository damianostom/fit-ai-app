import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

// Pobieranie klucza z bezpiecznych zmiennych Vercel/Vite
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
    if (!apiKey) return alert("Błąd: Klucz API nie jest skonfigurowany!");
    if (!input && !image) return alert("Wpisz opis lub dodaj zdjęcie!");
    
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
      });
      
      const prompt = `Jesteś dietetykiem. Przeanalizuj: "${input}". 
      Zwróć TYLKO JSON: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}. Zero tekstu poza tym.`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      let text = (await result.response).text();
      // Czyszczenie formatowania markdown
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
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
      alert("Błąd analizy AI. Sprawdź czy klucz API w Vercel jest aktualny.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px', backgroundColor: '#fff' }}>
      <h4 style={{ marginTop: 0 }}>📸 Dodaj posiłek przez AI</h4>
      <input type="text" placeholder="Co zjadłeś?" value={input} onChange={e => setInput(e.target.value)} style={inStyle} />
      <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} style={{ margin: '10px 0' }} />
      <button onClick={handleAnalyze} disabled={loading} style={btnStyle(loading)}>
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>
    </div>
  );
}

const inStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #e2e8f0' };
const btnStyle = (loading) => ({ width: '100%', padding: '14px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' });