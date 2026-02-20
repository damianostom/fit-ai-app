import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export default function MealTracker({ userId, onMealAdded }) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState('');

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
    setLastResponse('Analizowanie przez Gemini 2.5...');
    
    try {
      // Używamy modelu 2.5 Flash z Twojej listy - najstabilniejszy dla JSON
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { 
          temperature: 0.1,
          responseMimeType: "application/json" // Wymusza poprawny JSON
        } 
      });
      
      const prompt = `Analiza posiłku: "${input}". 
      Zwróć TYLKO JSON: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}.`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      const text = (await result.response).text().trim();
      setLastResponse(text);

      const data = JSON.parse(text);

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
      setLastResponse('');
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd formatu. Spróbuj opisać posiłek inaczej.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', borderRadius: '20px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px' }}>📸 Dodaj przez AI / Foto</h4>
      <input 
        type="text" 
        placeholder="Opisz co zjadłeś..." 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        style={inStyle} 
      />
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        onChange={e => setImage(e.target.files[0])} 
        style={{ margin: '10px 0', fontSize: '0.8em' }} 
      />
      <button 
        onClick={handleAnalyze} 
        disabled={loading} 
        style={btnStyle(loading)}
      >
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>

      {lastResponse && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '10px' }}>
          <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 5px 0' }}>Ostatnia odpowiedź AI:</p>
          <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{lastResponse}</code>
        </div>
      )}
    </div>
  );
}

const inStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' };
const btnStyle = (loading) => ({ width: '100%', padding: '15px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' });