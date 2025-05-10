
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
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
     MOCK_SCHEMA.fields.filter(field => field.key !== 'actions').map(field => field.key as string)
  );
  const { toast } = useToast();

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [uploadTemplateId, setUploadTemplateId] = useState<string | null>(aiStandardUploadTemplate.id); 
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  
  const [productExportFormat, setProductExportFormat] = useState<ProductExportFormat>('line_items'); // Default to 'line_items'
  const [productLineExportTemplateId, setProductLineExportTemplateId] = useState<string | null>(erpNextDefaultTemplate.id); // Default to ERPNext

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
    const storedSelectedColumns = localStorage.getItem('pdfHarvesterSelectedColumns');
    if (storedSelectedColumns) {
        try {
            const parsedColumns = JSON.parse(storedSelectedColumns);
            if (Array.isArray(parsedColumns) && parsedColumns.every(col => typeof col === 'string')) {
                const validKeys = new Set(MOCK_SCHEMA.fields.map(f => f.key));
                setSelectedExportColumns(parsedColumns.filter(col => validKeys.has(col as SchemaField['key'])));
            } else { 
                 setSelectedExportColumns(MOCK_SCHEMA.fields.filter(field => field.key !== 'actions').map(field => field.key as string));
            }
        } catch (error) {
            setSelectedExportColumns(MOCK_SCHEMA.fields.filter(field => field.key !== 'actions').map(field => field.key as string));
        }
    } else { 
        setSelectedExportColumns(MOCK_SCHEMA.fields.filter(field => field.key !== 'actions').map(field => field.key as string));
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
    
    const storedProductExportFormat = localStorage.getItem('pdfHarvesterProductExportFormat') as ProductExportFormat | null;
    setProductExportFormat(storedProductExportFormat === 'summary' || storedProductExportFormat === 'line_items' ? storedProductExportFormat : 'line_items');


    const storedProductLineExportTemplateId = localStorage.getItem('pdfHarvesterProductLineExportTemplateId');
    const erpNextTemplateIsAvailable = initialTemplates.some(t => t.id === erpNextDefaultTemplate.id && !t.forUpload);

    if (productExportFormat === 'line_items') {
        if (storedProductLineExportTemplateId && initialTemplates.some(t => t.id === storedProductLineExportTemplateId && !t.forUpload && (t.id === erpNextDefaultTemplate.id || t.id === erpNextExportFixedV1Template.id ))) {
             setProductLineExportTemplateId(storedProductLineExportTemplateId);
        } else if (erpNextTemplateIsAvailable) {
             setProductLineExportTemplateId(erpNextDefaultTemplate.id);
        } else {
            const fallbackExport = initialTemplates.find(t => t.id === erpNextExportFixedV1Template.id) || initialTemplates.find(t => !t.forUpload && t.isDefault) || initialTemplates.find(t => !t.forUpload);
            setProductLineExportTemplateId(fallbackExport ? fallbackExport.id : null);
        }
    } else { // summary or other future formats
        if (storedProductLineExportTemplateId && initialTemplates.some(t => t.id === storedProductLineExportTemplateId && !t.forUpload)) {
            setProductLineExportTemplateId(storedProductLineExportTemplateId);
        } else {
             const fallbackExport = initialTemplates.find(t => !t.forUpload && t.isDefault) || initialTemplates.find(t => !t.forUpload);
            setProductLineExportTemplateId(fallbackExport ? fallbackExport.id : null);
        }
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
            const defaultExportTpl = templates.find(t => t.id === erpNextDefaultTemplate.id) || templates.find(t => t.id === erpNextExportFixedV1Template.id) || templates.find(t => !t.forUpload && t.isDefault) || templates.find(t => !t.forUpload);
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
     if (productExportFormat === 'line_items' && (!productLineExportTemplateId || !templates.find(t => t.id === productLineExportTemplateId && (t.id === erpNextDefaultTemplate.id || t.id === erpNextExportFixedV1Template.id) ) ) ) {
        const erpTemplate = templates.find(t => t.id === erpNextDefaultTemplate.id);
        if (erpTemplate) {
            setProductLineExportTemplateId(erpTemplate.id);
        } else {
             const fallbackErp = templates.find(t => t.id === erpNextExportFixedV1Template.id);
             if (fallbackErp) setProductLineExportTemplateId(fallbackErp.id);
        }
    }
  }, [productExportFormat, templates, productLineExportTemplateId]);

  useEffect(() => {
    if (productLineExportTemplateId) {
      localStorage.setItem('pdfHarvesterProductLineExportTemplateId', productLineExportTemplateId);
    } else {
      localStorage.removeItem('pdfHarvesterProductLineExportTemplateId');
    }
  }, [productLineExportTemplateId]);

  // Effect to auto-select columns when ERPNext Default Export template is chosen for detailed line item export
  useEffect(() => {
      if (productExportFormat === 'line_items' && productLineExportTemplateId === erpNextDefaultTemplate.id) {
          const nonProductSelected = selectedExportColumns.filter(key =>
              !MOCK_SCHEMA.fields.find(f => f.key === key)?.isProductField && key !== 'products'
          );
          const newSelection = Array.from(new Set([ // Use Set to avoid duplicates if nonProductSelected already contains these
              ...nonProductSelected,
              'p_item_code', 
              'p_name'       
          ]));
          
          const sortedCurrent = [...selectedExportColumns].sort();
          const sortedNew = [...newSelection].sort();

          if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedNew)) {
              setSelectedExportColumns(newSelection);
          }
      }
  }, [productExportFormat, productLineExportTemplateId, selectedExportColumns]);


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
    const currentExportTemplate = newTemplates.find(t => t.id === productLineExportTemplateId && !t.forUpload);
    if (!currentExportTemplate) {
      const fallbackExport = newTemplates.find(t => t.id === erpNextDefaultTemplate.id) || newTemplates.find(t => t.id === erpNextExportFixedV1Template.id) || newTemplates.find(t => !t.forUpload && t.isDefault) || newTemplates.find(t => !t.forUpload);
      setProductLineExportTemplateId(fallbackExport ? fallbackExport.id : null);
    }
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

 const formatCsvCell = (value: any, delimiter: string = ';'): string => {
    if (value === undefined || value === null) return '';
    let stringValue = String(value);
    
    if (delimiter === ';') {
        if (typeof value === 'number' || (!isNaN(parseFloat(String(value).replace(',', '.'))))) {
            const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
            if (!isNaN(num)) {
                 stringValue = String(num).replace('.', ',');
            }
        }
    }
    
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
    let currentDelimiter = ';';
    let useBOM = true;

    const erpNextFixedExportTemplateId = 'erpnext-export-fixed-v1';
    const erpNextArticleDefaultId = 'erpnext-article-default';

    if (productExportFormat === 'line_items' && (productLineExportTemplateId === erpNextFixedExportTemplateId || productLineExportTemplateId === erpNextArticleDefaultId)) {
        // ERPNext Specific Export (Fixed Columns for both 'erpnext-export-fixed-v1' and 'erpnext-article-default')
        csvHeaders = ['Artikel-Code', 'Artikelname', 'Artikelgruppe', 'Standardmaßeinheit'];
        currentDelimiter = ','; // Always comma for ERPNext
        useBOM = false; // ERPNext typically prefers no BOM

        const collectedProductRows: string[][] = [];

        relevantData.forEach(item => {
            if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                item.extractedValues.products.forEach(product => {
                    const itemCode = String(product.item_code || '').trim();
                    
                    const isValidErpNextItemCode = (code: string): boolean => {
                      if (code === '') return false;
                      // Allow numbers, potentially with a single dot.
                      return /^\d*\.?\d+$/.test(code) && !isNaN(parseFloat(code.replace(',', '.')));
                    };

                    if (!isValidErpNextItemCode(itemCode)) {
                        return; // Skip if item_code is not numeric for ERPNext
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

        collectedProductRows.sort((a, b) => {
            const valA = a[0];
            const valB = b[0];
            const numA = parseFloat(valA.replace(',', '.'));
            const numB = parseFloat(valB.replace(',', '.'));

            if (!isNaN(numA) && !isNaN(numB)) {
                if (numA !== numB) return numA - numB;
            }
            return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        // Rows are already strings, formatCsvCell will handle quoting if necessary for the cell content itself
        csvRows = collectedProductRows.map(row => row.map(cell => formatCsvCell(cell, currentDelimiter)));

    } else if (productExportFormat === 'line_items') {
        currentDelimiter = ';';
        useBOM = true;
        const parentSchemaFields = MOCK_SCHEMA.fields.filter(
            field => selectedExportColumns.includes(field.key as string) && !field.isProductField && field.key !=='products'
        );
        
        let productSpecificHeaders: string[] = [];
        const activeExportTemplate = productLineExportTemplateId ? templates.find(t => t.id === productLineExportTemplateId && !t.forUpload) : null;

        if (activeExportTemplate) {
            productSpecificHeaders = activeExportTemplate.columns;
        } else {
             const selectedProductSchemaFields = MOCK_SCHEMA.fields.filter(
                field => selectedExportColumns.includes(field.key as string) && field.isProductField
            );
             productSpecificHeaders = selectedProductSchemaFields.map(field => MOCK_SCHEMA.fields.find(f => f.key === field.key)?.label.replace('Produs: ','') || field.key.substring(2) );
        }
        
        csvHeaders = [...parentSchemaFields.map(field => field.label), ...productSpecificHeaders];
        
        if (parentSchemaFields.length === 0 && productSpecificHeaders.length === 0) {
            toast({ title: "Nicio coloană selectată", description: "Selectați cel puțin o coloană de factură sau de produs pentru exportul detaliat.", variant: "warning" });
            return;
        }

        relevantData.forEach(item => {
            const parentRowPart = parentSchemaFields.map(schemaField => {
                let value: any;
                if (schemaField.key === 'fileName') value = item.fileName;
                else if (schemaField.key === 'status') value = item.status;
                else if (schemaField.key === 'activeTemplateName') {
                    const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                    value = template ? template.name : 'AI Standard Ext.';
                } else {
                    value = item.extractedValues[schemaField.key as keyof ExtractedInvoiceValues];
                }
                return value; 
            });

            if (item.extractedValues.products && item.extractedValues.products.length > 0) {
                item.extractedValues.products.forEach(product => {
                    const productRowPart = productSpecificHeaders.map(headerNameOrKey => {
                        let productKeyToFind = headerNameOrKey;
                        if (activeExportTemplate) {
                           productKeyToFind = headerNameOrKey; 
                        } else {
                           const schemaFieldForHeader = MOCK_SCHEMA.fields.find(f => f.label.replace('Produs: ','') === headerNameOrKey && f.isProductField);
                           productKeyToFind = schemaFieldForHeader ? schemaFieldForHeader.key.substring(2) : headerNameOrKey; 
                        }
                        
                        let value: any = product[productKeyToFind as keyof Product];
                        return value;
                    });
                    csvRows.push([...parentRowPart.map(val => formatCsvCell(val, currentDelimiter)), ...productRowPart.map(val => formatCsvCell(val, currentDelimiter))]);
                });
            } else if (parentRowPart.length > 0 || productSpecificHeaders.length > 0) {
                const emptyProductPart = productSpecificHeaders.map(() => '');
                csvRows.push([...parentRowPart.map(val => formatCsvCell(val, currentDelimiter)), ...emptyProductPart]);
            }
        });
    } else { // productExportFormat === 'summary'
        currentDelimiter = ';';
        useBOM = true;
        const summaryExportSchemaFields = MOCK_SCHEMA.fields.filter(
            field => selectedExportColumns.includes(field.key as string) && (field.key === 'products' || !field.isProductField)
        );
        csvHeaders = summaryExportSchemaFields.map(field => field.label);
        
        csvRows = relevantData.map(item => {
            return summaryExportSchemaFields.map(schemaField => {
                let value: any;
                if (schemaField.key === 'fileName') value = item.fileName;
                else if (schemaField.key === 'status') value = item.status;
                else if (schemaField.key === 'activeTemplateName') {
                    const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
                    value = template ? template.name : 'AI Standard Ext.';
                }
                else value = item.extractedValues[schemaField.key as keyof ExtractedInvoiceValues];

                if (schemaField.key === 'products' && Array.isArray(value)) {
                     const activeUploadTemplate = item.activeTemplateId ? templates.find(t=> t.id === item.activeTemplateId && t.forUpload) : null;
                     const summaryTemplateToUse = activeUploadTemplate || templates.find(t => t.id === aiStandardUploadTemplate.id) || comprehensiveUploadTemplate;
                  
                    return value.map((p: Product) => { 
                        let summaryParts: string[] = [];
                        const displayColumns = summaryTemplateToUse?.columns || ['item_code', 'name', 'quantity', 'price', 'amount'];
                        
                        summaryParts = displayColumns.map(colKey => {
                            const productSchemaField = MOCK_SCHEMA.fields.find(f => f.key === `p_${colKey}` || f.key === colKey); 
                            const displayColKeyLabel = productSchemaField ? productSchemaField.label.replace('Produs: ','') : colKey;
                            let productValue = p[colKey as keyof Product];

                            if (productValue === undefined || productValue === null) return `${displayColKeyLabel}: N/A`;
                            
                            if (typeof productValue === 'number') {
                               return `${displayColKeyLabel}: ${String(productValue.toFixed(2)).replace('.', ',')}`;
                            }
                            return `${displayColKeyLabel}: ${String(productValue)}`;
                        });
                        return `(${summaryParts.join(' | ')})`;
                    }).join('; '); 
                }
                return formatCsvCell(value, currentDelimiter);
            });
        });
    }
    
    if (csvRows.length === 0 && csvHeaders.length > 0 && relevantData.length > 0 && productLineExportTemplateId !== erpNextFixedExportTemplateId && productLineExportTemplateId !== erpNextArticleDefaultId) {
        csvRows.push(csvHeaders.map(() => ''));
    } else if (csvRows.length === 0 && (productLineExportTemplateId === erpNextFixedExportTemplateId || productLineExportTemplateId === erpNextArticleDefaultId) && relevantData.length > 0) {
      // For ERPNext exports, if no products match criteria, export just headers
    }
     else if (csvRows.length === 0 && csvHeaders.length === 0) {
         toast({ title: "Nicio dată de exportat", description: "Nu s-au găsit date conform selecțiilor pentru export.", variant: "warning" });
        return;
    }

    if (useBOM) {
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
    link.setAttribute("download", `date_extrase_pdf_${timestamp}.csv`);
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


  const availableExportTemplates = useMemo(() => {
    if (productExportFormat === 'line_items') {
        // Only show ERPNext templates when 'line_items' is selected
        return templates.filter(t => !t.forUpload && (t.id === erpNextDefaultTemplate.id || t.id === erpNextExportFixedV1Template.id));
    }
    // For 'summary' or other formats, show all non-upload templates (if any other formats are added later)
    // For now, this primarily means if productExportFormat is not 'line_items', this dropdown is less relevant or shows all.
    return templates.filter(t => !t.forUpload);
  }, [templates, productExportFormat]);

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
                      <SelectItem value="summary">Sumar (Produsele într-o celulă per factură)</SelectItem>
                      <SelectItem value="line_items">Detaliat (Fiecare produs pe rând nou - Recomandat ERPNext)</SelectItem>
                    </SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground">
                    Alegeți cum să fie formatate liniile de produse în CSV.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-template-select">Șablon Coloane Produse (Pentru Export Detaliat)</Label>
                  <Select
                    value={productLineExportTemplateId || ''}
                    onValueChange={(value) => setProductLineExportTemplateId(value === '' ? null : value)}
                    disabled={productExportFormat !== 'line_items'}
                  >
                    <SelectTrigger id="export-template-select" className="rounded-md">
                      <SelectValue placeholder="Selectați un șablon de export" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                       <SelectGroup>
                        <SelectLabel>Șabloane pentru Formatare Coloane Produs</SelectLabel>
                        {availableExportTemplates.length === 0 && productExportFormat === 'line_items' && <SelectItem value="no-export-tpl" disabled>Nu sunt șabloane de export definite pentru ERPNext.</SelectItem>}
                        {availableExportTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id} title={template.columns.join(', ')}>
                            {template.name} (Ex: {template.columns.slice(0,2).join(', ')+(template.columns.length > 2 ? '...' : '')})
                          </SelectItem>
                        ))}
                         {/* Show other templates if format is not line_items, or if more general line_items templates are added */}
                        {productExportFormat !== 'line_items' && templates.filter(t => !t.forUpload && !availableExportTemplates.find(at => at.id === t.id)).map(template => (
                             <SelectItem key={template.id} value={template.id} title={template.columns.join(', ')}>
                                {template.name} (Ex: {template.columns.slice(0,2).join(', ')+(template.columns.length > 2 ? '...' : '')})
                             </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Activ doar pentru "Detaliat". Selectați un șablon ERPNext pentru compatibilitate.
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
              productExportFormat={productExportFormat}
              productLineExportTemplateId={productLineExportTemplateId}
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
