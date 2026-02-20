import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onDetected }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [0] // Tylko kody kreskowe
    });
    
    scanner.render(async (decodedText) => {
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
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
          alert("Produktu nie ma w darmowej bazie.");
        }
      } catch (e) {
        alert("Błąd połączenia z bazą kodów.");
      }
    }, () => {});

    return () => scanner.clear().catch(e => console.error(e));
  }, []);

  return <div id="reader" style={{ marginBottom: '15px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}></div>;
}