import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export default function MealTracker({ userId, onMealAdded }) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugText, setDebugText] = useState('');

  async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
  }

  const handleAnalyze = async () => {
    if (!apiKey) return alert("Błąd klucza API!");
    if (!input && !image) return alert("Wpisz opis lub dodaj zdjęcie!");
    
    setLoading(true);
    setDebugText('Analizowanie...');
    try {
      // Używamy modelu gemini-2.0-flash, który masz w projekcie
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", 
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
      });
      
      // KRÓTSZY PROMPT = mniejsza szansa na ucięcie odpowiedzi
      const prompt = `Analiza posiłku: "${input}". 
      Zwróć TYLKO surowy JSON: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}.
      Nie pisz nic więcej.`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      const response = await result.response;
      let text = response.text().trim();
      setDebugText(text);

      // Naprawa uciętych/błędnych odpowiedzi (szukanie JSON)
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      
      if (start === -1) {
        throw new Error("AI nie zwróciło poprawnego formatu.");
      }
      
      const jsonString = text.substring(start, end);
      const data = JSON.parse(jsonString);

      await supabase.from('meals').insert({
        user_id: userId,
        name: data.name || "Posiłek",
        calories: Math.round(data.calories || 0),
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0
      });

      alert(`Dodano: ${data.name}!`);
      setInput('');
      setImage(null);
      setDebugText('');
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error(err);
      alert("Błąd analizy. Spróbuj opisać posiłek krócej (np. 'Zupa pomidorowa 300ml').");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', borderRadius: '20px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px' }}>📸 Dodaj przez AI / Foto</h4>
      <input type="text" placeholder="Opisz posiłek..." value={input} onChange={e => setInput(e.target.value)} style={inStyle} />
      <input type="file" accept="image/*" capture="environment" onChange={e => setImage(e.target.files[0])} style={{ margin: '10px 0', fontSize: '0.8em' }} />
      <button onClick={handleAnalyze} disabled={loading} style={btnStyle(loading)}>{loading ? 'Analizowanie...' : 'Wyślij do AI'}</button>
      
      {debugText && (
        <div style={{ marginTop: '10px', padding: '8px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
          <p style={{ fontSize: '10px', margin: '0 0 5px 0', color: '#64748b' }}>Odpowiedź AI:</p>
          <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{debugText}</code>
        </div>
      )}
    </div>
  );
}

const inStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' };
const btnStyle = (loading) => ({ width: '100%', padding: '15px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' });