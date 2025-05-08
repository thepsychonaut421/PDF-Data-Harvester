export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  name?: string; 
  quantity?: number | string; 
  price?: number | string;    
  [key: string]: any; 
}

export interface ExtractedDataItem {
  id: string; 
  fileName: string;
  status: PdfStatus;
  extractedValues: { 
    date?: string;
    supplier?: string;
    products?: Product[]; 
    totalPrice?: number | null; 
    currency?: string | null; 
    documentLanguage?: string | null;
    [key: string]: any; 
  };
  rawPdfUrl?: string; 
  errorMessage?: string; 
  activeTemplateId?: string | null; 
}

export interface SchemaField {
  key: keyof ExtractedDataItem['extractedValues'] | 'fileName' | 'status' | 'actions' | 'activeTemplateName'; 
  label: string; 
  type: 'text' | 'number' | 'date' | 'products_list' | 'status' | 'actions'; 
  editable?: boolean; 
}

export interface AppSchema {
  fields: SchemaField[];
}

export const defaultAppSchema: AppSchema = {
  fields: [
    { key: 'fileName', label: 'Fișier', type: 'text', editable: false },
    { key: 'status', label: 'Status', type: 'status', editable: false },
    { key: 'activeTemplateName', label: 'Șablon Extragere (Upload)', type: 'text', editable: false }, 
    { key: 'date', label: 'Data Facturii', type: 'date', editable: true },
    { key: 'supplier', label: 'Furnizor', type: 'text', editable: true },
    { key: 'products', label: 'Produse (Sumar)', type: 'products_list', editable: true }, // Label changed to indicate this is the summary view
    { key: 'totalPrice', label: 'Valoare Totală', type: 'number', editable: true },
    { key: 'currency', label: 'Monedă', type: 'text', editable: true }, 
    { key: 'documentLanguage', label: 'Limbă Doc.', type: 'text', editable: true },
  ],
};

export interface UploadQueueItem extends Omit<ExtractedDataItem, 'activeTemplateId' | 'rawPdfUrl' | 'status' | 'id' | 'extractedValues' > { 
  id: string;
  fileName: string;
  status: PdfStatus;
  extractedValues: Partial<ExtractedDataItem['extractedValues']>; 
  rawPdfUrl?: string; 
  fileObject: File;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  columns: string[]; 
}
