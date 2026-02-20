import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

// Twój klucz API
const genAI = new GoogleGenerativeAI("AIzaSyCOXSEGbjRvkGUZiJ6it_moq6B9X7V26tQ");

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
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  }

  const handleAnalyze = async () => {
    if (!input && !image) return alert("Wpisz opis lub dodaj zdjęcie!");
    
    setLoading(true);
    try {
      // UŻYWAMY MODELU GEMINI 3 FLASH PREVIEW
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      
      const prompt = `Jesteś ekspertem dietetykiem. Przeanalizuj posiłek: "${input}". 
      Zwróć dane WYŁĄCZNIE jako czysty obiekt JSON. Nie pisz żadnego innego tekstu.
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
      
      // Bezpieczne wyciąganie JSONa z odpowiedzi
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      const jsonString = text.substring(start, end);
      const data = JSON.parse(jsonString);

      const { error } = await supabase.from('meals').insert({
        user_id: userId,
        name: data.name || "Posiłek",
        calories: Math.round(data.calories || 0),
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0
      });

      if (error) throw error;

      alert(`Dodano do dziennika: ${data.name} (${data.calories} kcal)`);
      setInput('');
      setImage(null);
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error("Szczegóły błędu:", err);
      alert("Błąd analizy AI. Upewnij się, że model 'gemini-3.0-flash-preview' jest dostępny w Twoim regionie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '12px', backgroundColor: '#fff' }}>
      <h4 style={{ marginTop: 0 }}>📸 Dodaj posiłek przez AI (Gemini 3)</h4>
      <input 
        type="text" 
        placeholder="Co dziś zjadłeś? (np. omlet z 2 jaj)" 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        style={{ width: '100%', padding: '12px', marginBottom: '10px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ccc' }} 
      />
      <div style={{ marginBottom: '10px' }}>
        <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
      </div>
      <button 
        onClick={handleAnalyze} 
        disabled={loading} 
        style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#ccc' : '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>
    </div>
  );
}