
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
  name: 'ERPNext Article Default (Export)',
  columns: ['item_code', 'item_name', 'qty', 'uom', 'rate', 'amount', 'item_group', 'stock_uom'], // Standard ERPNext item fields for import
  isDefault: true,
  forUpload: false, // This template is primarily for export
};

const aiStandardUploadTemplate: InvoiceTemplate = {
  id: 'ai-standard-upload-template',
  name: 'AI Standard Extraction (Upload)',
  // These are the fields AI is generally good at finding without specific column name hints.
  // Corresponds to a simplified version of ProductSchema for prompting.
  columns: ['item_code', 'name', 'quantity', 'price', 'amount'], 
  isDefault: true, // Default for upload
  forUpload: true,
};

const comprehensiveUploadTemplate: InvoiceTemplate = {
  id: 'comprehensive-invoice-upload-template',
  name: 'Comprehensive Details (Upload)',
  // These are most fields from ProductSchema. AI will try to find all of them.
  columns: ['item_code', 'name', 'description', 'quantity', 'unit', 'price', 'discount_value', 'discount_percent', 'net_amount', 'tax_percent', 'tax_amount', 'amount'],
  isDefault: false,
  forUpload: true,
};

const comprehensiveExportTemplate: InvoiceTemplate = {
  id: 'comprehensive-invoice-export-template',
  name: 'Comprehensive Details (Export)',
  columns: ['item_code', 'name', 'description', 'quantity', 'unit', 'price', 'discount_value', 'discount_percent', 'net_amount', 'tax_percent', 'tax_amount', 'amount'],
  isDefault: false,
  forUpload: false,
};


