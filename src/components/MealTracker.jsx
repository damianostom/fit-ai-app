import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';

// Twój klucz API - upewnij się, że jest aktywny w Google AI Studio
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
      // Używamy stabilnego modelu 2.5 Flash, który wylistowałeś jako dostępny
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.1, // Niska temperatura zwiększa precyzję JSON
          maxOutputTokens: 200,
        }
      });
      
      const prompt = `Jesteś precyzyjnym dietetykiem. Przeanalizuj posiłek: "${input}". 
      Zwróć dane WYŁĄCZNIE jako czysty obiekt JSON. Nie pisz żadnego dodatkowego tekstu ani wstępu.
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
      
      // Bardziej odporne wyciąganie JSONa za pomocą wyrażenia regularnego
      let data;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI nie zwróciło poprawnego formatu danych");
        data = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Błąd parsowania odpowiedzi AI:", text);
        throw new Error("Wystąpił błąd podczas odczytu danych z AI.");
      }

      // Zapis do tabeli 'meals' w Supabase
      const { error } = await supabase.from('meals').insert({
        user_id: userId,
        name: data.name || "Posiłek AI",
        calories: Math.round(data.calories || 0),
        protein: data.protein || 0,
        fat: data.fat || 0,
        carbs: data.carbs || 0
      });

      if (error) throw error;

      alert(`Dodano do dziennika: ${data.name} (${data.calories} kcal)`);
      setInput('');
      setImage(null);
      if (onMealAdded) onMealAdded(); // Odświeżenie Dashboardu
      
    } catch (err) {
      console.error("Szczegóły błędu analizy:", err);
      alert(err.message || "Wystąpił błąd analizy. Spróbuj ponownie za chwilę.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px' }}>📸 Dodaj posiłek przez AI</h4>
      <input 
        type="text" 
        placeholder="Co dziś zjadłeś? (np. 2 jajka sadzone i chleb)" 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        style={{ width: '100%', padding: '12px', marginBottom: '10px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem' }} 
      />
      <div style={{ marginBottom: '10px' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={e => setImage(e.target.files[0])} 
          style={{ fontSize: '0.9rem', color: '#64748b' }}
        />
      </div>
      <button 
        onClick={handleAnalyze} 
        disabled={loading} 
        style={{ 
          width: '100%', 
          padding: '14px', 
          backgroundColor: loading ? '#cbd5e1' : '#22c55e', 
          color: 'white', 
          border: 'none', 
          borderRadius: '10px', 
          fontWeight: 'bold', 
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        {loading ? 'Analizowanie...' : 'Wyślij do AI'}
      </button>
    </div>
  );
}