import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export default function MealTracker({ userId, onMealAdded }) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugText, setDebugText] = useState(''); // NOWE: do podglądu odpowiedzi

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
    setDebugText('Czekam na odpowiedź AI...');
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { temperature: 0.1, maxOutputTokens: 350 }
      });
      
      const prompt = `Jesteś dietetykiem. Przeanalizuj posiłek: "${input}". 
      MUSISZ zwrócić TYLKO I WYŁĄCZNIE obiekt JSON. Żadnego innego tekstu.
      Format: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      const response = await result.response;
      const text = response.text();
      setDebugText(text); // Wyświetlamy to, co faktycznie przyszło

      // PANCERNY MECHANIZM: Szukamy klamerek { } i wycinamy środek
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      
      if (start === -1 || end === 0) {
        console.error("Surowa odpowiedź bez JSON:", text);
        throw new Error("Brak formatu JSON w odpowiedzi AI");
      }
      
      const jsonString = text.substring(start, end);
      const data = JSON.parse(jsonString);

      const { error } = await supabase.from('meals').insert({
        user_id: userId,
        name: data.name || "Posiłek AI",
        calories: Math.round(data.calories || 0),
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0
      });

      if (error) throw error;

      alert(`Dodano: ${data.name}!`);
      setInput('');
      setImage(null);
      setDebugText(''); // Czyścimy po sukcesie
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error("Błąd szczegółowy:", err);
      alert("AI nie zwróciło danych w poprawnym formacie. Sprawdź 'Podgląd AI' poniżej.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', borderRadius: '20px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px' }}>📸 Dodaj przez AI / Foto</h4>
      <input type="text" placeholder="Opisz co zjadłeś..." value={input} onChange={e => setInput(e.target.value)} style={inStyle} />
      <input type="file" accept="image/*" capture="environment" onChange={e => setImage(e.target.files[0])} style={{ margin: '10px 0', fontSize: '0.8em' }} />
      <button onClick={handleAnalyze} disabled={loading} style={btnStyle(loading)}>{loading ? 'Analizowanie...' : 'Wyślij do AI'}</button>
      
      {/* SEKCJA DEBUGOWANIA - TO NAM POWIE PRAWDĘ */}
      {debugText && (
        <div style={{ marginTop: '15px', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
          <p style={{ fontSize: '0.7em', color: '#64748b', margin: '0 0 5px 0' }}>Podgląd odpowiedzi AI:</p>
          <code style={{ fontSize: '0.8em', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{debugText}</code>
        </div>
      )}
    </div>
  );
}

const inStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' };
const btnStyle = (loading) => ({ width: '100%', padding: '15px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' });