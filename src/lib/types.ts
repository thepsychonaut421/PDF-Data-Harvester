export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  name: string;
  quantity: number;
  price: number;
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
    [key: string]: any; // For other dynamic fields
  };
  rawPdfUrl?: string; // Link to the PDF in GCS for preview/validation
  errorMessage?: string; // If status is 'error'
}

export interface SchemaField {
  key: keyof ExtractedDataItem['extractedValues'] | 'fileName' | 'status'; // Corresponds to keys in ExtractedDataItem or its top level
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
    { key: 'products', label: 'Produse', type: 'products_list', editable: true }, // Special rendering/editing might be needed
    { key: 'totalPrice', label: 'Preț Total (RON)', type: 'number', editable: true },
  ],
};
