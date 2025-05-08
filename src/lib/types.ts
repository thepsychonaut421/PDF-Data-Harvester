export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  name: string;
  quantity: number;
  price?: number; // Price can be optional if not found
}

export interface ExtractedDataItem {
  id: string; // Unique ID for each row/PDF document
  fileName: string;
  status: PdfStatus;
  extractedValues: { // Fields defined in schema.json
    date?: string;
    supplier?: string;
    products?: Product[];
    totalPrice?: number;
    currency?: string; // e.g., "RON", "EUR", "USD"
    documentLanguage?: string; // e.g., "ro", "en", "de"
    [key: string]: any; // For other dynamic fields
  };
  rawPdfUrl?: string; // Link to the PDF in GCS for preview/validation
  errorMessage?: string; // If status is 'error'
}

export interface SchemaField {
  key: keyof ExtractedDataItem['extractedValues'] | 'fileName' | 'status' | 'actions'; // Adjusted key type
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
    { key: 'date', label: 'Data Facturii', type: 'date', editable: true },
    { key: 'supplier', label: 'Furnizor', type: 'text', editable: true },
    { key: 'products', label: 'Produse', type: 'products_list', editable: true },
    { key: 'totalPrice', label: 'Valoare Totală', type: 'number', editable: true },
    { key: 'currency', label: 'Monedă', type: 'text', editable: false },
    { key: 'documentLanguage', label: 'Limbă Doc.', type: 'text', editable: false },
    // 'actions' key is dynamically added in DataTable if onDeleteItem is provided
  ],
};

// Interface for items in the upload queue, including the File object
export interface UploadQueueItem extends ExtractedDataItem {
  fileObject: File;
}
