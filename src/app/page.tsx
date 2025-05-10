
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppHeader from '@/components/core/app-header';
import PdfUploader from '@/components/core/pdf-uploader';
import DataDashboard from '@/components/core/data-dashboard';
import TemplateManagerDialog from '@/components/core/template-manager-dialog';
import type { ExtractedDataItem, AppSchema, PdfStatus, UploadQueueItem, InvoiceTemplate, Product, SchemaField, ExtractedInvoiceValues } from '@/lib/types';
import { defaultAppSchema, erpNextDefaultTemplate, aiStandardUploadTemplate, comprehensiveUploadTemplate, comprehensiveExportTemplate, erpNextExportFixedV1Template } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData, type ExtractInvoiceInput, type ExtractInvoiceOutput } from '@/ai/flows/extract-invoice-data-flow';
import { runOcrFallbackExtraction } from '@/ai/ocr-fallback';
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
  // For ERPNext fixed export, selectedExportColumns primarily affects UI display, not the final CSV structure for that export.
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(['p_item_code', 'p_name']);
  const { toast } = useToast();

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [uploadTemplateId, setUploadTemplateId] = useState<string | null>(aiStandardUploadTemplate.id); 
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  
  // Force "Detaliat" (line_items) format for ERPNext export
  const [productExportFormat, setProductExportFormat] = useState<ProductExportFormat>('line_items'); 
  // Force ERPNext fixed export template
  const [productLineExportTemplateId, setProductLineExportTemplateId] = useState<string | null>(erpNextExportFixedV1Template.id);

  useEffect(() => {
    const storedData = localStorage.getItem('pdfHarvesterData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData) as ExtractedDataItem[]; 
        if(Array.isArray(parsedData)) {
            setExtractedData(parsedData);
        } else {
            localStorage.removeItem('pdfHarvesterData');
        }
      } catch (error) {
        localStorage.removeItem('pdfHarvesterData');
      }
    }
    
    // Initialize selectedExportColumns to fixed values for ERPNext
    const fixedExportSelection = ['p_item_code', 'p_name'];
    const storedSelectedColumns = localStorage.getItem('pdfHarvesterSelectedColumns');
    if (storedSelectedColumns) {
        try {
            const parsedColumns = JSON.parse(storedSelectedColumns);
            // If stored columns differ, reset to fixed selection. This ensures UI consistency for ERPNext export.
            if (Array.isArray(parsedColumns) && parsedColumns.every(col => typeof col === 'string')) {
                 const sortedParsed = [...parsedColumns].sort();
                 const sortedFixed = [...fixedExportSelection].sort();
                 if (JSON.stringify(sortedParsed) !== JSON.stringify(sortedFixed)) {
                    setSelectedExportColumns(fixedExportSelection);
                 } else {
                    setSelectedExportColumns(parsedColumns);
                 }
            } else {
                 setSelectedExportColumns(fixedExportSelection);
            }
        } catch (error) {
             setSelectedExportColumns(fixedExportSelection);
        }
    } else {
        setSelectedExportColumns(fixedExportSelection);
    }


    const storedTemplates = localStorage.getItem('pdfHarvesterTemplates');
    let initialTemplates: InvoiceTemplate[] = [];
    if (storedTemplates) {
      try {
        initialTemplates = JSON.parse(storedTemplates) as InvoiceTemplate[];
        if (!Array.isArray(initialTemplates)) initialTemplates = [];
      } catch (error) {
        initialTemplates = [];
      }
    }
    
    const defaultTpls = [erpNextDefaultTemplate, aiStandardUploadTemplate, comprehensiveUploadTemplate, comprehensiveExportTemplate, erpNextExportFixedV1Template];
    defaultTpls.forEach(defTpl => {
        const existing = initialTemplates.find(t => t.id === defTpl.id);
        if (existing) { 
            existing.isDefault = defTpl.isDefault;
            existing.forUpload = defTpl.forUpload;
            existing.name = defTpl.name; 
            existing.columns = defTpl.columns; 
        } else {
            initialTemplates.push({...defTpl});
        }
    });
    setTemplates(initialTemplates);

    const storedUploadTemplateId = localStorage.getItem('pdfHarvesterUploadTemplateId');
    if (storedUploadTemplateId && initialTemplates.some(t => t.id === storedUploadTemplateId && t.forUpload)) { 
        setUploadTemplateId(storedUploadTemplateId);
    } else {
        const defaultUploadTpl = initialTemplates.find(t => t.id === aiStandardUploadTemplate.id) || initialTemplates.find(t => t.forUpload && t.isDefault) || initialTemplates.find(t => t.forUpload);
        setUploadTemplateId(defaultUploadTpl ? defaultUploadTpl.id : null);
    }
    
    // Forcing productExportFormat and productLineExportTemplateId
    setProductExportFormat('line_items');
    setProductLineExportTemplateId(erpNextExportFixedV1Template.id);

  }, []); 

  useEffect(() => {
     localStorage.setItem('pdfHarvesterTemplates', JSON.stringify(templates));
     if (templates.length > 0) {
        const currentUploadTemplateIsValid = uploadTemplateId && templates.some(t => t.id === uploadTemplateId && t.forUpload);
        if (!currentUploadTemplateIsValid) {
            const defaultUploadTpl = templates.find(t => t.id === aiStandardUploadTemplate.id) || templates.find(t => t.forUpload && t.isDefault) || templates.find(t => t.forUpload);
            setUploadTemplateId(defaultUploadTpl ? defaultUploadTpl.id : null);
        }

        // Ensure the fixed ERPNext export template is selected if available
        if (!templates.find(t => t.id === erpNextExportFixedV1Template.id && !t.forUpload)) {
             // This case should ideally not happen if erpNextExportFixedV1Template is always added
            const fallbackExport = templates.find(t => !t.forUpload && t.isDefault) || templates.find(t => !t.forUpload);
            setProductLineExportTemplateId(fallbackExport ? fallbackExport.id : null);
        } else {
            setProductLineExportTemplateId(erpNextExportFixedV1Template.id);
        }

     } else {
        setProductLineExportTemplateId(null);
        setUploadTemplateId(null);
     }
  }, [templates, uploadTemplateId]); // productLineExportTemplateId removed as it's fixed

  useEffect(() => {
    localStorage.setItem('pdfHarvesterData', JSON.stringify(extractedData));
  }, [extractedData]);

  useEffect(() => {
    // Always ensure selectedExportColumns are fixed for the ERPNext export scenario
    const fixedSelection = ['p_item_code', 'p_name'];
    const sortedCurrent = [...selectedExportColumns].sort();
    const sortedFixed = [...fixedSelection].sort();
    if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedFixed)) {
        setSelectedExportColumns(fixedSelection);
    }
    localStorage.setItem('pdfHarvesterSelectedColumns', JSON.stringify(fixedSelection));
  }, [selectedExportColumns]);
  
  useEffect(() => {
    if (uploadTemplateId) {
      localStorage.setItem('pdfHarvesterUploadTemplateId', uploadTemplateId);
    } else {
      localStorage.removeItem('pdfHarvesterUploadTemplateId');
    }
  }, [uploadTemplateId]);

  useEffect(() => {
    // productExportFormat is fixed to 'line_items'
    localStorage.setItem('pdfHarvesterProductExportFormat', 'line_items');
  }, []);

  useEffect(() => {
    // productLineExportTemplateId is fixed to erpNextExportFixedV1Template.id
    if (erpNextExportFixedV1Template.id) {
      localStorage.setItem('pdfHarvesterProductLineExportTemplateId', erpNextExportFixedV1Template.id);
    } else {
      localStorage.removeItem('pdfHarvesterProductLineExportTemplateId');
    }
  }, []);


  const handleTemplatesChange = (updatedTemplates: InvoiceTemplate[]) => {
    const defaultTpls = [erpNextDefaultTemplate, aiStandardUploadTemplate, comprehensiveUploadTemplate, comprehensiveExportTemplate, erpNextExportFixedV1Template];
    let newTemplates = [...updatedTemplates];

    defaultTpls.forEach(defTpl => {
        const existingIndex = newTemplates.findIndex(t => t.id === defTpl.id);
        if (existingIndex > -1) { 
            newTemplates[existingIndex] = {
                ...newTemplates[existingIndex], 
                name: defTpl.name, 
                columns: defTpl.columns, 
                isDefault: defTpl.isDefault,
                forUpload: defTpl.forUpload,
            };
        } else { 
            newTemplates.push({...defTpl});
        }
    });
    
    setTemplates(newTemplates);

    const currentUploadTemplate = newTemplates.find(t => t.id === uploadTemplateId && t.forUpload);
    if (!currentUploadTemplate) {
      const fallbackUpload = newTemplates.find(t => t.id === aiStandardUploadTemplate.id) || newTemplates.find(t => t.forUpload && t.isDefault) || newTemplates.find(t => t.forUpload);
      setUploadTemplateId(fallbackUpload ? fallbackUpload.id : null);
    }
    // productLineExportTemplateId is fixed, no need to update based on template changes here
    setProductLineExportTemplateId(erpNextExportFixedV1Template.id);
  };

  const handleFileUploads = async (files: File[]) => {
    if (isProcessingFiles) return;
    setIsProcessingFiles(true);

    const currentUploadTemplateObj = uploadTemplateId ? templates.find(t => t.id === uploadTemplateId && t.forUpload) : templates.find(t => t.id === aiStandardUploadTemplate.id);

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
        activeTemplateId: currentUploadTemplateObj?.id || null,
    }));
    setExtractedData(prev => [...itemsToDisplay, ...prev.filter(existingItem => !newUploadItems.find(newItem => newItem.id === existingItem.id))]);

    toast({
      title: "Procesare începută",
      description: `${files.length} fișier(e) trimise ${currentUploadTemplateObj ? `folosind șablonul de extragere "${currentUploadTemplateObj.name}"` : 'cu extragere AI standard'}.`,
    });

    for (const item of newUploadItems) {
      try {
        setExtractedData(prev => prev.map(d => d.id === item.id ? {...d, status: 'processing' as PdfStatus } : d));
        
        const pdfDataUri = await fileToDataUri(item.fileObject);
        const aiInput: ExtractInvoiceInput = { 
          pdfDataUri,
          lineItemColumns: currentUploadTemplateObj?.columns 
        };
        let aiOutput: ExtractInvoiceOutput | null = await extractInvoiceData(aiInput);
        let productsExtractedBy = 'ai';

        const aiProducts = aiOutput?.products || [];
        const productsAreUnsatisfactory = aiProducts.length === 0 || 
                                         aiProducts.every(p => !p.name && !p.quantity && !p.item_code && !p.price && !p.amount);

        if (aiOutput && productsAreUnsatisfactory && item.fileName !== "Peutestr_22A_2025-03-26.pdf") { // Skip OCR for specific problematic file or if products exist
          toast({
            title: "Extragere AI produse eșuată/incompletă",
            description: `Se încearcă fallback OCR SIMULAT pentru ${item.fileName}.`,
            variant: "default", 
          });
          const fallbackProducts = await runOcrFallbackExtraction(pdfDataUri);
          if (fallbackProducts && fallbackProducts.length > 0) {
             aiOutput.products = fallbackProducts.map(fp => ({...fp})); 
             productsExtractedBy = 'ocr_fallback (simulated)';
          }
        }

        if (aiOutput) {
          const rawProducts = aiOutput.products || [];
          
          const extractedValues: ExtractedDataItem['extractedValues'] = {
            date: aiOutput.date,
            supplier: aiOutput.supplier,
            products: rawProducts, 
            totalPrice: aiOutput.totalPrice,
            currency: aiOutput.currency,
            documentLanguage: aiOutput.documentLanguage,
            invoiceNumber: aiOutput.invoiceNumber,
            subtotal: aiOutput.subtotal,
            totalDiscountAmount: aiOutput.totalDiscountAmount,
            totalTaxAmount: aiOutput.totalTaxAmount,
            paymentTerms: aiOutput.paymentTerms,
            dueDate: aiOutput.dueDate,
          };
          
          const processedItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl, 
            status: 'processed' as PdfStatus, 
            extractedValues,
            activeTemplateId: currentUploadTemplateObj?.id || null,
          };
          setExtractedData(prev => prev.map(d => d.id === item.id ? processedItem : d));
          toast({
            title: "Fișier procesat",
            description: `${item.fileName} a fost procesat (Produse via ${productsExtractedBy}).`,
            variant: "success",
          });

        } else {
          const validationItem: ExtractedDataItem = { 
            id: item.id,
            fileName: item.fileName,
            rawPdfUrl: item.rawPdfUrl,
            status: 'needs_validation' as PdfStatus, 
            errorMessage: "AI-ul și OCR fallback nu au putut extrage datele.",
            extractedValues: {},
            activeTemplateId: currentUploadTemplateObj?.id || null,
          };
          setExtractedData(prev => prev.map(d => d.id === item.id ? validationItem : d));
          toast({
            title: "Validare necesară",
            description: `${item.fileName} necesită validare. AI-ul și fallback-ul nu au putut extrage datele.`,
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
            errorMessage: error.message || "A apărut o eroare la procesare.",
            extractedValues: {},
            activeTemplateId: currentUploadTemplateObj?.id || null,
        };
        setExtractedData(prev => prev.map(d => d.id === item.id ? errorItem : d));
        toast({
          title: "Eroare procesare",
          description: `A apărut o eroare la procesarea fișierului ${item.fileName}. Detalii: ${error.message}`,
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
      variant: "success"
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

  const handleClearAllItems = useCallback(() => {
    extractedData.forEach(item => {
      if (item.rawPdfUrl && item.rawPdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.rawPdfUrl);
      }
    });
    setExtractedData([]);
    toast({
      title: "Toate fișierele șterse",
      description: "Lista de fișiere procesate a fost golită.",
      variant: "destructive",
    });
  }, [extractedData, toast]);

 const formatCsvCell = (value: any, delimiter: string = ','): string => { // Default delimiter changed to comma
    if (value === undefined || value === null) return '';
    let stringValue = String(value);
    
    // For ERPNext export (comma delimiter), ensure numbers use dot as decimal, not comma
    // This specific handling for semicolon delimiter is less relevant if comma is fixed for ERPNext
    // if (delimiter === ';') { 
    //     if (typeof value === 'number' || (!isNaN(parseFloat(String(value).replace(',', '.'))))) {
    //         const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    //         if (!isNaN(num)) {
    //              stringValue = String(num).replace('.', ',');
    //         }
    //     }
    // }
    
    stringValue = stringValue.replace(/"/g, '""'); 
    if (stringValue.includes(delimiter) || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue}"`;
    }
    return stringValue;
  };


  const handleExportCsv = useCallback(() => {
    const relevantData = extractedData.filter(item => item.status === 'processed' || item.status === 'needs_validation');
    if (relevantData.length === 0) {
      toast({ title: "Nicio dată de exportat", description: "Nu există fișiere procesate sau care necesită validare.", variant: "warning" });
      return;
    }
    
    let csvHeaders: string[] = [];
    let csvRows: string[][] = [];
    let csvContent = "";
    let currentDelimiter = ','; // Fixed to comma for ERPNext
    let useBOM = false; // Fixed to no BOM for ERPNext


    // Always use ERPNext Fixed Export logic
    csvHeaders = ['Artikel-Code', 'Artikelname', 'Artikelgruppe', 'Standardmaßeinheit'];
    currentDelimiter = ','; 
    useBOM = false;

    const collectedProductRows: string[][] = [];

    relevantData.forEach(item => {
        if (item.extractedValues.products && item.extractedValues.products.length > 0) {
            item.extractedValues.products.forEach(product => {
                const itemCode = String(product.item_code || '').trim();
                
                // Filter: Artikel-Code must be numeric (only digits as per ^\d+$)
                if (!/^\d+$/.test(itemCode)) {
                    return; 
                }

                let artikelname = String(product.name || product.description || '').trim();
                // Clean text: replace newlines, tabs with a single space, then multiple spaces with a single space, then trim.
                artikelname = artikelname.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

                const artikelGruppe = "Produkte"; // Static value
                const standardmasseinheit = "Stk"; // Static value

                collectedProductRows.push([
                    itemCode,
                    artikelname,
                    artikelGruppe,
                    standardmasseinheit
                ]);
            });
        }
    });

    // Sort by Artikel-Code (numerically)
    collectedProductRows.sort((a, b) => {
        const numA = parseInt(a[0], 10);
        const numB = parseInt(b[0], 10);
        // This handles cases where itemCode might not be purely numeric after all, though filter should prevent it
        if (isNaN(numA) && isNaN(numB)) return a[0].localeCompare(b[0]);
        if (isNaN(numA)) return 1; // Non-numeric strings last
        if (isNaN(numB)) return -1; // Non-numeric strings last
        return numA - numB;
    });
    
    csvRows = collectedProductRows.map(row => row.map(cell => formatCsvCell(cell, currentDelimiter)));
    
    if (csvRows.length === 0 && relevantData.length > 0) {
      // For ERPNext exports, if no products match criteria, export just headers
    }
     else if (csvRows.length === 0 && csvHeaders.length === 0) { // Should not happen with fixed headers
         toast({ title: "Nicio dată de exportat", description: "Nu s-au găsit date conform selecțiilor pentru export.", variant: "warning" });
        return;
    }

    if (useBOM) { // Will be false for ERPNext
      csvContent += "\uFEFF"; 
    }
    csvContent += csvHeaders.map(header => formatCsvCell(header, currentDelimiter)).join(currentDelimiter) + "\n"; 
    csvRows.forEach(rowArray => {
      let row = rowArray.join(currentDelimiter);
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute("download", `erpnext_import_produse_${timestamp}.csv`); // More specific name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export CSV pentru ERPNext finalizat",
      description: "Datele au fost exportate cu succes.",
      variant: "success"
    });
  }, [extractedData, toast]); // Removed dependencies related to selectable columns/templates as they are now fixed


  const availableExportTemplates = useMemo(() => {
    // Only show the ERPNext fixed export template
    return templates.filter(t => t.id === erpNextExportFixedV1Template.id && !t.forUpload);
  }, [templates]);

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
              <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Încărcare & Șabloane Extragere</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PdfUploader onUploadFiles={handleFileUploads} isProcessing={isProcessingFiles} />
              
              <div className="space-y-2">
                <Label htmlFor="upload-template-select" className="text-sm font-medium text-foreground">Șablon Extragere Linii Produse (Aplicat la Upload)</Label>
                 <Select
                    value={uploadTemplateId || aiStandardUploadTemplate.id} 
                    onValueChange={(value) => setUploadTemplateId(value)}
                  >
                  <SelectTrigger id="upload-template-select" className="rounded-md">
                    <SelectValue placeholder="Selectați un șablon de upload" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectGroup>
                      <SelectLabel>Șabloane Disponibile pentru Extragere</SelectLabel>
                      {templates.filter(t => t.forUpload).map(template => ( 
                        <SelectItem key={template.id} value={template.id} title={template.columns.join(', ')}>
                          {template.name} ({template.columns.slice(0,3).join(', ')}{template.columns.length > 3 ? '...' : ''})
                        </SelectItem>
                      ))}
                      {templates.filter(t => t.forUpload).length === 0 && <SelectItem value="no-upload-templates" disabled>Nu sunt șabloane de upload</SelectItem>}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">
                  Ghidează AI-ul ce coloane specifice să caute pentru liniile de produse.
                </p>
              </div>
              <Button variant="outline" className="w-full rounded-md" onClick={() => setIsTemplateManagerOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Gestionează Șabloane de Extragere/Export
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-lg rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><FileSpreadsheet className="mr-2 h-5 w-5 text-primary"/>Opțiuni Export CSV pentru ERPNext</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-export-format-select">Format Export Produse</Label>
                  <Select value={productExportFormat} disabled> {/* Disabled as it's fixed */}
                    <SelectTrigger id="product-export-format-select" className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="line_items">Detaliat (Fiecare produs pe rând nou - Fixat pentru ERPNext)</SelectItem>
                    </SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground">
                    Formatul este fixat pentru compatibilitate optimă cu ERPNext.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-template-select">Șablon Coloane Produse</Label>
                  <Select
                    value={productLineExportTemplateId || ''}
                    disabled /* Disabled as it's fixed */
                  >
                    <SelectTrigger id="export-template-select" className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                       <SelectGroup>
                        <SelectLabel>Șablon pentru Formatare Coloane Produs</SelectLabel>
                        {availableExportTemplates.map(template => ( // Should only show the fixed ERPNext template
                          <SelectItem key={template.id} value={template.id} title={template.columns.join(', ')}>
                            {template.name}
                          </SelectItem>
                        ))}
                        {availableExportTemplates.length === 0 && <SelectItem value="no-fixed-export-tpl" disabled>Șablonul de export ERPNext (Fixed) nu este disponibil.</SelectItem>}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Șablonul este fixat pentru exportul ERPNext.
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
              onClearAllItems={handleClearAllItems}
              isLoading={isProcessingFiles && extractedData.some(d => d.status === 'uploading' || d.status === 'processing')}
              selectedExportColumns={selectedExportColumns} // Still passed for UI display of these two columns
              onSelectedExportColumnsChange={setSelectedExportColumns} // Setter might be less relevant now for product columns
              templates={templates}
              productExportFormat={productExportFormat} // Fixed
              productLineExportTemplateId={productLineExportTemplateId} // Fixed
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
