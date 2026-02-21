import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onDetected }) {
  const isProcessing = useRef(false); // Blokada wielokrotnego skanowania

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [0] 
    });
    
    scanner.render(async (decodedText) => {
      if (isProcessing.current) return; // Jeśli już coś przetwarzamy, ignoruj
      
      isProcessing.current = true;
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
        
        if (!res.ok) throw new Error("Problem z siecią");
        
        const data = await res.json();
        
        if (data.status === 1) {
          const p = data.product;
          onDetected({
            name: p.product_name || "Nieznany produkt",
            kcal: p.nutriments['energy-kcal_100g'] || 0,
            p: p.nutriments.proteins_100g || 0,
            f: p.nutriments.fat_100g || 0,
            c: p.nutriments.carbohydrates_100g || 0
          });
          scanner.clear();
        } else {
          // Produktu nie ma w bazie - pozwól skanować dalej po krótkiej chwili
          setTimeout(() => { isProcessing.current = false; }, 2000);
          console.warn("Produktu nie znaleziono w OpenFoodFacts");
        }
      } catch (e) {
        console.error("Błąd połączenia z bazą kodów");
        // Błąd połączenia - pozwól spróbować ponownie za 3 sekundy
        setTimeout(() => { isProcessing.current = false; }, 3000);
      }
    }, () => {});

    return () => {
      scanner.clear().catch(e => console.error("Błąd czyszczenia skanera", e));
    };
  }, [onDetected]);

  return (
    <div style={{ marginBottom: '15px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}>
      <div id="reader"></div>
    </div>
  );
}