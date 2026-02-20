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

  const handleBarcodeDetected = (product) => {
    setShowScanner(false);
    setInput(`${product.name} (100g: ${product.kcal}kcal, B:${product.p}g, T:${product.f}g, W:${product.c}g) - wpisz ilość w g: `);
    alert(`Pobrano dane: ${product.name}`);
  };

  const handleAnalyze = async () => {
    if (!input && !image) return alert("Opisz posiłek, dodaj foto lub użyj skanera!");
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview", 
        generationConfig: { responseMimeType: "application/json" } 
      });
      const prompt = `Analiza posiłku: "${input}". Zwróć JSON: {"name": "nazwa", "kcal": 100, "p": 0, "f": 0, "c": 0}.`;
      
      let result = image ? await model.generateContent([prompt, await fileToGenerativePart(image)]) : await model.generateContent(prompt);
      const data = JSON.parse((await result.response).text());

      await supabase.from('meals').insert({
        user_id: userId, name: data.name, calories: Math.round(data.kcal),
        protein: data.p, fat: data.f, carbs: data.c
      });

      alert(`Dodano: ${data.name}`);
      setInput(''); setImage(null);
      if (onMealAdded) onMealAdded();
    } catch (err) {
      alert("Błąd AI. Spróbuj opisać posiłek prościej.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', borderRadius: '20px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px' }}>🥗 Dodaj posiłek</h4>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => setShowScanner(!showScanner)} style={subBtnStyle}>
          {showScanner ? '❌ Zamknij' : '█║ Skanuj'}
        </button>
        <input type="file" accept="image/*" capture="environment" onChange={e => setImage(e.target.files[0])} style={{ display: 'none' }} id="img-up" />
        <label htmlFor="img-up" style={{...subBtnStyle, textAlign: 'center', cursor: 'pointer'}}>
          {image ? '✅ Foto' : '📸 Foto'}
        </label>
      </div>

      {showScanner && <BarcodeScanner onDetected={handleBarcodeDetected} />}

      <textarea placeholder="Opisz co zjadłeś..." value={input} onChange={e => setInput(e.target.value)} style={inStyle} rows="2" />
      <button onClick={handleAnalyze} disabled={loading} style={btnStyle(loading)}>{loading ? 'Analizowanie...' : 'Wyślij do AI'}</button>
    </div>
  );
}

const subBtnStyle = { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9em', fontWeight: 'bold' };
const inStyle = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px', fontFamily: 'inherit' };
const btnStyle = (loading) => ({ width: '100%', padding: '15px', backgroundColor: loading ? '#cbd5e1' : '#22c55e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' });