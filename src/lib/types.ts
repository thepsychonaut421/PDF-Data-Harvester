export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  name?: string; 
  quantity?: number | string; // Allow string for quantities like "1 buc"
  price?: number | string;    // Allow string for prices like "N/A" or with symbols
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
  activeTemplateId?: string | null; // Changed from activeTemplateName to store the ID
}

export interface SchemaField {
  key: keyof ExtractedDataItem['extractedValues'] | 'fileName' | 'status' | 'actions' | 'activeTemplateName'; // 'activeTemplateName' is now a derived display key
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
    { key: 'activeTemplateName', label: 'Șablon Utilizat', type: 'text', editable: false }, // Label remains, data derived from activeTemplateId
    { key: 'date', label: 'Data Facturii', type: 'date', editable: true },
    { key: 'supplier', label: 'Furnizor', type: 'text', editable: true },
    { key: 'products', label: 'Produse', type: 'products_list', editable: true },
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