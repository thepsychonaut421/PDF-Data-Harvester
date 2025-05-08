'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/core/app-header';
import PdfUploader from '@/components/core/pdf-uploader';
import DataDashboard from '@/components/core/data-dashboard';
import type { ExtractedDataItem, AppSchema, PdfStatus, Product } from '@/lib/types';
import { defaultAppSchema } from '@/lib/types'; // Import default schema
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

// Mock schema.json content (in a real app, this might be fetched or imported)
const MOCK_SCHEMA: AppSchema = defaultAppSchema;

// Mock Firebase interaction
const mockDatabase: ExtractedDataItem[] = [];

// Simulate backend processing time
const processingDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function Home() {
  const [extractedData, setExtractedData] = useState<ExtractedDataItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const { toast } = useToast();


  // Simulate fetching initial data (e.g., from Firebase on load)
  useEffect(() => {
    // In a real app, this would be a fetch call to your backend/Firebase
    setExtractedData([...mockDatabase]); 
  }, []);

  const handleFileUploads = async (files: File[]) => {
    if (isProcessingFiles) return;
    setIsProcessingFiles(true);

    const newUploadItems: ExtractedDataItem[] = files.map(file => ({
      id: `${file.name}-${Date.now()}`, // Simple unique ID
      fileName: file.name,
      status: 'uploading' as PdfStatus,
      extractedValues: {},
      rawPdfUrl: URL.createObjectURL(file), // For demo preview
    }));

    // Add to local state immediately with 'uploading' status
    setExtractedData(prev => [...newUploadItems, ...prev]);

    toast({
      title: "Procesare începută",
      description: `${files.length} fișier(e) sunt procesate.`,
    });

    for (const item of newUploadItems) {
      try {
        // Simulate upload to GCS
        await processingDelay(500); // Simulate network latency for upload
        setExtractedData(prev => prev.map(d => d.id === item.id ? {...d, status: 'processing' as PdfStatus } : d));

        // Simulate backend processing (PDF parsing, data extraction)
        await processingDelay(1500); // Simulate Cloud Function execution
        
        // Mock extraction logic based on MOCK_SCHEMA
        // This is where actual AI/Flows would be called
        // For demo, we'll generate some random data or fixed data
        const isSchemaMatch = Math.random() > 0.2; // 80% chance schema matches

        if (isSchemaMatch) {
          const randomProducts: Product[] = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
            name: `Produs ${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 100)}`,
            quantity: Math.floor(Math.random() * 5) + 1,
            price: parseFloat((Math.random() * 100 + 10).toFixed(2)),
          }));
          const totalPrice = randomProducts.reduce((sum, p) => sum + p.quantity * p.price, 0);

          const extractedValues = {
            date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
            supplier: `Furnizor ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
            products: randomProducts,
            totalPrice: parseFloat(totalPrice.toFixed(2)),
          };
          
          const processedItem = { ...item, status: 'processed' as PdfStatus, extractedValues };
          mockDatabase.unshift(processedItem); // Add to "DB"
          setExtractedData(prev => prev.map(d => d.id === item.id ? processedItem : d));
          toast({
            title: "Fișier procesat",
            description: `${item.fileName} a fost procesat cu succes.`,
            variant: "default",
          });

        } else {
          const validationItem = { ...item, status: 'needs_validation' as PdfStatus, errorMessage: "Schema nu se potrivește." };
          mockDatabase.unshift(validationItem);
          setExtractedData(prev => prev.map(d => d.id === item.id ? validationItem : d));
          toast({
            title: "Validare necesară",
            description: `${item.fileName} necesită validare manuală.`,
            variant: "default",
            className: "bg-yellow-500 border-yellow-600 text-yellow-900 dark:bg-yellow-700 dark:border-yellow-600 dark:text-yellow-100",
          });
        }
      } catch (error) {
        console.error("Error processing file:", item.fileName, error);
        const errorItem = { ...item, status: 'error' as PdfStatus, errorMessage: "A apărut o eroare la procesare." };
        mockDatabase.unshift(errorItem);
        setExtractedData(prev => prev.map(d => d.id === item.id ? errorItem : d));
        toast({
          title: "Eroare procesare",
          description: `A apărut o eroare la procesarea fișierului ${item.fileName}.`,
          variant: "destructive",
        });
      }
    }
    setIsProcessingFiles(false);
  };

  const handleUpdateItem = useCallback((updatedItem: ExtractedDataItem) => {
    setExtractedData(prevData =>
      prevData.map(item => (item.id === updatedItem.id ? updatedItem : item))
    );
    // Simulate updating in Firebase
    const dbIndex = mockDatabase.findIndex(item => item.id === updatedItem.id);
    if (dbIndex > -1) {
      mockDatabase[dbIndex] = updatedItem;
    }
     toast({
      title: "Modificare salvată",
      description: `Modificările pentru ${updatedItem.fileName} au fost salvate.`,
    });
  }, [toast]);

  const handleExportCsv = useCallback(() => {
    if (extractedData.length === 0) {
      toast({ title: "Nicio dată de exportat", variant: "destructive" });
      return;
    }

    // Use schema labels for headers
    const headers = MOCK_SCHEMA.fields
      .filter(field => field.key !== 'actions') // Exclude actions column
      .map(field => field.label);
    
    const rows = extractedData
      .filter(item => item.status === 'processed' || item.status === 'needs_validation') // Export only relevant data
      .map(item => {
        return MOCK_SCHEMA.fields
          .filter(field => field.key !== 'actions')
          .map(schemaField => {
            let value: any;
            if (schemaField.key === 'fileName') value = item.fileName;
            else if (schemaField.key === 'status') value = item.status; // Or a more user-friendly status string
            else value = item.extractedValues[schemaField.key as keyof typeof item.extractedValues];

            if (schemaField.type === 'products_list' && Array.isArray(value)) {
              // Serialize products array to a string, e.g., "Product A (2x10.00); Product B (1x20.50)"
              return value.map(p => `${p.name} (${p.quantity}x${p.price?.toFixed(2)})`).join('; ');
            }
            if (value === undefined || value === null) return '';
            return String(value).replace(/"/g, '""'); // Escape double quotes for CSV
          });
      });

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\r\n";
    rows.forEach(rowArray => {
      let row = rowArray.map(cell => `"${cell}"`).join(","); // Enclose all cells in quotes
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "date_extrase_pdf.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export CSV finalizat",
      description: "Datele au fost exportate cu succes.",
    });
  }, [extractedData, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader appName="PDF Data Harvester" />
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
        <PdfUploader onUploadFiles={handleFileUploads} isProcessing={isProcessingFiles} />
        <DataDashboard
          data={extractedData}
          schema={MOCK_SCHEMA}
          onUpdateItem={handleUpdateItem}
          onExportCsv={handleExportCsv}
          isLoading={isProcessingFiles && extractedData.some(d => d.status === 'uploading' || d.status === 'processing')}
        />
      </main>
      <Toaster />
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        PDF Data Harvester &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
