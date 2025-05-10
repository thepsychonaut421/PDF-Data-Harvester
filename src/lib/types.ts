
export type PdfStatus = 'pending' | 'uploading' | 'processing' | 'processed' | 'needs_validation' | 'error';

export interface Product {
  item_code?: string | null; 
  name?: string | null; 
  description?: string | null;
  quantity?: number | string | null; 
  unit?: string | null;
  price?: number | string | null; 
  discount_value?: number | string | null;
  discount_percent?: number | string | null;
  net_amount?: number | string | null; 
  tax_percent?: number | string | null;
  tax_amount?: number | string | null; 
  amount?: number | string | null; 
  
  item_group?: string | null; 
  stock_uom?: string | null; 
  item_name?: string | null; 
  qty?: number | string | null; 
  uom?: string | null; 
  rate?: number | string | null; 

  [key: string]: any; 
}

export interface ExtractedInvoiceValues { 
  date?: string | null;
  supplier?: string | null;
  products?: Product[] | null; 
  totalPrice?: number | null; 
  currency?: string | null; 
  documentLanguage?: string | null;
  invoiceNumber?: string | null;
  subtotal?: number | null; 
  totalDiscountAmount?: number | null; 
  totalTaxAmount?: number | null; 
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
  key: keyof ExtractedInvoiceValues | 'fileName' | 'status' | 'actions' | 'activeTemplateName' | `p_${keyof Product}` | `p_item_name` | `p_qty` | `p_uom` | `p_rate`;
  label: string; 
  type: 'text' | 'number' | 'date' | 'products_list' | 'status' | 'actions'; 
  editable?: boolean; 
  tooltip?: string;
  isProductField?: boolean; 
}

export interface AppSchema {
  fields: SchemaField[];
}

export const defaultAppSchema: AppSchema = {
  fields: [
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
    { key: 'products', label: 'Produse/Servicii (Sumar/Tabel)', type: 'products_list', editable: true, tooltip: 'Lista detaliată a liniilor de produse/servicii. Selectați pentru sumar în CSV sau pentru vizualizare tabel. Pentru export detaliat, selectați coloanele individuale de produs de mai jos.' },

    { key: 'p_item_code', label: 'Produs: Cod Articol', type: 'text', editable: false, isProductField: true, tooltip: 'Codul articolului pentru fiecare produs (SKU, Part No.). Pentru export detaliat.' },
    { key: 'p_name', label: 'Produs: Nume', type: 'text', editable: false, isProductField: true, tooltip: 'Numele fiecărui produs. Pentru export detaliat.' },
    { key: 'p_description', label: 'Produs: Descriere', type: 'text', editable: false, isProductField: true, tooltip: 'Descrierea produsului, dacă e disponibilă și diferită de nume. Pentru export detaliat.'},
    { key: 'p_quantity', label: 'Produs: Cantitate', type: 'number', editable: false, isProductField: true, tooltip: 'Cantitatea pentru fiecare produs. Pentru export detaliat.' },
    { key: 'p_unit', label: 'Produs: Unitate Măsură', type: 'text', editable: false, isProductField: true, tooltip: 'Unitatea de măsură pentru fiecare produs. Pentru export detaliat.' },
    { key: 'p_price', label: 'Produs: Preț Unitar', type: 'number', editable: false, isProductField: true, tooltip: 'Prețul unitar (preferabil net) pentru fiecare produs. Pentru export detaliat.' },
    { key: 'p_discount_value', label: 'Produs: Valoare Discount Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea discountului per linie de produs. Pentru export detaliat.' },
    { key: 'p_discount_percent', label: 'Produs: Procent Discount Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Procentul de discount per linie de produs. Pentru export detaliat.' },
    { key: 'p_net_amount', label: 'Produs: Valoare Netă Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea netă per linie de produs (cantitate * preț - discount). Pentru export detaliat.' },
    { key: 'p_tax_percent', label: 'Produs: Procent Taxă Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Procentul de taxă (TVA) per linie de produs. Pentru export detaliat.' },
    { key: 'p_tax_amount', label: 'Produs: Valoare Taxă Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea taxei (TVA) per linie de produs. Pentru export detaliat.' },
    { key: 'p_amount', label: 'Produs: Valoare Brută Linie', type: 'number', editable: false, isProductField: true, tooltip: 'Valoarea totală brută per linie de produs (net + taxă). Pentru export detaliat.' },
    
    { key: 'p_item_name', label: 'Produs: Nume Articol (ERPNext)', type: 'text', editable: false, isProductField: true, tooltip: 'Numele articolului specific pentru ERPNext. Pentru export detaliat.' },
    { key: 'p_qty', label: 'Produs: Cantitate (ERPNext)', type: 'number', editable: false, isProductField: true, tooltip: 'Cantitatea specifică pentru ERPNext. Pentru export detaliat.' },
    { key: 'p_uom', label: 'Produs: UM (ERPNext)', type: 'text', editable: false, isProductField: true, tooltip: 'Unitatea de măsură specifică pentru ERPNext. Pentru export detaliat.' },
    { key: 'p_rate', label: 'Produs: Rată/Preț (ERPNext)', type: 'number', editable: false, isProductField: true, tooltip: 'Rata sau prețul unitar specific pentru ERPNext. Pentru export detaliat.' },
    { key: 'p_item_group', label: 'Produs: Grup Articole (ERPNext)', type: 'text', editable: false, isProductField: true, tooltip: 'Pentru export ERPNext, de obicei "Produkte". Pentru export detaliat.' },
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

// Default Templates Definitions
export const erpNextDefaultTemplate: InvoiceTemplate = {
  id: 'erpnext-article-default',
  name: 'ERPNext Article Default (Export)',
  // These columns are for potential AI guidance or generic display, 
  // but the actual ERPNext export CSV for this template will have a fixed header:
  // Artikel-Code, Artikelname, Artikelgruppe, Standardmaßeinheit
  columns: ['item_code', 'item_name', 'qty', 'uom', 'rate', 'amount', 'item_group', 'stock_uom'], 
  isDefault: true,
  forUpload: false, 
};

export const aiStandardUploadTemplate: InvoiceTemplate = {
  id: 'ai-standard-upload-template',
  name: 'AI Standard Extraction (Upload)',
  columns: ['item_code', 'name', 'quantity', 'price', 'amount'], 
  isDefault: true, 
  forUpload: true,
};

export const comprehensiveUploadTemplate: InvoiceTemplate = {
  id: 'comprehensive-invoice-upload-template',
  name: 'Comprehensive Details (Upload)',
  columns: ['item_code', 'name', 'description', 'quantity', 'unit', 'price', 'discount_value', 'discount_percent', 'net_amount', 'tax_percent', 'tax_amount', 'amount'],
  isDefault: false,
  forUpload: true,
};

export const comprehensiveExportTemplate: InvoiceTemplate = {
  id: 'comprehensive-invoice-export-template',
  name: 'Comprehensive Details (Export)',
  columns: ['item_code', 'name', 'description', 'quantity', 'unit', 'price', 'discount_value', 'discount_percent', 'net_amount', 'tax_percent', 'tax_amount', 'amount'],
  isDefault: false,
  forUpload: false,
};

export const erpNextExportFixedV1Template: InvoiceTemplate = {
  id: 'erpnext-export-fixed-v1',
  name: 'ERPNext Export (Fixed: Artikel-Code, Name, Gruppe, ME)',
  // These columns define the exact CSV header for this template when exported
  columns: ['Artikel-Code', 'Artikelname', 'Artikelgruppe', 'Standardmaßeinheit'], 
  isDefault: false,
  forUpload: false,
};
