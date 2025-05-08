export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  name?: string; // Standard/fallback, e.g., from "Artikelbezeichnung"
  quantity?: number; // Standard/fallback, e.g., from "Menge"
  price?: number; // Standard/fallback, e.g., from "Einzelpreis"
  [key: string]: any; // For custom template columns like "Artikelnummer" or other fields
}

export interface ExtractedDataItem {
  id: string; // Unique ID for each row/PDF document
  fileName: string;
  status: PdfStatus;
  extractedValues: { // Fields defined in schema.json
    date?: string;
    supplier?: string;
    products?: Product[]; // Array of products, structure can be dynamic based on template
    totalPrice?: number | null; // totalPrice can be null if not found
    currency?: string | null; 
    documentLanguage?: string | null;
    [key: string]: any; // For other dynamic fields
  };
  rawPdfUrl?: string; // Link to the PDF for preview/validation
  errorMessage?: string; // If status is 'error'
  activeTemplateName?: string | null; // Store the name of the template used for extraction
}

export interface SchemaField {
  key: keyof ExtractedDataItem['extractedValues'] | 'fileName' | 'status' | 'actions' | 'activeTemplateName'; // Adjusted key type
  label: string; // Display label for table headers
  type: 'text' | 'number' | 'date' | 'products_list' | 'status' | 'actions'; // Helps in rendering and editing
  editable?: boolean; // If the field can be edited in the dashboard
}

export interface AppSchema {
  fields: SchemaField[];
}

// Define a default schema for the application
export const defaultAppSchema: AppSchema = {
  fields: [
    { key: 'fileName', label: 'Fișier', type: 'text', editable: false },
    { key: 'status', label: 'Status', type: 'status', editable: false },
    { key: 'activeTemplateName', label: 'Șablon Utilizat', type: 'text', editable: false },
    { key: 'date', label: 'Data Facturii', type: 'date', editable: true },
    { key: 'supplier', label: 'Furnizor', type: 'text', editable: true },
    { key: 'products', label: 'Produse', type: 'products_list', editable: true },
    { key: 'totalPrice', label: 'Valoare Totală', type: 'number', editable: true },
    { key: 'currency', label: 'Monedă', type: 'text', editable: true }, 
    { key: 'documentLanguage', label: 'Limbă Doc.', type: 'text', editable: true },
    // 'actions' key is dynamically added in DataTable if onDeleteItem is provided
  ],
};

// Interface for items in the upload queue, including the File object
export interface UploadQueueItem extends Omit<ExtractedDataItem, 'activeTemplateName' | 'rawPdfUrl' | 'status' | 'id' | 'extractedValues' > { 
  // Core properties for upload queue, ExtractedDataItem is built upon processing
  id: string;
  fileName: string;
  status: PdfStatus;
  extractedValues: Partial<ExtractedDataItem['extractedValues']>; // Initially empty or partial
  rawPdfUrl?: string; 
  fileObject: File;
}

// Interface for invoice extraction templates
export interface InvoiceTemplate {
  id: string;
  name: string;
  columns: string[]; // e.g., ["Artikelnummer", "Artikelbezeichnung", "Menge"]
}
