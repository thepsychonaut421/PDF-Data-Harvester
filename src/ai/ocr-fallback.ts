import type { Product } from '@/lib/types'; // Asigură-te că InvoiceProduct este exportat din types

export async function runOcrFallbackExtraction(
  pdfDataUri: string // Deși nu îl folosim în simulare, îl păstrăm pentru API-ul viitor
): Promise<Product[] | null> {
  console.log("SIMULATING OCR Fallback: Running ocr-fallback.ts...");

  // SIMULARE: Aici ar fi apelul la OCR și parsarea textului.
  // Vom returna un set de date predefinite pentru a testa fluxul.
  // Acest set de date ar trebui să fie în formatul generic (item_code, name, quantity, price)
  // pe care îl așteaptă logica de mapare din page.tsx.

  // Exemplu de date simulate, ca și cum ar fi extrase din "Rechnung 2440056686.pdf"
  // după un OCR + Regex reușit.
  const simulatedOcrProducts: Product[] = [
    {
      item_code: "433563302746",
      name: "SILVERCREST® KITCHEN TOOLS SGR 150 E2 5-in-1 elektrische Gemüsereibe - B-Ware sehr gut",
      quantity: 2,
      price: 9.24 // Exemplu, prețul unitar dacă ar fi disponibil
    },
    {
      item_code: "421020142352",
      name: "BRAUN Epilierer Silk-épil >>3176<, mit Smartlight-Technologie - B-Ware sehr gut",
      quantity: 1,
      price: 18.48
    },
    {
      item_code: "405532908472",
      name: "PARKSIDE® Kreuzlinienlaser >>PKLL 10 B3«, mit Stativ - B-Ware neuwertig",
      quantity: 1,
      price: 17.65
    },
    {
      item_code: "405533493003",
      name: "SILVERCREST® PERSONAL CARE Haar- und Bartschneider >>SHBS 500 E4«, 2 Aufsteckkämme - B-Ware sehr gut",
      quantity: 2,
      price: 5.37
    },
    {
      item_code: "694184964658",
      name: "Masterpro Heißluftfritteuse, >>BGMP-9322<< 1500 W - B-Ware neuwertig",
      quantity: 2,
      price: 18.49
    },
    {
      item_code: "", // Sau null, dacă așa ar returna un Regex dacă nu găsește codul
      name: "Versand mit DHL",
      quantity: 1,
      price: 5.03
    }
  ];

  // Simulează o mică întârziere, ca un apel API
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Pentru a testa cazul în care OCR nu găsește nimic:
  // return null; 
  // return [];

  console.log("SIMULATING OCR Fallback: Returning simulated products:", simulatedOcrProducts);
  return simulatedOcrProducts;
}
