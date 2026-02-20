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
    if (!apiKey) return alert("Błąd klucza!");
    if (!input && !image) return alert("Wpisz coś!");
    
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", 
        generationConfig: { temperature: 0.1 } 
      });
      
      const prompt = `Przeanalizuj posiłek: "${input}". 
      Zwróć TYLKO I WYŁĄCZNIE surowy obiekt JSON w jednej linii, bez tekstu przed i po. 
      Format: {"name": "nazwa", "calories": 100, "protein": 0, "fat": 0, "carbs": 0}`;

      let result;
      if (image) {
        const imagePart = await fileToGenerativePart(image);
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      let text = (await result.response).text();
      
      // USUWANIE MOŻLIWYCH OZNACZEŃ KODU (Markdown)
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Błąd formatu odpowiedzi AI");
      const data = JSON.parse(jsonMatch[0]);

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
      if (onMealAdded) onMealAdded();
      
    } catch (err) {
      console.error(err);
      alert("AI zwróciło nieczytelny format. Spróbuj jeszcze raz.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px', backgroundColor: '#fff' }}>
      <input type="text" placeholder="Co zjadłeś?" value={input} onChange={e => setInput(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
      <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} style={{ margin: '10px 0' }} />
      <button onClick={handleAnalyze} disabled={loading} style={{ width: '100%', padding: '14px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>
    </div>
  );
}