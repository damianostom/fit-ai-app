import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../lib/supabase';
import BarcodeScanner from './BarcodeScanner';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export default function MealTracker({ userId, onMealAdded }) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  async function fileToGenerativePart(file) {
    const reader = new FileReader();
    const base64 = await new Promise(r => { reader.onload = () => r(reader.result.split(',')[1]); reader.readAsDataURL(file); });
    return { inlineData: { data: base64, mimeType: file.type } };
  }

  // Funkcja pomocnicza do wysyłania zapytania do AI
  const analyzeMeal = async (textToAnalyze, imageFile = null) => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview", 
        generationConfig: { responseMimeType: "application/json" } 
      });
      
      const prompt = `Analiza posiłku: "${textToAnalyze}". Na podstawie podanych wartości (jeśli są) lub Twojej wiedzy oblicz sumę. Zwróć TYLKO JSON: {"name": "nazwa", "kcal": 100, "p": 0, "f": 0, "c": 0}.`;
      
      let result;
      if (imageFile) {
        result = await model.generateContent([prompt, await fileToGenerativePart(imageFile)]);
      } else {
        result = await model.generateContent(prompt);
      }
      
      const data = JSON.parse((await result.response).text());

      await supabase.from('meals').insert({
        user_id: userId, 
        name: data.name, 
        calories: Math.round(data.kcal),
        protein: data.p, 
        fat: data.f, 
        carbs: data.c
      });

      setInput(''); 
      setImage(null);
      if (onMealAdded) onMealAdded();
    } catch (err) {
      alert("Błąd AI. Spróbuj opisać posiłek ręcznie.");
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeDetected = (product) => {
    setShowScanner(false);
    
    // Zapytanie użytkownika o wagę
    const weight = window.prompt(`Zeskanowano: ${product.name}\nIle gramów zjadłeś?`, "100");
    
    if (weight !== null && weight !== "") {
      const fullDescription = `Produkt: ${product.name}. Wartości na 100g: ${product.kcal} kcal, Białko: ${product.p}g, Tłuszcz: ${product.f}g, Węglowodany: ${product.c}g. Ilość zjedzona: ${weight}g.`;
      
      // Automatyczne wysłanie do AI po wpisaniu wagi
      analyzeMeal(fullDescription);
    }
  };

  const handleManualAnalyze = () => {
    if (!input && !image) return alert("Wpisz opis lub zrób zdjęcie!");
    analyzeMeal(input, image);
  };

  return (
    <div style={{ marginTop: '10px', padding: '15px', borderRadius: '15px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <button onClick={() => setShowScanner(!showScanner)} style={subBtn}>
          {showScanner ? 'Zamknij' : '█║ Skanuj'}
        </button>
        <input type="file" accept="image/*" capture="environment" onChange={e => setImage(e.target.files[0])} style={{ display: 'none' }} id="img-cam" />
        <label htmlFor="img-cam" style={subBtn}>{image ? '✅ Foto' : '📸 Foto'}</label>
      </div>

      {showScanner && <BarcodeScanner onDetected={handleBarcodeDetected} />}

      <textarea 
        placeholder="Opisz co zjadłeś lub skanuj kod..." 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        style={txtArea} 
        rows="2" 
      />
      
      <button onClick={handleManualAnalyze} disabled={loading} style={mainBtn}>
        {loading ? 'Przetwarzanie...' : 'Dodaj przez AI'}
      </button>
    </div>
  );
}

const subBtn = { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontSize: '0.85em', fontWeight: 'bold', textAlign: 'center', cursor: 'pointer' };
const txtArea = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '16px', fontFamily: 'inherit', WebkitAppearance: 'none' };
const mainBtn = { width: '100%', padding: '14px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', width: '100%' };