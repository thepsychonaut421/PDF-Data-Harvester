
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
import { Settings, FileText, ListTree, FileSpreadsheet } from 'lucide-react';

const MOCK_SCHEMA: AppSchema = defaultAppSchema;

type ProductExportFormat = 'summary' | 'line_items';

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
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
     defaultAppSchema.fields.filter(field => field.key !== 'actions').map(field => field.key as string)
  );
  const { toast } = useToast();

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [uploadTemplateId, setUploadTemplateId] = useState<string | null>(null);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  
  const [productExportFormat, setProductExportFormat] = useState<ProductExportFormat>('summary');
  const [productLineExportTemplateId, setProductLineExportTemplateId] = useState<string | null>(null);


  useEffect(() => {
    const storedData = localStorage.getItem('pdfHarvesterData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData) as ExtractedDataItem[]; 
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

    const storedUploadTemplateId = localStorage.getItem('pdfHarvesterUploadTemplateId');
    if (storedUploadTemplateId && storedUploadTemplateId !== "null") { 
        setUploadTemplateId(storedUploadTemplateId);
    } else {
        setUploadTemplateId(null); 
    }
    
    const storedProductExportFormat = localStorage.getItem('pdfHarvesterProductExportFormat');
    if (storedProductExportFormat && (storedProductExportFormat === 'summary' || storedProductExportFormat === 'line_items')) {
        setProductExportFormat(storedProductExportFormat as ProductExportFormat);
    }

    const storedProductLineExportTemplateId = localStorage.getItem('pdfHarvesterProductLineExportTemplateId');
    if (storedProductLineExportTemplateId && storedProductLineExportTemplateId !== "null") {
        setProductLineExportTemplateId(storedProductLineExportTemplateId);
    }

  }, []);

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
    if (uploadTemplateId) {
      localStorage.setItem('pdfHarvesterUploadTemplateId', uploadTemplateId);
    } else {
      localStorage.setItem('pdfHarvesterUploadTemplateId', "null"); 
    }
  }, [uploadTemplateId]);

  useEffect(() => {
    localStorage.setItem('pdfHarvesterProductExportFormat', productExportFormat);
  }, [productExportFormat]);

  useEffect(() => {
    if (productLineExportTemplateId) {
      localStorage.setItem('pdfHarvesterProductLineExportTemplateId', productLineExportTemplateId);
    } else {
      localStorage.setItem('pdfHarvesterProductLineExportTemplateId', "null");
    }
  }, [productLineExportTemplateId]);


  const handleTemplatesChange = (updatedTemplates: InvoiceTemplate[]) => {
    setTemplates(updatedTemplates);
    if (uploadTemplateId && !updatedTemplates.find(t => t.id === uploadTemplateId)) {
      setUploadTemplateId(null);
    }
    if (productLineExportTemplateId && !updatedTemplates.find(t => t.id === productLineExportTemplateId)) {
        setProductLineExportTemplateId(null);
    }
  };

  const handleFileUploads = async (files: File[]) => {
    if (isProcessingFiles) return;
    setIsProcessingFiles(true);

    const currentUploadTemplate = uploadTemplateId ? templates.find(t => t.id === uploadTemplateId) : null;

    const newUploadItems: UploadQueueItem[] = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      fileName: file.name,
      status: 'uploading' as PdfStatus,
      extractedValues: {}, 
      rawPdfUrl: URL.createObjectURL(file), 
      fileObject: file,
    }));
    
    const itemsToDisplay = newUploadItems.map(item => ({
        id: item.id,
        fileName: item.fileName,
        status: item.status,
        rawPdfUrl: item.rawPdfUrl,
        extractedValues: item.extractedValues,
        activeTemplateId: currentUploadTemplate?.id || null,
    }));
    setExtractedData(prev => [...itemsToDisplay, ...prev.filter(existingItem => !newUploadItems.find(newItem => newItem.id === existingItem.id))]);


    toast({
      title: "Procesare începută",
      description: `${files.length} fișier(e) trimise ${currentUploadTemplate ? `folosind șablonul de extragere "${currentUploadTemplate.name}"` : 'cu extragere standard'}.`,
    });

    for (const item of newUploadItems) {
      try {
        setExtractedData(prev => prev.map(d => d.id === item.id ? {...d, status: 'processing' as PdfStatus } : d));
        
        const pdfDataUri = await fileToDataUri(item.fileObject);
        const aiInput: ExtractInvoiceInput = { 
          pdfDataUri,
          lineItemColumns: currentUploadTemplate?.columns 
        };
        const aiOutput: ExtractInvoiceOutput | null = await extractInvoiceData(aiInput);

        if (aiOutput) {
          const extractedValues = {
            date: aiOutput.date,
            supplier: aiOutput.supplier,
            products: aiOutput.products || [],
            totalPrice: aiOutput.totalPrice,
            currency: aiOutput.currency,
            documentLanguage: aiOutput.documentLanguage,
          };
          
          const processedItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl, 
            status: 'processed' as PdfStatus, 
            extractedValues,
            activeTemplateId: currentUploadTemplate?.id || null,
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
            activeTemplateId: currentUploadTemplate?.id || null,
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
            activeTemplateId: currentUploadTemplate?.id || null,
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

    let csvHeaders: string[] = [];
    let csvRows: string[][] = [];

    if (productExportFormat === 'line_items') {
        if (!productLineExportTemplateId) {
            toast({ title: "Selectați Șablon Export Produse", description: "Pentru exportul detaliat pe linii de produse, selectați un șablon de coloane pentru produse.", variant: "warning" });
            return;
        }
        const exportTemplate = templates.find(t => t.id === productLineExportTemplateId);
        if (!exportTemplate) {
            toast({ title: "Șablon Export Produse Invalid", description: "Șablonul selectat pentru exportul liniilor de produse nu a fost găsit.", variant: "warning" });
            return;
        }

        const parentSchemaFields = MOCK_SCHEMA.fields.filter(field => selectedExportColumns.includes(field.key as string) && field.key !== 'products');
        const parentHeaders = parentSchemaFields.map(field => field.label);
        const productSpecificHeaders = exportTemplate.columns;
        csvHeaders = [...parentHeaders, ...productSpecificHeaders];

        relevantData.forEach(item => {
            const parentRowPart = parentSchemaFields.map(schemaField => {
                let value: any;
                if (schemaField.key === 'fileName') value = item.fileName;
                else if (schemaField.key === 'status') value = item.status;
                else if (schemaField.key === 'activeTemplateName') {
                    const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                    value = template ? template.name : 'Standard (Extragere)';
                } else {
                    value = item.extractedValues[schemaField.key as keyof typeof item.extractedValues];
                }

                if ((schemaField.type === 'number' || schemaField.key === 'totalPrice') && typeof value === 'number') {
                    return `${value.toFixed(2)} ${item.extractedValues.currency || ''}`.trim();
                }
                if (value === undefined || value === null) return '';
                return String(value).replace(/"/g, '""');
            });

            if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                item.extractedValues.products.forEach(product => {
                    const productRowPart = exportTemplate.columns.map(colKey => {
                        const val = product[colKey];
                        if (val === undefined || val === null) return '';
                         // Aici s-ar putea adauga formatare specifica pentru tipuri de date din produs (ex: numere, moneda)
                        return String(val).replace(/"/g, '""');
                    });
                    csvRows.push([...parentRowPart, ...productRowPart]);
                });
            } else {
                 // Include rândul părinte chiar dacă nu are produse, dacă sunt selectate coloane părinte
                if (parentSchemaFields.length > 0) {
                    const emptyProductPart = exportTemplate.columns.map(() => '');
                    csvRows.push([...parentRowPart, ...emptyProductPart]);
                }
            }
        });
         if (csvRows.length === 0 && parentSchemaFields.length === 0 && productSpecificHeaders.length > 0 && relevantData.some(item => item.extractedValues.products && item.extractedValues.products.length > 0)) {
           // Caz special: doar coloane de produs selectate, exportam doar liniile de produse
            relevantData.forEach(item => {
                if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                    item.extractedValues.products.forEach(product => {
                        const productRowPart = exportTemplate.columns.map(colKey => {
                            const val = product[colKey];
                            if (val === undefined || val === null) return '';
                            return String(val).replace(/"/g, '""');
                        });
                        csvRows.push([...productRowPart]);
                    });
                }
            });
            csvHeaders = [...productSpecificHeaders]; // Asiguram ca headerul reflecta doar coloanele de produs
        }


    } else { // productExportFormat === 'summary'
        if (selectedExportColumns.length === 0) {
          toast({ title: "Nicio coloană selectată", description: "Vă rugăm selectați cel puțin o coloană pentru a exporta.", variant: "warning" });
          return;
        }
        const exportableSchemaFields = MOCK_SCHEMA.fields.filter(field => selectedExportColumns.includes(field.key as string));
        csvHeaders = exportableSchemaFields.map(field => field.label);
        
        csvRows = relevantData.map(item => {
            return exportableSchemaFields.map(schemaField => {
                let value: any;
                if (schemaField.key === 'fileName') value = item.fileName;
                else if (schemaField.key === 'status') value = item.status;
                else if (schemaField.key === 'activeTemplateName') {
                    const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                    value = template ? template.name : 'Standard (Extragere)';
                }
                else value = item.extractedValues[schemaField.key as keyof typeof item.extractedValues];

                if (schemaField.key === 'products' && Array.isArray(value)) {
                    const currency = item.extractedValues.currency || '';
                    const extractionTemplate = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                  
                    return value.map((p: Product) => { 
                        if (extractionTemplate && extractionTemplate.columns.length > 0) {
                            return extractionTemplate.columns.map(colKey => {
                                const colValue = p[colKey]; 
                                if (colValue === undefined || colValue === null) return ''; 
                                if (typeof colValue === 'number' && (
                                    colKey.toLowerCase().includes('price') || 
                                    colKey.toLowerCase().includes('preis') || 
                                    colKey.toLowerCase().includes('valoare') || 
                                    colKey.toLowerCase().includes('total') || 
                                    colKey.toLowerCase().includes('sum') || 
                                    colKey.toLowerCase().includes('betrag')
                                )) {
                                    return `${colValue.toFixed(2)} ${currency}`.trim();
                                }
                                return String(colValue).replace(/"/g, '""'); 
                            }).join(' | ');
                        } else {
                            const pName = p.name || 'N/A';
                            const pQty = (typeof p.quantity === 'number' || typeof p.quantity === 'string') && p.quantity !== null && p.quantity !== undefined ? p.quantity : 'N/A';
                            const pPrice = typeof p.price === 'number' && p.price !== null && p.price !== undefined ? `${p.price.toFixed(2)} ${currency}`.trim() : 'N/A';
                            return `${String(pName).replace(/"/g, '""')} (Qty: ${pQty}, Price: ${pPrice})`;
                        }
                    }).join('; '); 
                }
                if ((schemaField.type === 'number' || schemaField.key === 'totalPrice') && typeof value === 'number') {
                    return `${value.toFixed(2)} ${item.extractedValues.currency || ''}`.trim();
                }
                if (value === undefined || value === null) return '';
                return String(value).replace(/"/g, '""'); 
            });
        });
    }

    if (csvRows.length === 0) {
        toast({ title: "Nicio dată de exportat", description: "Nu s-au găsit date conform selecțiilor pentru export.", variant: "warning" });
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += csvHeaders.join(",") + "\r\n";
    csvRows.forEach(rowArray => {
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
  }, [extractedData, toast, selectedExportColumns, templates, productExportFormat, productLineExportTemplateId]);

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
          <Card className="md:col-span-1 shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Încărcare & Șabloane</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PdfUploader onUploadFiles={handleFileUploads} isProcessing={isProcessingFiles} />
              
              <div className="space-y-2">
                <Label htmlFor="upload-template-select" className="text-sm font-medium text-foreground">Șablon Extragere Linii Produse (Upload)</Label>
                 <Select
                    value={uploadTemplateId || "none"} 
                    onValueChange={(value) => setUploadTemplateId(value === 'none' ? null : value)}
                  >
                  <SelectTrigger id="upload-template-select" className="rounded-md">
                    <SelectValue placeholder="Extragere standard" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
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
                  Utilizat la procesarea inițială a PDF-urilor pentru a structura datele din liniile de produse.
                </p>
              </div>
              <Button variant="outline" className="w-full rounded-md" onClick={() => setIsTemplateManagerOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Gestionează Șabloane
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-lg rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><FileSpreadsheet className="mr-2 h-5 w-5 text-primary"/>Opțiuni Export CSV</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-export-format-select">Format Export Produse</Label>
                  <Select value={productExportFormat} onValueChange={(value) => setProductExportFormat(value as ProductExportFormat)}>
                    <SelectTrigger id="product-export-format-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Sumar (Produse într-o singură coloană)</SelectItem>
                      <SelectItem value="line_items">Detaliat (Fiecare produs/coloană pe rând nou)</SelectItem>
                    </SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground">
                    Alegeți cum să fie formatate liniile de produse în CSV.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-template-select">Șablon Coloane Produse (Export Detaliat)</Label>
                  <Select
                    value={productLineExportTemplateId || "none"}
                    onValueChange={(value) => setProductLineExportTemplateId(value === "none" ? null : value)}
                    disabled={productExportFormat !== 'line_items'}
                  >
                    <SelectTrigger id="export-template-select">
                      <SelectValue placeholder="Selectați un șablon" />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectGroup>
                        <SelectLabel>Șabloane pentru Coloane Produs</SelectLabel>
                        {templates.length === 0 && <SelectItem value="none" disabled>Nu sunt șabloane definite</SelectItem>}
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.columns.join(', ')})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Activ doar pentru formatul "Detaliat". Definește coloanele pentru fiecare linie de produs.
                  </p>
                </div>
              </CardContent>
            </Card>
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
      <footer className="py-4 text-center text-sm text-muted-foreground border-t mt-auto">
        PDF Data Harvester &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

