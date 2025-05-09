
'use server';
/**
 * @fileOverview An AI flow for extracting structured data from PDF invoices,
 * supporting customizable product line item extraction based on templates.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Preprocessor for numeric fields that can be null or undefined
const preprocessNumberOrNull = (val: unknown) => {
  if (typeof val === 'string') {
    const lowerVal = val.trim().toLowerCase();
    if (lowerVal === "" || lowerVal === "null" || lowerVal === "n/a" || lowerVal === "none" || lowerVal === "undefined") {
      return null;
    }
    // Replace comma with dot for decimal, remove currency symbols, then parse
    const cleanedVal = lowerVal.replace(',', '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(cleanedVal);
    return isNaN(num) ? val : num; 
  }
  if (typeof val === 'number' || val === null || val === undefined) {
    return val;
  }
  return val;
};

// Preprocessor for string fields that can be null or undefined
const preprocessStringOrNull = (val: unknown) => {
  if (typeof val === 'string') {
    const trimmedVal = val.trim();
    const lowerVal = trimmedVal.toLowerCase();
    if (lowerVal === "null" || lowerVal === "n/a" || lowerVal === "none" || lowerVal === "undefined") {
      return null; 
    }
    return trimmedVal === "" ? null : trimmedVal; 
  }
  if (val === null || val === undefined) {
    return val;
  }
  return String(val);
};


// ProductSchema allows standard fields and any other custom fields specified by a template.
const ProductSchema = z.object({
  item_code: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The item code, SKU, Artikelnummer, Part No., or similar unique identifier if available.'),
  name: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The name or description of the product/service. This is often called Description, Artikelbezeichnung, Produktbezeichnung, Denumire etc.'),
  quantity: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The quantity of the product/service (e.g., Menge, Anzahl, Qty, Stk, Cantitate). Must be a number.'),
  unit: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The unit of measure if specified (e.g., pcs, kg, hour, buc, Stk).'),
  price: z.preprocess( // This usually refers to unit price before any discounts or taxes
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The unit price (Einzelpreis, Preis pro Einheit, Unit Price, Pret Unitar) of the product/service, preferably net. Must be a number.'),
  discount_value: z.preprocess( // Line item discount amount
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The total discount amount for this line item, if specified. Must be a number.'),
  discount_percent: z.preprocess( // Line item discount percentage
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The discount percentage for this line item, if specified (e.g., 10 for 10%). Must be a number.'),
  net_amount: z.preprocess( // Line item net amount (after discount, before tax)
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The net amount for this line item (quantity * price - discount_value). Must be a number.'),
  tax_percent: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The tax rate or VAT percentage applied to this line item (e.g., 19 for 19% MWSt./USt./TVA). Must be a number.'),
  tax_amount: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The tax (VAT/MWSt./USt./TVA) amount for this line item. Must be a number.'),
  amount: z.preprocess( // This now explicitly means gross amount for the line item
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The total gross price for this line item (net_amount + tax_amount, or quantity * price if no other details). Must be a number, if available or calculable.'),
}).catchall(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).describe(
  "Represents a single product or line item from the invoice. Should contain all available details such as item_code, name/description, quantity, unit, unit_price, discount_value, discount_percent, tax_percent, net_amount, tax_amount, and gross_amount (as 'amount'). If a field is not found, it can be null or omitted."
);
export type InvoiceProduct = z.infer<typeof ProductSchema>;

const ExtractInvoiceInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file represented as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  lineItemColumns: z.array(z.string()).optional().describe("An array of desired column names for product line items (e.g., ['Artikelnummer', 'Artikelbezeichnung', 'Menge', 'Einzelpreis', 'Nettobetrag', 'MwSt %', 'MwSt Betrag', 'Gesamtpreis']). This is a HINT for the AI to find and map these specific columns, but the output for each product must still try to populate all fields in the ProductSchema."),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

const ExtractInvoiceOutputSchema = z.object({
  date: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The invoice issue date (e.g., YYYY-MM-DD or as on invoice).'),
  supplier: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The name of the supplier or vendor.'),
  products: z.array(ProductSchema).optional().describe('A list of products. Each product object should aim to contain all fields from the ProductSchema if the information is present on the invoice.'),
  totalPrice: z.preprocess( // This refers to the invoice grand total (gross)
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The grand total amount of the invoice (Bruttobetrag, Summe Total, Total General). This MUST be a number. If not found or cannot be determined, return null.'),
  currency: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The currency code for monetary values (e.g., EUR, RON, USD). Return null if not clearly identifiable. Prioritize RON if supplier is from Romania and currency is ambiguous.'),
  documentLanguage: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe("The primary language of the document as a two-letter code (e.g., 'ro', 'en', 'de'). Return null if not clearly identifiable. Default to 'ro' if supplier is from Romania and language is ambiguous."),
  // Optional additional overall invoice fields
  invoiceNumber: z.preprocess(preprocessStringOrNull, z.string().nullable().optional()).describe('The invoice number or ID, if available.'),
  subtotal: z.preprocess(preprocessNumberOrNull, z.number().nullable().optional()).describe('The subtotal of the invoice before overall taxes and discounts, if specified. Must be a number.'),
  totalDiscountAmount: z.preprocess(preprocessNumberOrNull, z.number().nullable().optional()).describe('Any overall discount amount applied to the entire invoice, if specified. Must be a number.'),
  totalTaxAmount: z.preprocess(preprocessNumberOrNull, z.number().nullable().optional()).describe('The total tax (VAT/MWSt./USt./TVA) amount for the entire invoice, if specified. Must be a number.'),
  paymentTerms: z.preprocess(preprocessStringOrNull, z.string().nullable().optional()).describe('Payment terms, if specified (e.g., "Net 30 days", "Due upon receipt").'),
  dueDate: z.preprocess(preprocessStringOrNull, z.string().nullable().optional()).describe('The due date for payment, if specified (e.g., YYYY-MM-DD).'),

});
export type ExtractInvoiceOutput = z.infer<typeof ExtractInvoiceOutputSchema>;

const extractInvoicePrompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: { schema: ExtractInvoiceInputSchema },
  output: { schema: ExtractInvoiceOutputSchema },
  prompt: `You are an expert data extraction AI. Your task is to analyze the provided PDF invoice and extract key information according to the provided JSON schema.

Please extract the following general invoice details:
- Invoice issue date (as 'date'). Format as YYYY-MM-DD if possible, otherwise use the format on the invoice. If not found, return null.
- Supplier name (as 'supplier'). If not found, return null.
- Invoice number (as 'invoiceNumber'), if available.
- The grand total invoice amount (as 'totalPrice', this is usually the final amount due, including all taxes and after all discounts). This MUST be a number. If not found, or if it's not a clear numeric value, return null.
- The currency used for all monetary values (as 'currency', e.g., EUR, RON, USD). If not clearly identifiable, return null. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON.
- The primary language of the document (as 'documentLanguage', a two-letter code e.g., 'ro', 'en', 'de'). If not clearly identifiable, return null. If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'.
- Subtotal (as 'subtotal'), if specified as a separate value before overall taxes/discounts. Must be a number.
- Total discount amount (as 'totalDiscountAmount') applied to the entire invoice, if specified. Must be a number.
- Total tax amount (as 'totalTaxAmount') for the entire invoice (e.g. total VAT/MWSt.), if specified. Must be a number.
- Payment terms (as 'paymentTerms'), if specified.
- Due date (as 'dueDate'), if specified.

For the 'products' array, which should contain a list of all product or service line items:
For EACH distinct product or service line item found on the invoice, you MUST extract an object. Aim to populate ALL the following fields if the information is available on the invoice. If a field's value is not found or not applicable, return null for that field or omit it.
- 'item_code': The article number, SKU, Part No., Artikelnummer, Bestellnummer, Art.-Nr., or any unique product identifier.
- 'name': The product's name, description, Artikelbezeichnung, Produktbezeichnung, or item description.
- 'quantity': The number of units for the item (e.g., Menge, Anzahl, Qty, Stk, Cantitate). This MUST be a number.
- 'unit': The unit of measure (e.g., pcs, kg, hour, Stk, buc.).
- 'price': The unit price (Einzelpreis, Unit Price, Pret Unitar), preferably the net unit price if discernible. This MUST be a number.
- 'discount_value': The total discount amount for THIS LINE ITEM, if specified. Must be a number.
- 'discount_percent': The discount percentage for THIS LINE ITEM (e.g., 10 for 10%). Must be a number.
- 'net_amount': The net amount for THIS LINE ITEM (e.g., quantity * price - discount_value, or if directly stated as Nettobetrag Zeile). Must be a number.
- 'tax_percent': The tax rate (VAT/MWSt./USt./TVA percentage) applied to THIS LINE ITEM (e.g., 19 for 19%). Must be a number.
- 'tax_amount': The tax (VAT/MWSt./USt./TVA) amount for THIS LINE ITEM. Must be a number.
- 'amount': The total gross amount for THIS LINE ITEM (e.g., Gesamtbetrag, Bruttobetrag Zeile, typically net_amount + tax_amount). This MUST be a number. If not explicitly stated, attempt to calculate it from other available numeric fields (e.g. net_amount + tax_amount, or (quantity * price - discount_value) * (1 + tax_percent/100) ).

It is crucial to identify each line item accurately. Look for repeating patterns that denote product entries. Examine table structures carefully.
If no products are listed on the invoice, or if you cannot extract any of these details for any line, the 'products' field in your output should be an empty array: [].

You may be provided with 'lineItemColumns' (e.g. {{#if lineItemColumns}}{{#each lineItemColumns}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}{{else}}['some', 'custom', 'columns']{{/if}}) as a HINT. You should try to find values for columns named like those in 'lineItemColumns' AND populate them as additional properties in the product object, IN ADDITION TO the standard fields defined in the ProductSchema. Prioritize filling the standard schema fields first.

General instructions for product extraction:
- Do not skip any product rows.
- Look for rows that follow patterns such as: article number/SKU, product name, quantity, unit price, net amount, tax, gross amount.
- Never summarize or merge product rows. Return them individually.
- If a value is a monetary amount, ensure it is a number without currency symbols. The overall currency is handled by the 'currency' field.
- For percentage fields (discount_percent, tax_percent), provide the numeric value (e.g., for 19%, return 19).

Ensure that all extracted monetary values are consistent with the identified currency. Do not convert amounts.
Format your response strictly according to the provided output schema. Pay attention to data types: strings should be strings, numbers should be numbers, and use actual null for missing/invalid values where appropriate for nullable fields.

PDF Document:
{{media url=pdfDataUri}}`,
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceInputSchema,
    outputSchema: ExtractInvoiceOutputSchema,
  },
  async (input) => {
    const {output} = await extractInvoicePrompt(input);
    
    if (output) {
        // Ensure totalPrice is a number or null
        if (output.totalPrice !== null && typeof output.totalPrice !== 'number') {
            const parsedPrice = parseFloat(String(output.totalPrice).replace(',', '.').replace(/[^\d.-]/g, ''));
            output.totalPrice = isNaN(parsedPrice) ? null : parsedPrice;
        } else if (typeof output.totalPrice === 'number' && isNaN(output.totalPrice)) {
            output.totalPrice = null; 
        }

        // Sanitize other top-level numeric fields
        const numericTopLevelKeys: (keyof ExtractInvoiceOutput)[] = ['subtotal', 'totalDiscountAmount', 'totalTaxAmount'];
        numericTopLevelKeys.forEach(key => {
            if (output[key] !== null && output[key] !== undefined && typeof output[key] !== 'number') {
                const parsed = parseFloat(String(output[key]).replace(',', '.').replace(/[^\d.-]/g, ''));
                (output[key] as any) = isNaN(parsed) ? null : parsed;
            } else if (typeof output[key] === 'number' && isNaN(output[key] as number)) {
                (output[key] as any) = null;
            }
        });


        if (output.products) {
            output.products = output.products.map(p => {
                const product = {...p}; 

                const numericProductKeys: (keyof InvoiceProduct)[] = ['quantity', 'price', 'discount_value', 'discount_percent', 'net_amount', 'tax_percent', 'tax_amount', 'amount'];
                
                numericProductKeys.forEach(key => {
                    if (product[key] !== null && product[key] !== undefined && typeof product[key] !== 'number') {
                        const valStr = String(product[key]);
                        // Special handling for percentages - remove % if AI includes it.
                        const cleanedValStr = (key === 'discount_percent' || key === 'tax_percent') ? 
                                            valStr.replace(',', '.').replace('%','').replace(/[^\d.-]/g, '') : 
                                            valStr.replace(',', '.').replace(/[^\d.-]/g, '');

                        const parsedNum = parseFloat(cleanedValStr);
                        (product[key] as any) = isNaN(parsedNum) ? null : parsedNum;

                    } else if (typeof product[key] === 'number' && isNaN(product[key] as number) ) {
                         (product[key] as any) = null;
                    }
                });
                
                // Calculation logic for 'amount' (gross amount) if missing
                if ((product.amount === undefined || product.amount === null)) {
                    const qty = typeof product.quantity === 'number' && !isNaN(product.quantity) ? product.quantity : null;
                    const unitPrice = typeof product.price === 'number' && !isNaN(product.price) ? product.price : null;
                    const net = typeof product.net_amount === 'number' && !isNaN(product.net_amount) ? product.net_amount : null;
                    const taxAmt = typeof product.tax_amount === 'number' && !isNaN(product.tax_amount) ? product.tax_amount : null;
                    const discountVal = typeof product.discount_value === 'number' && !isNaN(product.discount_value) ? product.discount_value : 0; // Assume 0 if null for calculation

                    if (net !== null && taxAmt !== null) {
                        product.amount = net + taxAmt;
                    } else if (qty !== null && unitPrice !== null) {
                        let calculatedNet = (qty * unitPrice) - discountVal;
                        if (product.tax_percent !== null && typeof product.tax_percent === 'number' && !isNaN(product.tax_percent)) {
                            product.amount = calculatedNet * (1 + (product.tax_percent / 100));
                        } else {
                           // If no tax info, amount might be same as net after discount
                           product.amount = calculatedNet;
                        }
                    }
                }
                 // Calculation logic for 'net_amount' if missing and others present
                 if ((product.net_amount === undefined || product.net_amount === null) &&
                     typeof product.quantity === 'number' && typeof product.price === 'number') {
                    const qty = product.quantity;
                    const price = product.price;
                    const discount = (typeof product.discount_value === 'number' && !isNaN(product.discount_value)) ? product.discount_value : 0;
                    if (!isNaN(qty) && !isNaN(price)) {
                         product.net_amount = (qty * price) - discount;
                    }
                 }


                return product;
            });
        }
    }
    return output!;
  }
);

export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput | null> {
  const result = await extractInvoiceDataFlow(input);
  return result;
}