export default function Home() {
  const [extractedData, setExtractedData] = useState<ExtractedDataItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
     defaultAppSchema.fields.filter(field => field.key !== 'actions').map(field => field.key as string)
  );
  const { toast } = useToast();

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [uploadTemplateId, setUploadTemplateId] = useState<string | null>(aiStandardUploadTemplate.id); // Default to AI standard
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  
  const [productExportFormat, setProductExportFormat] = useState<ProductExportFormat>('summary');
  const [productLineExportTemplateId, setProductLineExportTemplateId] = useState<string | null>(erpNextDefaultTemplate.id); // Default to ERPNext


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

    // Initialize templates
    const storedTemplates = localStorage.getItem('pdfHarvesterTemplates');
    let initialTemplates: InvoiceTemplate[] = [];
    if (storedTemplates) {
      try {
        initialTemplates = JSON.parse(storedTemplates) as InvoiceTemplate[];
        if (!Array.isArray(initialTemplates)) initialTemplates = [];
      } catch (error) {
        console.error("Failed to parse stored templates:", error);
        initialTemplates = [];
      }
    }
    
    // Ensure default templates are present and correctly configured
    const defaultTpls = [erpNextDefaultTemplate, aiStandardUploadTemplate, comprehensiveUploadTemplate, comprehensiveExportTemplate];
    defaultTpls.forEach(defTpl => {
        const existing = initialTemplates.find(t => t.id === defTpl.id);
        if (existing) { // Update existing with default props if necessary
            existing.isDefault = defTpl.isDefault;
            existing.forUpload = defTpl.forUpload;
            existing.name = defTpl.name; // Ensure name is also updated from default
            existing.columns = defTpl.columns; // Ensure columns are also updated
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
    
    const storedProductExportFormat = localStorage.getItem('pdfHarvesterProductExportFormat');
    if (storedProductExportFormat && (storedProductExportFormat === 'summary' || storedProductExportFormat === 'line_items')) {
        setProductExportFormat(storedProductExportFormat as ProductExportFormat);
    }

    const storedProductLineExportTemplateId = localStorage.getItem('pdfHarvesterProductLineExportTemplateId');
    if (storedProductLineExportTemplateId && initialTemplates.some(t => t.id === storedProductLineExportTemplateId && !t.forUpload)) {
        setProductLineExportTemplateId(storedProductLineExportTemplateId);
    } else {
        const defaultExportTemplate = initialTemplates.find(t => t.id === erpNextDefaultTemplate.id) || initialTemplates.find(t => !t.forUpload && t.isDefault) || initialTemplates.find(t => !t.forUpload);
        setProductLineExportTemplateId(defaultExportTemplate ? defaultExportTemplate.id : null);
    }

  }, []); 

  useEffect(() => {
     localStorage.setItem('pdfHarvesterTemplates', JSON.stringify(templates));
     if (templates.length > 0) {
        const currentUploadTemplateIsValid = uploadTemplateId && templates.some(t => t.id === uploadTemplateId && t.forUpload);
        if (!currentUploadTemplateIsValid) {
            const defaultUploadTpl = templates.find(t => t.id === aiStandardUploadTemplate.id) || templates.find(t => t.forUpload && t.isDefault) || templates.find(t => t.forUpload);
            setUploadTemplateId(defaultUploadTpl ? defaultUploadTpl.id : null);
        }

        const currentExportTemplateIsValid = productLineExportTemplateId && templates.some(t => t.id === productLineExportTemplateId && !t.forUpload);
        if (!currentExportTemplateIsValid) {
            const defaultExportTpl = templates.find(t => t.id === erpNextDefaultTemplate.id) || templates.find(t => !t.forUpload && t.isDefault) || templates.find(t => !t.forUpload);
            setProductLineExportTemplateId(defaultExportTpl ? defaultExportTpl.id : null);
        }
     } else {
        setProductLineExportTemplateId(null);
        setUploadTemplateId(null);
     }
  }, [templates, uploadTemplateId, productLineExportTemplateId]);


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
      localStorage.removeItem('pdfHarvesterUploadTemplateId');
    }
  }, [uploadTemplateId]);

  useEffect(() => {
    localStorage.setItem('pdfHarvesterProductExportFormat', productExportFormat);
  }, [productExportFormat]);

  useEffect(() => {
    if (productLineExportTemplateId) {
      localStorage.setItem('pdfHarvesterProductLineExportTemplateId', productLineExportTemplateId);
    } else {
      localStorage.removeItem('pdfHarvesterProductLineExportTemplateId');
    }
  }, [productLineExportTemplateId]);


  const handleTemplatesChange = (updatedTemplates: InvoiceTemplate[]) => {
    const defaultTpls = [erpNextDefaultTemplate, aiStandardUploadTemplate, comprehensiveUploadTemplate, comprehensiveExportTemplate];
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

    // Re-validate current selections
    const currentUploadTemplate = newTemplates.find(t => t.id === uploadTemplateId && t.forUpload);
    if (!currentUploadTemplate) {
      const fallbackUpload = newTemplates.find(t => t.id === aiStandardUploadTemplate.id) || newTemplates.find(t => t.forUpload && t.isDefault) || newTemplates.find(t => t.forUpload);
      setUploadTemplateId(fallbackUpload ? fallbackUpload.id : null);
    }
    const currentExportTemplate = newTemplates.find(t => t.id === productLineExportTemplateId && !t.forUpload);
    if (!currentExportTemplate) {
      const fallbackExport = newTemplates.find(t => t.id === erpNextDefaultTemplate.id) || newTemplates.find(t => !t.forUpload && t.isDefault) || newTemplates.find(t => !t.forUpload);
      setProductLineExportTemplateId(fallbackExport ? fallbackExport.id : null);
    }
  };

  const handleFileUploads = async (files: File[]) => {
    if (isProcessingFiles) return;
    setIsProcessingFiles(true);

    const currentUploadTemplate = uploadTemplateId ? templates.find(t => t.id === uploadTemplateId && t.forUpload) : templates.find(t => t.id === aiStandardUploadTemplate.id);

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
          lineItemColumns: currentUploadTemplate?.id !== aiStandardUploadTemplate.id ? currentUploadTemplate?.columns : undefined
        };
        let aiOutput: ExtractInvoiceOutput | null = await extractInvoiceData(aiInput);
        let productsExtractedBy = 'ai';

        const aiProducts = aiOutput?.products || [];
        const productsAreUnsatisfactory = aiProducts.length === 0 || 
                                         aiProducts.every(p => !p.name && !p.quantity && !p.item_code && !p.price && !p.amount);

        if (aiOutput && productsAreUnsatisfactory) {
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


  const handleExportCsv = useCallback(() => {
    const relevantData = extractedData.filter(item => item.status === 'processed' || item.status === 'needs_validation');
    if (relevantData.length === 0) {
      toast({ title: "Nicio dată de exportat", description: "Nu există fișiere procesate sau care necesită validare.", variant: "warning" });
      return;
    }

    let csvHeaders: string[] = [];
    let csvRows: string[][] = [];
    
    const keyMap: Record<string, keyof Product | string> = {
        'artikelnummer': 'item_code', 'item_code': 'item_code', 'item code': 'item_code', 'sku': 'item_code', 'cod articol': 'item_code', 'part no.': 'item_code',
        'artikelbezeichnung': 'name', 'item_name': 'name', 'item name': 'name', 'description': 'name', 'denumire': 'name', 'bezeichnung': 'name', 'product name': 'name', 'descriere': 'name', 'nume produs': 'name',
        'menge': 'quantity', 'qty': 'quantity', 'anzahl': 'quantity', 'cantitate': 'quantity',
        'einheit': 'unit', 'uom': 'unit', 'unit_of_measure': 'unit', 'unitate masura': 'unit', 'um': 'unit',
        'einzelpreis': 'price', 'rate': 'price', 'unit price': 'price', 'pret unitar': 'price', 'unit_price': 'price', 'preis': 'price', 'unit_price_net': 'price', 'net unit price': 'price',
        'rabatt_wert': 'discount_value', 'discount_value': 'discount_value', 'discount amount': 'discount_value', 'valoare reducere': 'discount_value', 'line discount': 'discount_value',
        'rabatt_prozent': 'discount_percent', 'discount_percent': 'discount_percent', 'discount rate': 'discount_percent', 'procent reducere': 'discount_percent',
        'netto_betrag_linie': 'net_amount', 'net_amount': 'net_amount', 'line net amount': 'net_amount', 'valoare neta': 'net_amount', 'net total line': 'net_amount',
        'mwst_prozent': 'tax_percent', 'tax_percent': 'tax_percent', 'vat_percentage': 'tax_percent', 'tax_rate': 'tax_percent', 'cota_tva': 'tax_percent', 'tax rate percent': 'tax_percent', 'ust-satz': 'tax_percent',
        'steuer_betrag': 'tax_amount', 'tax_amount': 'tax_amount', 'vat_amount': 'tax_amount', 'valoare_tva': 'tax_amount', 'tax total line': 'tax_amount', 'mwst-betrag': 'tax_amount',
        'gesamtpreis': 'amount', 'amount': 'amount', 'brutto_betrag': 'amount', 'gross_amount': 'amount', 'line total': 'amount', 'valoare totala': 'amount', 'line_total_gross_amount': 'amount', 'gross_total': 'amount', 'total linie': 'amount',
        'item_group': 'item_group', 
        'stock_uom': 'stock_uom', 
    };


    if (productExportFormat === 'line_items') {
        if (!productLineExportTemplateId) {
            toast({ title: "Selectați Șablon Export Produse", description: "Pentru exportul detaliat pe linii de produse, selectați un șablon de coloane pentru produse.", variant: "warning" });
            return;
        }
        const exportTemplate = templates.find(t => t.id === productLineExportTemplateId && !t.forUpload);
        if (!exportTemplate) {
            toast({ title: "Șablon Export Produse Invalid", description: "Șablonul selectat pentru exportul liniilor de produse nu a fost găsit.", variant: "warning" });
            return;
        }

        const parentSchemaFields = MOCK_SCHEMA.fields.filter(field => selectedExportColumns.includes(field.key as string) && field.key !== 'products');
        const parentHeaders = parentSchemaFields.map(field => field.label); 
        const productSpecificHeaders = exportTemplate.columns.map(col => col); 
        csvHeaders = [...parentHeaders, ...productSpecificHeaders];
        
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

                if ((schemaField.type === 'number' || ['totalPrice', 'subtotal', 'totalDiscountAmount', 'totalTaxAmount'].includes(schemaField.key)) && typeof value === 'number') {
                    return String(value.toFixed(2)).replace('.', ','); 
                }
                if (value === undefined || value === null) return '';
                return String(value).replace(/"/g, '""');
            });

            if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                item.extractedValues.products.forEach(product => {
                    const productRowPart = exportTemplate.columns.map(templateColKey => {
                        let val: any;
                        const lowerTemplateColKey = templateColKey.toLowerCase();
                        
                        if (lowerTemplateColKey === 'item_group') {
                            val = "Produkt"; 
                        } else if (lowerTemplateColKey === 'stock_uom') {
                            val = product.unit || "Stk"; 
                        } else {
                           const mappedKey = keyMap[lowerTemplateColKey] || templateColKey;
                           val = product[mappedKey as keyof Product];
                        }
                        
                        const isGrossAmountCol = ['gesamtpreis', 'amount', 'brutto_betrag', 'gross_amount', 'line total', 'valoare totala', 'line_total_gross_amount', 'gross_total', 'total linie'].includes(lowerTemplateColKey);
                        if (isGrossAmountCol && (val === undefined || val === null)) {
                           // Calculation logic remains, adapt if needed
                            const qty = typeof product.quantity === 'number' ? product.quantity : parseFloat(String(product.quantity).replace(',','.'));
                            const unitPrice = typeof product.price === 'number' ? product.price : parseFloat(String(product.price).replace(',','.'));
                            const net = typeof product.net_amount === 'number' ? product.net_amount : parseFloat(String(product.net_amount).replace(',','.'));
                            const taxAmt = typeof product.tax_amount === 'number' ? product.tax_amount : parseFloat(String(product.tax_amount).replace(',','.'));
                            const discountVal = (typeof product.discount_value === 'number' ? product.discount_value : parseFloat(String(product.discount_value).replace(',','.'))) || 0;
                            const taxPercent = (typeof product.tax_percent === 'number' ? product.tax_percent : parseFloat(String(product.tax_percent).replace(',','.'))) || 0;

                            if (!isNaN(net) && !isNaN(taxAmt)) val = net + taxAmt;
                            else if (!isNaN(qty) && !isNaN(unitPrice)) {
                                let calculatedNet = (qty * unitPrice) - discountVal;
                                if (!isNaN(taxPercent) && taxPercent > 0) val = calculatedNet * (1 + (taxPercent / 100));
                                else val = calculatedNet;
                            }
                        }
                        
                        if (val === undefined || val === null) return '';
                        
                        const numericCols = ['price', 'preis', 'rate', 'amount', 'betrag', 'total', 'discount_value', 'tax_amount', 'net_amount', 'gross_amount', 'unit_price', 'net_total', 'tax_total', 'gross_total'];
                        const percentageCols = ['tax_percent', 'discount_percent', 'tax_rate', 'vat_percentage', 'ust-satz'];
                        const quantityCols = ['quantity', 'qty', 'menge', 'anzahl', 'cantitate'];

                        if (typeof val === 'number') {
                            if (quantityCols.some(qc => lowerTemplateColKey.includes(qc))) return String(val).replace('.', ',');
                            if (numericCols.some(nc => lowerTemplateColKey.includes(nc))) return String(val.toFixed(2)).replace('.', ',');
                            if (percentageCols.some(pc => lowerTemplateColKey.includes(pc))) return String(val).replace('.', ',');
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
        
        if (parentSchemaFields.length === 0 && productSpecificHeaders.length > 0 && relevantData.some(item => item.extractedValues.products && item.extractedValues.products.length > 0)) {
             relevantData.forEach(item => {
                if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                    item.extractedValues.products.forEach(product => {
                        const productRowPart = exportTemplate.columns.map(templateColKey => {
                            let val: any;
                            const lowerTemplateColKey = templateColKey.toLowerCase();
                            if (lowerTemplateColKey === 'item_group') val = "Produkt";
                            else if (lowerTemplateColKey === 'stock_uom') val = product.unit || "Stk";
                            else {
                                const mappedKey = keyMap[lowerTemplateColKey] || templateColKey;
                                val = product[mappedKey as keyof Product];
                            }
                            // Gross amount calculation same as above
                            const isGrossAmountCol = ['gesamtpreis', 'amount', 'brutto_betrag', 'gross_amount', 'line total', 'valoare totala', 'line_total_gross_amount', 'gross_total', 'total linie'].includes(lowerTemplateColKey);
                            if (isGrossAmountCol && (val === undefined || val === null)) {
                                const qty = typeof product.quantity === 'number' ? product.quantity : parseFloat(String(product.quantity).replace(',','.'));
                                const unitPrice = typeof product.price === 'number' ? product.price : parseFloat(String(product.price).replace(',','.'));
                                const net = typeof product.net_amount === 'number' ? product.net_amount : parseFloat(String(product.net_amount).replace(',','.'));
                                const taxAmt = typeof product.tax_amount === 'number' ? product.tax_amount : parseFloat(String(product.tax_amount).replace(',','.'));
                                const discountVal = (typeof product.discount_value === 'number' ? product.discount_value : parseFloat(String(product.discount_value).replace(',','.'))) || 0;
                                const taxPercent = (typeof product.tax_percent === 'number' ? product.tax_percent : parseFloat(String(product.tax_percent).replace(',','.'))) || 0;

                                if (!isNaN(net) && !isNaN(taxAmt)) val = net + taxAmt;
                                else if (!isNaN(qty) && !isNaN(unitPrice)) {
                                    let calculatedNet = (qty * unitPrice) - discountVal;
                                    if (!isNaN(taxPercent) && taxPercent > 0) val = calculatedNet * (1 + (taxPercent / 100));
                                    else val = calculatedNet;
                                }
                            }
                            if (val === undefined || val === null) return '';
                            // Formatting logic same as above
                            const numericCols = ['price', 'preis', 'rate', 'amount', 'betrag', 'total', 'discount_value', 'tax_amount', 'net_amount', 'gross_amount', 'unit_price', 'net_total', 'tax_total', 'gross_total'];
                            const percentageCols = ['tax_percent', 'discount_percent', 'tax_rate', 'vat_percentage', 'ust-satz'];
                            const quantityCols = ['quantity', 'qty', 'menge', 'anzahl', 'cantitate'];

                            if (typeof val === 'number') {
                                if (quantityCols.some(qc => lowerTemplateColKey.includes(qc))) return String(val).replace('.', ',');
                                if (numericCols.some(nc => lowerTemplateColKey.includes(nc))) return String(val.toFixed(2)).replace('.', ',');
                                if (percentageCols.some(pc => lowerTemplateColKey.includes(pc))) return String(val).replace('.', ',');
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
        csvHeaders = exportableSchemaFields.map(field => field.label); 
        
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
                    const activeUploadTemplateId = item.activeTemplateId || aiStandardUploadTemplate.id;
                    const summaryTemplate = templates.find(t=> t.id === activeUploadTemplateId && t.forUpload) || templates.find(t => t.id === aiStandardUploadTemplate.id);
                  
                    return value.map((p: Product) => { 
                        let summaryParts: string[] = [];
                        const displayColumns = summaryTemplate?.columns || ['item_code', 'name', 'quantity', 'price', 'amount'];
                        
                        summaryParts = displayColumns.map(colKey => {
                            const mappedKey = keyMap[colKey.toLowerCase()] || colKey; 
                            let productValue = p[mappedKey as keyof Product];

                            if (productValue === undefined || productValue === null) return `${colKey}: N/A`;
                            
                            const numericCols = ['price', 'amount', 'discount_value', 'tax_amount', 'net_amount', 'gross_amount', 'unit_price', 'net_total', 'tax_total', 'gross_total'];
                            const percentageCols = ['tax_percent', 'discount_percent'];
                            const quantityCols = ['quantity', 'qty', 'menge', 'anzahl', 'cantitate'];

                            if (typeof productValue === 'number') {
                                if (quantityCols.some(qc => colKey.toLowerCase().includes(qc))) return `${colKey}: ${String(productValue).replace('.', ',')}`;
                                if (numericCols.some(nc => colKey.toLowerCase().includes(nc))) return `${colKey}: ${String(productValue.toFixed(2)).replace('.', ',')}`;
                                if (percentageCols.some(pc => colKey.toLowerCase().includes(pc))) return `${colKey}: ${String(productValue).replace('.', ',')}`;
                            }
                            return `${colKey}: ${String(productValue).replace(/"/g, '""')}`;
                        });
                        return `(${summaryParts.join(' | ')})`;
                    }).join('; '); 
                }
                if ((schemaField.type === 'number' || ['totalPrice', 'subtotal', 'totalDiscountAmount', 'totalTaxAmount'].includes(schemaField.key)) && typeof value === 'number') {
                    return String(value.toFixed(2)).replace('.', ',');
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

    let csvContent = "\uFEFF"; 
    csvContent += csvHeaders.map(header => `"${String(header).replace(/"/g, '""')}"`).join(";") + "\n"; 
    csvRows.forEach(rowArray => {
      let row = rowArray.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"); 
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
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.columns.join(', ')})
                        </SelectItem>
                      ))}
                      {templates.filter(t => t.forUpload).length === 0 && <SelectItem value="no-upload-templates" disabled>Nu sunt șabloane de upload</SelectItem>}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">
                  Ghidează AI-ul ce coloane specifice să caute pentru liniile de produse. Șablonul "{comprehensiveUploadTemplate.name}" încearcă să găsească mai multe detalii.
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
                        {!templates.some(t => !t.forUpload) && <SelectItem value="none" disabled>Nu sunt șabloane de export definite</SelectItem>}
                        {templates.filter(t => !t.forUpload).map(template => (
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
              onClearAllItems={handleClearAllItems}
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
