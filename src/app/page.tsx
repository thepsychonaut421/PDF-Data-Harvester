
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

const erpNextDefaultTemplate: InvoiceTemplate = {
  id: 'erpnext-article-default',
  name: 'ERPNext Article Default',
  columns: ['item_code', 'item_name', 'qty', 'rate', 'amount'], // Standard ERPNext item fields
  isDefault: true,
};

const comprehensiveTemplate: InvoiceTemplate = {
  id: 'comprehensive-invoice-details-template',
  name: 'Comprehensive Line Item Details (Upload & Export)',
  columns: ['item_code', 'description', 'quantity', 'unit', 'unit_price', 'discount_value', 'tax_percent', 'net_amount', 'tax_amount', 'gross_amount'],
  isDefault: false,
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
    let initialTemplates: InvoiceTemplate[] = [];
    if (storedTemplates) {
      try {
        initialTemplates = JSON.parse(storedTemplates) as InvoiceTemplate[];
        if (!Array.isArray(initialTemplates)) {
          initialTemplates = [];
        }
      } catch (error) {
        console.error("Failed to parse stored templates:", error);
        initialTemplates = [];
      }
    }
    
    // Ensure default templates are present
    const erpNextTemplateExists = initialTemplates.some(t => t.id === erpNextDefaultTemplate.id);
    if (!erpNextTemplateExists) {
      initialTemplates.unshift(erpNextDefaultTemplate); // Add to beginning
    }

    const comprehensiveTemplateExists = initialTemplates.some(t => t.id === comprehensiveTemplate.id);
    if (!comprehensiveTemplateExists) {
      initialTemplates.push(comprehensiveTemplate); // Add to end
    }
    setTemplates(initialTemplates);


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
    } else {
        const defaultExportTemplate = initialTemplates.find(t => t.id === erpNextDefaultTemplate.id) || initialTemplates.find(t => t.id === comprehensiveTemplate.id) || (initialTemplates.length > 0 ? initialTemplates[0] : null);
        if (defaultExportTemplate) {
            setProductLineExportTemplateId(defaultExportTemplate.id);
        }
    }

  }, []); 

  useEffect(() => {
     localStorage.setItem('pdfHarvesterTemplates', JSON.stringify(templates));
     if (templates.length > 0) {
        const currentExportTemplateExists = templates.some(t => t.id === productLineExportTemplateId);
        if (!currentExportTemplateExists || !productLineExportTemplateId) {
            const defaultExportTemplate = templates.find(t => t.id === erpNextDefaultTemplate.id) || templates.find(t => t.id === comprehensiveTemplate.id) || templates[0];
            setProductLineExportTemplateId(defaultExportTemplate.id);
        }
     } else {
        setProductLineExportTemplateId(null);
     }
  }, [templates, productLineExportTemplateId]); // Added productLineExportTemplateId to ensure it reacts to its changes


  useEffect(() => {
    localStorage.setItem('pdfHarvesterData', JSON.stringify(extractedData));
  }, [extractedData]);

  useEffect(() => {
    localStorage.setItem('pdfHarvesterSelectedColumns', JSON.stringify(selectedExportColumns));
  }, [selectedExportColumns]);
  
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
    // Ensure default templates are not removed or their `isDefault` status is not lost
    const erpNextTpl = updatedTemplates.find(t => t.id === erpNextDefaultTemplate.id);
    if (erpNextTpl) {
        erpNextTpl.isDefault = true; // Enforce
    } else {
        // If somehow deleted, add it back
        updatedTemplates.unshift({...erpNextDefaultTemplate, isDefault: true});
    }
    
    // Ensure comprehensive template is not accidentally removed (unless user explicitly deletes non-default one via UI)
    // The UI prevents deletion of isDefault templates, so ERPNext is safe.
    // This logic here is more about programmatic changes.
    // If this function is ONLY called from TemplateManagerDialog, this check might be redundant
    // as the dialog handles its own logic for adding/removing.
    const compTpl = updatedTemplates.find(t => t.id === comprehensiveTemplate.id);
    if (!compTpl && !comprehensiveTemplate.isDefault) { // Add it back if it's our non-default comprehensive one and it's gone
        updatedTemplates.push({...comprehensiveTemplate});
    }


    setTemplates(updatedTemplates);
    if (uploadTemplateId && !updatedTemplates.find(t => t.id === uploadTemplateId)) {
      setUploadTemplateId(null); 
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
      description: `${files.length} fișier(e) trimise ${currentUploadTemplate ? `folosind șablonul de extragere "${currentUploadTemplate.name}"` : 'cu extragere AI standard'}.`,
    });

    for (const item of newUploadItems) {
      try {
        setExtractedData(prev => prev.map(d => d.id === item.id ? {...d, status: 'processing' as PdfStatus } : d));
        
        const pdfDataUri = await fileToDataUri(item.fileObject);
        const aiInput: ExtractInvoiceInput = { 
          pdfDataUri,
          lineItemColumns: currentUploadTemplate?.columns 
        };
        let aiOutput: ExtractInvoiceOutput | null = await extractInvoiceData(aiInput);
        let productsExtractedBy = 'ai';

        const aiProducts = aiOutput?.products || [];
        const productsAreUnsatisfactory = aiProducts.length === 0 || 
                                         aiProducts.every(p => !p.name && !p.quantity && !p.item_code);

        if (aiOutput && productsAreUnsatisfactory) {
          toast({
            title: "Extragere AI produse eșuată/incompletă",
            description: `Se încearcă fallback OCR SIMULAT pentru ${item.fileName}.`,
            variant: "info",
          });
          const fallbackProducts = await runOcrFallbackExtraction(pdfDataUri);
          if (fallbackProducts && fallbackProducts.length > 0) {
            if (aiOutput) { 
                aiOutput.products = fallbackProducts;
                productsExtractedBy = 'ocr_fallback (simulated)';
            } else {
                // This case should be rare if productsAreUnsatisfactory implies aiOutput exists
                aiOutput = { 
                    products: fallbackProducts,
                    date: null,
                    supplier: null,
                    totalPrice: null,
                    currency: null,
                    documentLanguage: null,
                };
                productsExtractedBy = 'ocr_fallback (simulated) - AI output was null';
            }
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
            activeTemplateId: currentUploadTemplate?.id || null,
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
            activeTemplateId: currentUploadTemplate?.id || null,
        };
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
        const parentHeaders = parentSchemaFields.map(field => field.key as string);
        const productSpecificHeaders = exportTemplate.columns; 
        csvHeaders = [...parentHeaders, ...productSpecificHeaders];
        
        const keyMap: Record<string, keyof Product | string> = {
            'artikelnummer': 'item_code', 'item_code': 'item_code', 'item code': 'item_code', 'sku': 'item_code',
            'artikelbezeichnung': 'name', 'item_name': 'name', 'item name': 'name', 'description': 'name', 'denumire': 'name', 'bezeichnung': 'name', 'product name': 'name',
            'menge': 'quantity', 'qty': 'quantity', 'anzahl': 'quantity', 'cantitate': 'quantity',
            'einzelpreis': 'price', 'rate': 'price', 'unit price': 'price', 'pret unitar': 'price', 'unit_price': 'price', 'preis': 'price', 'unit_price_net': 'price',
            'gesamtpreis': 'amount', /* 'amount' (AI output) is line total */ 'total': 'amount', 'betrag': 'amount', 'line total': 'amount', 'gross_amount': 'amount', 'valoare totala': 'amount', 'line_total_gross_amount': 'amount', 'brutto_betrag': 'amount', 'gross_total': 'amount',

            'unit_of_measure': 'unit', 'unitate masura': 'unit', 'einheit': 'unit',
            'discount_percentage': 'discount_percent', 'rabatt_prozent': 'discount_percent', 'discount': 'discount_value', // 'discount' can be ambiguous, map to value if template asks for value
            'discount_amount': 'discount_value', 'rabatt_wert': 'discount_value', 'discount_value': 'discount_value',
            'line_net_amount': 'net_amount', 'netto_betrag_linie': 'net_amount', 'net_total': 'net_amount',
            'vat_percentage': 'tax_percent', 'tax_rate': 'tax_percent', 'mwst_prozent': 'tax_percent', 'cota_tva': 'tax_percent', 'tax_rate_percent': 'tax_percent',
            'vat_amount': 'tax_amount', 'steuer_betrag': 'tax_amount', 'valoare_tva': 'tax_amount', 'tax_total': 'tax_amount',
        };


        relevantData.forEach(item => {
            const parentRowPart = parentSchemaFields.map(schemaField => {
                let value: any;
                if (schemaField.key === 'fileName') value = item.fileName;
                else if (schemaField.key === 'status') value = item.status;
                else if (schemaField.key === 'activeTemplateName') {
                    const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                    value = template ? template.name : 'AI Standard Ext.';
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
                    const productRowPart = exportTemplate.columns.map(templateColKey => {
                        let val = product[templateColKey]; 
                        if (val === undefined || val === null) {
                            const mappedKey = keyMap[templateColKey.toLowerCase()];
                            if (mappedKey) val = product[mappedKey as keyof Product];
                        }
                         // Calculation for gross_amount if not present (simple qty*price)
                        if ((templateColKey.toLowerCase() === 'gross_amount' || templateColKey.toLowerCase() === 'gesamtpreis' || templateColKey.toLowerCase() === 'amount' || templateColKey.toLowerCase() === 'gross_total') && (val === undefined || val === null)) {
                            if (product.quantity !== undefined && product.price !== undefined && product.quantity !== null && product.price !== null) {
                               const q = Number(String(product.quantity).replace(',','.'));
                               const p = Number(String(product.price).replace(',','.'));
                               if (!isNaN(q) && !isNaN(p)) val = (q * p); 
                            }
                        }
                        
                        if (val === undefined || val === null) return '';
                        // For numeric columns (price, amount, totals, discount_value, tax_amount) format with currency
                        const numericCols = ['price', 'preis', 'rate', 'amount', 'betrag', 'total', 'discount_value', 'tax_amount', 'net_amount', 'gross_amount', 'unit_price', 'net_total', 'tax_total', 'gross_total'];
                        if (typeof val === 'number' && numericCols.some(nc => templateColKey.toLowerCase().includes(nc))) {
                             return `${val.toFixed(2)} ${item.extractedValues.currency || ''}`.trim();
                        }
                        // For percentage columns, just return the number (AI should provide it as number if it's a rate)
                        const percentageCols = ['tax_percent', 'discount_percent', 'tax_rate', 'vat_percentage'];
                         if (typeof val === 'number' && percentageCols.some(pc => templateColKey.toLowerCase().includes(pc))) {
                            return String(val); // Or val.toFixed(2) + '%' if desired
                        }
                        return String(val).replace(/"/g, '""');
                    });
                    csvRows.push([...parentRowPart, ...productRowPart]);
                });
            } else if (parentSchemaFields.length > 0) { 
                const emptyProductPart = exportTemplate.columns.map(() => '');
                csvRows.push([...parentRowPart, ...emptyProductPart]);
            }
        });
        
        if (parentSchemaFields.length === 0 && productSpecificHeaders.length > 0 && csvRows.length === 0 && relevantData.some(item => item.extractedValues.products && item.extractedValues.products.length > 0)) {
             relevantData.forEach(item => {
                if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                    item.extractedValues.products.forEach(product => {
                        const productRowPart = exportTemplate.columns.map(templateColKey => {
                            let val = product[templateColKey];
                             if (val === undefined || val === null) {
                                const mappedKey = keyMap[templateColKey.toLowerCase()];
                                if (mappedKey) val = product[mappedKey as keyof Product];
                            }
                            if ((templateColKey.toLowerCase() === 'gross_amount' || templateColKey.toLowerCase() === 'gesamtpreis' || templateColKey.toLowerCase() === 'amount' || templateColKey.toLowerCase() === 'gross_total') && (val === undefined || val === null)) {
                               if (product.quantity !== undefined && product.price !== undefined && product.quantity !== null && product.price !== null) {
                                   const q = Number(String(product.quantity).replace(',','.'));
                                   const p = Number(String(product.price).replace(',','.'));
                                   if (!isNaN(q) && !isNaN(p)) val = (q * p);
                                }
                            }
                            if (val === undefined || val === null) return '';
                            const numericCols = ['price', 'preis', 'rate', 'amount', 'betrag', 'total', 'discount_value', 'tax_amount', 'net_amount', 'gross_amount', 'unit_price', 'net_total', 'tax_total', 'gross_total'];
                            if (typeof val === 'number' && numericCols.some(nc => templateColKey.toLowerCase().includes(nc))) {
                                return `${val.toFixed(2)} ${item.extractedValues.currency || ''}`.trim();
                            }
                            const percentageCols = ['tax_percent', 'discount_percent', 'tax_rate', 'vat_percentage'];
                            if (typeof val === 'number' && percentageCols.some(pc => templateColKey.toLowerCase().includes(pc))) {
                                return String(val);
                            }
                            return String(val).replace(/"/g, '""');
                        });
                        csvRows.push([...productRowPart]);
                    });
                }
            });
            csvHeaders = [...productSpecificHeaders];
        }


    } else { // productExportFormat === 'summary'
        if (selectedExportColumns.length === 0) {
          toast({ title: "Nicio coloană selectată", description: "Vă rugăm selectați cel puțin o coloană pentru a exporta.", variant: "warning" });
          return;
        }
        const exportableSchemaFields = MOCK_SCHEMA.fields.filter(field => selectedExportColumns.includes(field.key as string));
        csvHeaders = exportableSchemaFields.map(field => field.key as string);
        
        csvRows = relevantData.map(item => {
            return exportableSchemaFields.map(schemaField => {
                let value: any;
                if (schemaField.key === 'fileName') value = item.fileName;
                else if (schemaField.key === 'status') value = item.status;
                else if (schemaField.key === 'activeTemplateName') {
                    const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                    value = template ? template.name : 'AI Standard Ext.';
                }
                else value = item.extractedValues[schemaField.key as keyof typeof item.extractedValues];

                if (schemaField.key === 'products' && Array.isArray(value)) {
                    const currency = item.extractedValues.currency || '';
                    // For summary, use the template that was active during upload for hinting product fields
                    const currentItemUploadTemplate = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                  
                    return value.map((p: Product) => { 
                        let summaryParts: string[] = [];
                        // Use a small, fixed set of common fields for summary to keep it concise, or rely on upload template.
                        // For simplicity, let's stick to the original summary logic or enhance it slightly
                        const displayColumns = currentItemUploadTemplate?.columns || ['item_code', 'name', 'quantity', 'price', 'amount'];
                        
                        summaryParts = displayColumns.map(colKey => {
                             const keyMapForSummary: Record<string, keyof Product | string> = {
                                'item_code': 'item_code', 'artikelnummer': 'item_code',
                                'name': 'name', 'description': 'name', 'artikelbezeichnung': 'name', 'item_name': 'name',
                                'quantity': 'quantity', 'menge': 'quantity', 'qty': 'quantity',
                                'price': 'price', 'unit_price': 'price', 'einzelpreis': 'price', 'rate': 'price',
                                'amount': 'amount', 'gross_amount': 'amount', 'gesamtpreis': 'amount', 'total': 'amount', 'line_total_gross_amount': 'amount', 'gross_total':'amount',
                                // Add other relevant comprehensive fields if needed for summary
                                'unit': 'unit',
                                'discount_value': 'discount_value',
                                'tax_percent': 'tax_percent',
                            };
                            let productValue = p[colKey];
                            if (productValue === undefined || productValue === null) {
                                const mappedKey = keyMapForSummary[colKey.toLowerCase()];
                                if (mappedKey) productValue = p[mappedKey as keyof Product];
                            }

                            if (productValue === undefined || productValue === null) return `${colKey}: N/A`;
                            
                            const numericCols = ['price', 'amount', 'discount_value', 'tax_amount', 'net_amount', 'gross_amount', 'unit_price', 'net_total', 'tax_total', 'gross_total'];
                            if (typeof productValue === 'number' && numericCols.some(nc => colKey.toLowerCase().includes(nc))) {
                                return `${colKey}: ${productValue.toFixed(2)} ${currency}`.trim();
                            }
                            const percentageCols = ['tax_percent', 'discount_percent'];
                            if (typeof productValue === 'number' && percentageCols.some(pc => colKey.toLowerCase().includes(pc))) {
                                return `${colKey}: ${productValue}`;
                            }
                            return `${colKey}: ${String(productValue).replace(/"/g, '""')}`;
                        });
                        return summaryParts.join(' | ');
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

    let csvContent = "\uFEFF"; // BOM for UTF-8
    csvContent += csvHeaders.map(header => `"${String(header).replace(/"/g, '""')}"`).join(",") + "\n"; 
    csvRows.forEach(rowArray => {
      let row = rowArray.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","); 
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "date_extrase_pdf.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);


    toast({
      title: "Export CSV finalizat",
      description: "Datele au fost exportate cu succes.",
      variant: "success"
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
              <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Încărcare & Șabloane Extragere</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PdfUploader onUploadFiles={handleFileUploads} isProcessing={isProcessingFiles} />
              
              <div className="space-y-2">
                <Label htmlFor="upload-template-select" className="text-sm font-medium text-foreground">Șablon Extragere Linii Produse (Aplicat la Upload)</Label>
                 <Select
                    value={uploadTemplateId || "none"} 
                    onValueChange={(value) => setUploadTemplateId(value === 'none' ? null : value)}
                  >
                  <SelectTrigger id="upload-template-select" className="rounded-md">
                    <SelectValue placeholder="Extragere AI standard" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <SelectGroup>
                      <SelectLabel>Șabloane Disponibile pentru Extragere</SelectLabel>
                      <SelectItem value="none">Extragere AI Standard (item_code, name, quantity, price, amount)</SelectItem>
                      {templates.filter(t => !t.isDefault).map(template => ( 
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.columns.join(', ')})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">
                  Ghidează AI-ul ce coloane specifice să caute pentru liniile de produse. Șablonul "Comprehensive" încearcă să găsească mai multe detalii.
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
                <CardTitle className="text-lg flex items-center"><FileSpreadsheet className="mr-2 h-5 w-5 text-primary"/>Opțiuni Export CSV</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-export-format-select">Format Export Produse</Label>
                  <Select value={productExportFormat} onValueChange={(value) => setProductExportFormat(value as ProductExportFormat)}>
                    <SelectTrigger id="product-export-format-select" className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="summary">Sumar (Toate produsele într-o singură celulă per factură)</SelectItem>
                      <SelectItem value="line_items">Detaliat (Fiecare produs pe rând nou, coloane mapate conform șablonului de export)</SelectItem>
                    </SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground">
                    Alegeți cum să fie formatate liniile de produse în CSV.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-template-select">Șablon Coloane Produse (pentru Export Detaliat)</Label>
                  <Select
                    value={productLineExportTemplateId || "none"}
                    onValueChange={(value) => setProductLineExportTemplateId(value === "none" ? null : value)}
                    disabled={productExportFormat !== 'line_items'}
                  >
                    <SelectTrigger id="export-template-select" className="rounded-md">
                      <SelectValue placeholder="Selectați un șablon de export" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                       <SelectGroup>
                        <SelectLabel>Șabloane pentru Coloane Produs la Export</SelectLabel>
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
                    Activ doar pentru formatul "Detaliat". Definește coloanele și ordinea lor pentru fiecare linie de produs în CSV-ul exportat.
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

