'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/core/app-header';
import PdfUploader from '@/components/core/pdf-uploader';
import DataDashboard from '@/components/core/data-dashboard';
import TemplateManagerDialog from '@/components/core/template-manager-dialog';
import type { ExtractedDataItem, AppSchema, PdfStatus, UploadQueueItem, InvoiceTemplate, Product } from '@/lib/types';
import { defaultAppSchema } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData, type ExtractInvoiceInput, type ExtractInvoiceOutput } from '@/ai/flows/extract-invoice-data-flow';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, FileText } from 'lucide-react';

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

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);

  // Load data from localStorage on initial mount
  useEffect(() => {
    const storedData = localStorage.getItem('pdfHarvesterData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if(Array.isArray(parsedData)) {
            setExtractedData(parsedData);
        } else {
            console.warn("Stored data is not an array, resetting.");
            localStorage.removeItem('pdfHarvesterData');
        }
      } catch (error) {
        console.error("Failed to parse stored data:", error);
        localStorage.removeItem('pdfHarvesterData');
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

    const storedTemplates = localStorage.getItem('pdfHarvesterTemplates');
    if (storedTemplates) {
      try {
        const parsedTemplates = JSON.parse(storedTemplates) as InvoiceTemplate[];
        if (Array.isArray(parsedTemplates)) {
          setTemplates(parsedTemplates);
        }
      } catch (error) {
        console.error("Failed to parse stored templates:", error);
      }
    }

    const storedSelectedTemplateId = localStorage.getItem('pdfHarvesterSelectedTemplateId');
    if (storedSelectedTemplateId && storedSelectedTemplateId !== "null") { // Check for "null" string
        setSelectedTemplateId(storedSelectedTemplateId);
    } else {
        setSelectedTemplateId(null); // Ensure it's truly null if not found or "null"
    }

  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pdfHarvesterData', JSON.stringify(extractedData));
  }, [extractedData]);

  useEffect(() => {
    localStorage.setItem('pdfHarvesterSelectedColumns', JSON.stringify(selectedExportColumns));
  }, [selectedExportColumns]);

  useEffect(() => {
    localStorage.setItem('pdfHarvesterTemplates', JSON.stringify(templates));
  }, [templates]);
  
  useEffect(() => {
    if (selectedTemplateId) {
      localStorage.setItem('pdfHarvesterSelectedTemplateId', selectedTemplateId);
    } else {
      // Store "null" explicitly or remove, depending on desired behavior for deselection
      localStorage.setItem('pdfHarvesterSelectedTemplateId', "null"); 
    }
  }, [selectedTemplateId]);

  const handleTemplatesChange = (updatedTemplates: InvoiceTemplate[]) => {
    setTemplates(updatedTemplates);
    if (selectedTemplateId && !updatedTemplates.find(t => t.id === selectedTemplateId)) {
      setSelectedTemplateId(null);
    }
  };

  const handleFileUploads = async (files: File[]) => {
    if (isProcessingFiles) return;
    setIsProcessingFiles(true);

    const currentTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null;

    const newUploadItems: UploadQueueItem[] = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      fileName: file.name,
      status: 'uploading' as PdfStatus,
      extractedValues: {}, // Initialize with an empty object
      rawPdfUrl: URL.createObjectURL(file),
      fileObject: file, 
    }));
    
    // Add to local state immediately with 'uploading' status
    const itemsToDisplay = newUploadItems.map(item => ({
        id: item.id,
        fileName: item.fileName,
        status: item.status,
        rawPdfUrl: item.rawPdfUrl,
        extractedValues: item.extractedValues,
        activeTemplateName: currentTemplate?.name || null
    }));
    setExtractedData(prev => [...itemsToDisplay, ...prev.filter(existingItem => !newUploadItems.find(newItem => newItem.id === existingItem.id))]);


    toast({
      title: "Procesare începută",
      description: `${files.length} fișier(e) trimise ${currentTemplate ? `folosind șablonul "${currentTemplate.name}"` : 'cu extragere standard'}.`,
    });

    for (const item of newUploadItems) {
      try {
        setExtractedData(prev => prev.map(d => d.id === item.id ? {...d, status: 'processing' as PdfStatus } : d));
        
        const pdfDataUri = await fileToDataUri(item.fileObject);
        const aiInput: ExtractInvoiceInput = { 
          pdfDataUri,
          lineItemColumns: currentTemplate?.columns 
        };
        const aiOutput: ExtractInvoiceOutput | null = await extractInvoiceData(aiInput);

        if (aiOutput) {
          const extractedValues = {
            date: aiOutput.date,
            supplier: aiOutput.supplier,
            products: aiOutput.products || [],
            totalPrice: aiOutput.totalPrice === undefined ? null : aiOutput.totalPrice,
            currency: aiOutput.currency,
            documentLanguage: aiOutput.documentLanguage,
          };
          
          const processedItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl,
            status: 'processed' as PdfStatus, 
            extractedValues,
            activeTemplateName: currentTemplate?.name || null,
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
            extractedValues: {},
            activeTemplateName: currentTemplate?.name || null,
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
            extractedValues: {},
            activeTemplateName: currentTemplate?.name || null,
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
    if (itemToDelete?.rawPdfUrl && itemToDelete.rawPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(itemToDelete.rawPdfUrl);
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
             else if (schemaField.key === 'status') value = item.status;
             else if (schemaField.key === 'activeTemplateName') value = item.activeTemplateName || 'Standard';
             else value = item.extractedValues[schemaField.key as keyof typeof item.extractedValues];

            if (schemaField.key === 'products' && Array.isArray(value)) { // Check schemaField.key for products
              const currency = item.extractedValues.currency || '';
              const templateUsed = item.activeTemplateName ? templates.find(t => t.name === item.activeTemplateName) : null;
              
              return value.map((p: Product) => { // Ensure p is typed as Product
                if (templateUsed && templateUsed.columns.length > 0) {
                  return templateUsed.columns.map(colKey => {
                     const colValue = p[colKey];
                     if (colValue === undefined || colValue === null) return '';
                     // Attempt to format as number with currency only if the column key suggests it's a monetary value
                     if (typeof colValue === 'number' && (colKey.toLowerCase().includes('price') || colKey.toLowerCase().includes('preis') || colKey.toLowerCase().includes('valoare') || colKey.toLowerCase().includes('total') || colKey.toLowerCase().includes('sum') || colKey.toLowerCase().includes('betrag'))) {
                         return `${colValue.toFixed(2)} ${currency}`.trim();
                     }
                     return String(colValue).replace(/"/g, '""'); // Escape double quotes in cell value
                  }).join(' | '); 
                } else {
                  // Default product stringification if no template or template has no columns
                  const pName = p.name || 'N/A';
                  const pQty = typeof p.quantity === 'number' ? p.quantity : 'N/A';
                  const pPrice = typeof p.price === 'number' ? `${p.price.toFixed(2)} ${currency}`.trim() : 'N/A';
                  return `${String(pName).replace(/"/g, '""')} (Qty: ${pQty}, Price: ${pPrice})`;
                }
              }).join('; '); // Semicolon to separate multiple products
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
  }, [extractedData, toast, selectedExportColumns, templates]);

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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <Card className="md:col-span-1 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Încărcare & Șablon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PdfUploader onUploadFiles={handleFileUploads} isProcessing={isProcessingFiles} />
              <div className="space-y-2 pt-4">
                <Label htmlFor="template-select" className="text-sm font-medium text-foreground">Selectează Șablon Extragere Linii Produse</Label>
                 <Select
                    value={selectedTemplateId || "none"} // Ensure "none" is default if null
                    onValueChange={(value) => setSelectedTemplateId(value === 'none' ? null : value)}
                  >
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Extragere standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Șabloane Disponibile</SelectLabel>
                      <SelectItem value="none">Extragere standard (Nume, Cant., Preț)</SelectItem>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">
                  Șablonul definește coloanele specifice pentru extragerea detaliilor din liniile de produse.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setIsTemplateManagerOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Gestionează Șabloane
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <DataDashboard
              data={extractedData}
              schema={MOCK_SCHEMA}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem} 
              onExportCsv={handleExportCsv}
              isLoading={isProcessingFiles && extractedData.some(d => d.status === 'uploading' || d.status === 'processing')}
              selectedExportColumns={selectedExportColumns}
              onSelectedExportColumnsChange={setSelectedExportColumns}
              templates={templates}
            />
          </div>
        </div>
      </main>
      <Toaster />
      <TemplateManagerDialog 
        isOpen={isTemplateManagerOpen}
        onOpenChange={setIsTemplateManagerOpen}
        templates={templates}
        onTemplatesChange={handleTemplatesChange}
      />
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        PDF Data Harvester &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
