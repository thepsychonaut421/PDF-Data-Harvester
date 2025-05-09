
export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  item_code?: string | null; 
  name?: string | null; 
  description?: string | null; // Added for comprehensive template
  quantity?: number | string | null; 
  unit?: string | null;
  price?: number | string | null; // Unit price
  discount_value?: number | string | null;
  discount_percent?: number | string | null;
  net_amount?: number | string | null; // Line item net amount
  tax_percent?: number | string | null;
  tax_amount?: number | string | null; // Line item tax amount
  amount?: number | string | null; // Line item gross amount (total for the line)
  // For user-specific ERPNext export:
  item_group?: string | null; // Will be "Produkt"
  stock_uom?: string | null; // Will be derived from unit or "Stk"

  [key: string]: any; 
}

export interface ExtractedInvoiceValues { 
  date?: string | null;
  supplier?: string | null;
  products?: Product[] | null; 
  totalPrice?: number | null; // Grand total
  currency?: string | null; 
  documentLanguage?: string | null;
  invoiceNumber?: string | null;
  subtotal?: number | null; // Overall subtotal
  totalDiscountAmount?: number | null; // Overall discount
  totalTaxAmount?: number | null; // Overall tax
  paymentTerms?: string | null;
  dueDate?: string | null;
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
  tooltip?: string;
}

export interface AppSchema {
  fields: SchemaField[];
}

export const defaultAppSchema: AppSchema = {
  fields: [
    { key: 'fileName', label: 'Fișier', type: 'text', editable: false },
    { key: 'status', label: 'Status', type: 'status', editable: false },
    { key: 'activeTemplateName', label: 'Șablon Upload', type: 'text', editable: false, tooltip: 'Șablonul utilizat la încărcarea și extragerea inițială a datelor.' }, 
    { key: 'invoiceNumber', label: 'Nr. Factură', type: 'text', editable: true },
    { key: 'date', label: 'Data Facturii', type: 'date', editable: true },
    { key: 'dueDate', label: 'Data Scadentă', type: 'date', editable: true },
    { key: 'supplier', label: 'Furnizor', type: 'text', editable: true },
    { key: 'products', label: 'Produse/Servicii', type: 'products_list', editable: true, tooltip: 'Lista detaliată a liniilor de produse/servicii. Poate fi editată ca JSON.' },
    { key: 'subtotal', label: 'Subtotal General', type: 'number', editable: true, tooltip: 'Subtotalul întregii facturi, înainte de taxe și discounturi generale.'  },
    { key: 'totalDiscountAmount', label: 'Discount General', type: 'number', editable: true, tooltip: 'Discountul total aplicat pe întreaga factură.' },
    { key: 'totalTaxAmount', label: 'Taxă Generală (TVA)', type: 'number', editable: true, tooltip: 'Valoarea totală a taxelor (TVA) pentru întreaga factură.' },
    { key: 'totalPrice', label: 'Total General Factură', type: 'number', editable: true, tooltip: 'Suma finală de plată a facturii.' },
    { key: 'currency', label: 'Monedă', type: 'text', editable: true }, 
    { key: 'documentLanguage', label: 'Limbă Doc.', type: 'text', editable: true },
    { key: 'paymentTerms', label: 'Termeni Plată', type: 'text', editable: true },
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
  isDefault?: boolean; 
  forUpload?: boolean; // True if template is for guiding AI at upload, false if for CSV export formatting
}
