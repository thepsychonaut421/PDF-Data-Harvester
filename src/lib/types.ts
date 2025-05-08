export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  item_code?: string; 
  name?: string; 
  quantity?: number | string; 
  price?: number | string;    
  amount?: number | string; // For line item total, if provided by AI or calculated
  [key: string]: any; 
}

export interface ExtractedInvoiceValues { 
  date?: string;
  supplier?: string;
  products?: Product[]; 
  totalPrice?: number | null; 
  currency?: string | null; 
  documentLanguage?: string | null;
  [key: string]: any; 
}

export interface ExtractedDataItem {
  id: string; 
  fileName: string;
  status: PdfStatus;
  extractedValues: ExtractedInvoiceValues; 
  rawPdfUrl?: string; 
  errorMessage?: string; 
  activeTemplateId?: string | null; 
}

export interface SchemaField {
  key: keyof ExtractedInvoiceValues | 'fileName' | 'status' | 'actions' | 'activeTemplateName'; 
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
    { key: 'products', label: 'Produse (Sumar / Linii mapate conf. Șablon Upload)', type: 'products_list', editable: true },
    { key: 'totalPrice', label: 'Valoare Totală', type: 'number', editable: true },
    { key: 'currency', label: 'Monedă', type: 'text', editable: true }, 
    { key: 'documentLanguage', label: 'Limbă Doc.', type: 'text', editable: true },
  ],
};

export interface UploadQueueItem extends Omit<ExtractedDataItem, 'activeTemplateId' | 'rawPdfUrl' | 'status' | 'id' | 'extractedValues' > { 
  id: string;
  fileName: string;
  status: PdfStatus;
  extractedValues: Partial<ExtractedInvoiceValues>; 
  rawPdfUrl?: string; 
  fileObject: File;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  columns: string[]; 
  isDefault?: boolean; // To identify the ERPNext default template
}
