
'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/core/app-header';
import PdfUploader from '@/components/core/pdf-uploader';
import DataDashboard from '@/components/core/data-dashboard';
import type { ExtractedDataItem, AppSchema, PdfStatus, UploadQueueItem } from '@/lib/types';
import { defaultAppSchema } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData, type ExtractInvoiceInput, type ExtractInvoiceOutput } from '@/ai/flows/extract-invoice-data-flow';

const MOCK_SCHEMA: AppSchema = defaultAppSchema;

const MOCK_SCHEMA_EXPORTABLE_KEYS = MOCK_SCHEMA.fields
  .filter(field => field.key !== 'actions')
  .map(field => field.key as string);


const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export default function Home() {
  const [extractedData, setExtractedData] = useState<ExtractedDataItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(MOCK_SCHEMA_EXPORTABLE_KEYS);
  const { toast } = useToast();

  // Load data from localStorage on initial mount
  useEffect(() => {
    const storedData = localStorage.getItem('pdfHarvesterData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        // Basic validation if parsedData is an array
        if(Array.isArray(parsedData)) {
            setExtractedData(parsedData);
        } else {
            console.warn("Stored data is not an array, resetting.");
            localStorage.removeItem('pdfHarvesterData');
        }
      } catch (error) {
        console.error("Failed to parse stored data:", error);
        localStorage.removeItem('pdfHarvesterData'); // Clear corrupted data
      }
    }
    const storedSelectedColumns = localStorage.getItem('pdfHarvesterSelectedColumns');
    if (storedSelectedColumns) {
        try {
            const parsedColumns = JSON.parse(storedSelectedColumns);
            if (Array.isArray(parsedColumns) && parsedColumns.every(col => typeof col === 'string')) {
                setSelectedExportColumns(parsedColumns);
            }
        } catch (error) {
            console.error("Failed to parse stored selected columns:", error);
        }
    }

  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pdfHarvesterData', JSON.stringify(extractedData));
  }, [extractedData]);

  useEffect(() => {
    localStorage.setItem('pdfHarvesterSelectedColumns', JSON.stringify(selectedExportColumns));
  }, [selectedExportColumns]);


  const handleFileUploads = async (files: File[]) => {
    if (isProcessingFiles) return;
    setIsProcessingFiles(true);

    const newUploadItems: UploadQueueItem[] = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`, // More unique ID
      fileName: file.name,
      status: 'uploading' as PdfStatus,
      extractedValues: {},
      rawPdfUrl: URL.createObjectURL(file), // Create a temporary URL for preview
      fileObject: file, 
    }));

    // Add to local state immediately with 'uploading' status
    // Remove fileObject before setting state as it's not serializable for ExtractedDataItem
    setExtractedData(prev => [...newUploadItems.map(({fileObject, ...item}) => item), ...prev.filter(existingItem => !newUploadItems.find(newItem => newItem.id === existingItem.id))]);


    toast({
      title: "Procesare începută",
      description: `${files.length} fișier(e) sunt trimise pentru procesare.`,
    });

    for (const item of newUploadItems) {
      try {
        setExtractedData(prev => prev.map(d => d.id === item.id ? {...d, status: 'processing' as PdfStatus } : d));
        
        const pdfDataUri = await fileToDataUri(item.fileObject);
        const aiInput: ExtractInvoiceInput = { pdfDataUri };
        const aiOutput: ExtractInvoiceOutput | null = await extractInvoiceData(aiInput);

        if (aiOutput) {
          const extractedValues = {
            date: aiOutput.date,
            supplier: aiOutput.supplier,
            products: aiOutput.products || [], // Ensure products is an array
            totalPrice: aiOutput.totalPrice,
            currency: aiOutput.currency,
            documentLanguage: aiOutput.documentLanguage,
          };
          
          const processedItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl, // Keep the blob URL
            status: 'processed' as PdfStatus, 
            extractedValues 
          };
          setExtractedData(prev => prev.map(d => d.id === item.id ? processedItem : d));
          toast({
            title: "Fișier procesat",
            description: `${item.fileName} a fost procesat cu succes.`,
            variant: "default",
          });

        } else {
          const validationItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl,
            status: 'needs_validation' as PdfStatus, 
            errorMessage: "AI-ul nu a putut extrage datele sau a returnat un răspuns gol.",
            extractedValues: {}
          };
          setExtractedData(prev => prev.map(d => d.id === item.id ? validationItem : d));
          toast({
            title: "Validare necesară",
            description: `${item.fileName} necesită validare. AI-ul nu a putut extrage datele.`,
            variant: "warning", 
          });
        }
      } catch (error: any) {
        console.error("Eroare la procesarea fișierului cu AI:", item.fileName, error);
        const errorItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl,
            status: 'error' as PdfStatus, 
            errorMessage: error.message || "A apărut o eroare la procesarea AI.",
            extractedValues: {} 
        };
        setExtractedData(prev => prev.map(d => d.id === item.id ? errorItem : d));
        toast({
          title: "Eroare procesare AI",
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
     toast({
      title: "Modificare salvată",
      description: `Modificările pentru ${updatedItem.fileName} au fost salvate.`,
    });
  }, [toast]);

  const handleDeleteItem = useCallback((itemId: string) => {
    const itemToDelete = extractedData.find(item => item.id === itemId);
    if (itemToDelete?.rawPdfUrl) {
      URL.revokeObjectURL(itemToDelete.rawPdfUrl); // Revoke blob URL to free memory
    }
    setExtractedData(prevData => prevData.filter(item => item.id !== itemId));
    toast({
      title: "Fișier șters",
      description: `Fișierul ${itemToDelete?.fileName || 'selectat'} a fost șters.`,
      variant: "destructive"
    });
  }, [extractedData, toast]);


  const handleExportCsv = useCallback(() => {
    const relevantData = extractedData.filter(item => item.status === 'processed' || item.status === 'needs_validation');
    if (relevantData.length === 0) {
      toast({ title: "Nicio dată de exportat", description: "Nu există fișiere procesate sau care necesită validare.", variant: "warning" });
      return;
    }

    if (selectedExportColumns.length === 0) {
      toast({ title: "Nicio coloană selectată", description: "Vă rugăm selectați cel puțin o coloană pentru a exporta.", variant: "warning" });
      return;
    }
    
    const exportableSchemaFields = MOCK_SCHEMA.fields.filter(field => selectedExportColumns.includes(field.key as string));
    const headers = exportableSchemaFields.map(field => field.label);
    
    const rows = relevantData.map(item => {
        return exportableSchemaFields.map(schemaField => {
            let value: any;
             if (schemaField.key === 'fileName') value = item.fileName;
             else if (schemaField.key === 'status') value = item.status; // Status is not in extractedValues, but can be exported
             else value = item.extractedValues[schemaField.key as keyof typeof item.extractedValues];

            if (schemaField.type === 'products_list' && Array.isArray(value)) {
              const currency = item.extractedValues.currency || '';
              return value.map(p => `${p.name} (${p.quantity} x ${(p.price ?? 0).toFixed(2)} ${currency})`).join('; ');
            }
             if ((schemaField.type === 'number' || schemaField.key === 'totalPrice') && typeof value === 'number') {
                return `${value.toFixed(2)} ${item.extractedValues.currency || ''}`.trim();
            }
            if (value === undefined || value === null) return '';
            return String(value).replace(/"/g, '""'); 
          });
      });

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\r\n";
    rows.forEach(rowArray => {
      let row = rowArray.map(cell => `"${cell}"`).join(",");
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
  }, [extractedData, toast, selectedExportColumns]);

  // Clean up blob URLs on component unmount
  useEffect(() => {
    return () => {
      extractedData.forEach(item => {
        if (item.rawPdfUrl && item.rawPdfUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.rawPdfUrl);
        }
      });
    };
  }, [extractedData]);


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader appName="PDF Data Harvester" />
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
        <PdfUploader onUploadFiles={handleFileUploads} isProcessing={isProcessingFiles} />
        <DataDashboard
          data={extractedData}
          schema={MOCK_SCHEMA}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem} 
          onExportCsv={handleExportCsv}
          isLoading={isProcessingFiles && extractedData.some(d => d.status === 'uploading' || d.status === 'processing')}
          selectedExportColumns={selectedExportColumns}
          onSelectedExportColumnsChange={setSelectedExportColumns}
        />
      </main>
      <Toaster />
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        PDF Data Harvester &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
