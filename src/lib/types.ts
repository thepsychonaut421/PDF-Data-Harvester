
export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  item_code?: string | null; 
  name?: string | null; 
  description?: string | null;
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
  item_group?: string | null; 
  stock_uom?: string | null; 

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
  key: keyof ExtractedInvoiceValues | 'fileName' | 'status' | 'actions' | 'activeTemplateName' | `p_${keyof Product}`; 
  label: string; 
  type: 'text' | 'number' | 'date' | 'products_list' | 'status' | 'actions'; 
  editable?: boolean; 
  tooltip?: string;
  isProductField?: boolean; // Flag to identify product-specific fields
}

export interface AppSchema {
  fields: SchemaField[];
}

export const defaultAppSchema: AppSchema = {
  fields: [
    // Invoice-level fields
    { key: 'fileName', label: 'Fișier', type: 'text', editable: false },
    { key: 'status', label: 'Status', type: 'status', editable: false },
    { key: 'activeTemplateName', label: 'Șablon Upload Utilizat', type: 'text', editable: false, tooltip: 'Șablonul utilizat la încărcarea și extragerea inițială a datelor din linii de produse.' }, 
    { key: 'invoiceNumber', label: 'Nr. Factură', type: 'text', editable: true },
    { key: 'date', label: 'Data Facturii', type: 'date', editable: true },
    { key: 'dueDate', label: 'Data Scadentă', type: 'date', editable: true },
    { key: 'supplier', label: 'Furnizor', type: 'text', editable: true },
    { key: 'subtotal', label: 'Subtotal General', type: 'number', editable: true, tooltip: 'Subtotalul întregii facturi, înainte de taxe și discounturi generale.'  },
    { key: 'totalDiscountAmount', label: 'Discount General', type: 'number', editable: true, tooltip: 'Discountul total aplicat pe întreaga factură.' },
    { key: 'totalTaxAmount', label: 'Taxă Generală (TVA)', type: 'number', editable: true, tooltip: 'Valoarea totală a taxelor (TVA) pentru întreaga factură.' },
    { key: 'totalPrice', label: 'Total General Factură', type: 'number', editable: true, tooltip: 'Suma finală de plată a facturii.' },
    { key: 'currency', label: 'Monedă', type: 'text', editable: true }, 
    { key: 'documentLanguage', label: 'Limbă Doc.', type: 'text', editable: true },
    { key: 'paymentTerms', label: 'Termeni Plată', type: 'text', editable: true },
    // Field for displaying products in the table (summary) or for summary export
    { key: 'products', label: 'Produse/Servicii (Sumar/Tabel)', type: 'products_list', editable: true, tooltip: 'Lista detaliată a liniilor de produse/servicii. Selectați pentru sumar în CSV sau pentru vizualizare tabel. Pentru export detaliat, selectați coloanele individuale de produs de mai jos.' },

    // Individual Product fields for detailed export selection
    { key: 'p_item_code', label: 'Produs: Cod Articol', type: 'text', editable: false, isProductField: true, tooltip: 'Codul articolului pentru fiecare produs (SKU, Part No.). Pentru export detaliat.' },
    { key: 'p_name', label: 'Produs: Nume/Descriere', type: 'text', editable: false, isProductField: true, tooltip: 'Numele sau descrierea fiecărui produs. Pentru export detaliat.' },
    { key: 'p_description', label: 'Produs: Descriere Extinsă', type: 'text', editable: false, isProductField: true, tooltip: 'Descrierea extinsă a produsului, dacă e disponibilă. Pentru export detaliat.'},
    { key: 'p_quantity', label: 'Produs: Cantitate', type: 'number', editable: false, isProductField: true, tooltip: 'Cantitatea pentru fiecare produs. Pentru export detaliat.' },
    { key: 'p_unit', label: 'Produs: Unitate Măsură', type: 'text', editable: false, isProductField: true, tooltip: 'Unitatea de măsură pentru fiecare produs. Pentru export detaliat.' },
    { key: 'p_price', label: 'Produs: Preț Unitar Net', type: 'number', editable: false, isProductField: true, tooltip: 'Prețul unitar (preferabil net) pentru fiecare produs. Pentru export detaliat.' },
    { key: 'p_discount_value', label: 'Produs: Valoare Discount Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea discountului per linie de produs. Pentru export detaliat.' },
    { key: 'p_discount_percent', label: 'Produs: Procent Discount Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Procentul de discount per linie de produs. Pentru export detaliat.' },
    { key: 'p_net_amount', label: 'Produs: Valoare Netă Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea netă per linie de produs (cantitate * preț - discount). Pentru export detaliat.' },
    { key: 'p_tax_percent', label: 'Produs: Procent Taxă Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Procentul de taxă (TVA) per linie de produs. Pentru export detaliat.' },
    { key: 'p_tax_amount', label: 'Produs: Valoare Taxă Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea taxei (TVA) per linie de produs. Pentru export detaliat.' },
    { key: 'p_amount', label: 'Produs: Valoare Brută Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea totală brută per linie de produs (net + taxă). Pentru export detaliat.' },
    // ERPNext specific product fields for export selection
    { key: 'p_item_group', label: 'Produs: Grup Articole (ERPNext)', type: 'text', editable: false, isProductField: true, tooltip: 'Pentru export ERPNext, de obicei "Produkt". Pentru export detaliat.' },
    { key: 'p_stock_uom', label: 'Produs: UM Stoc (ERPNext)', type: 'text', editable: false, isProductField: true, tooltip: 'Unitatea de măsură pentru stoc (ERPNext), derivată din unitatea produsului sau "Stk". Pentru export detaliat.' },
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
  forUpload?: boolean; 
}
