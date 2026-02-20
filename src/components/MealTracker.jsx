import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

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
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
  }

  const handleAnalyze = async () => {
    if (!input && !image) return alert("Wpisz opis lub dodaj zdjęcie!");
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
      });
      
      const prompt = `Jesteś dietetykiem. Przeanalizuj: "${input}". 
      Zwróć TYLKO JSON w formacie: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}. Zero innego tekstu.`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      const text = (await result.response).text();
      
      // Pancerne wyciąganie JSON - bierze wszystko między pierwszym { a ostatnim }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI nie zwróciło formatu JSON");
      const data = JSON.parse(jsonMatch[0]);

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
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error("Błąd AI:", err);
      alert("Wystąpił błąd podczas odczytu danych z AI. Spróbuj opisać posiłek prościej.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px', backgroundColor: '#fff' }}>
      <h4 style={{ marginTop: 0 }}>📸 Dodaj posiłek przez AI</h4>
      <input type="text" placeholder="Co zjadłeś?" value={input} onChange={e => setInput(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
      <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} style={{ margin: '10px 0' }} />
      <button onClick={handleAnalyze} disabled={loading} style={{ width: '100%', padding: '14px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>
    </div>
  );
}