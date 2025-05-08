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
    // Replace comma with dot for decimal, then parse
    const num = parseFloat(lowerVal.replace(',', '.'));
    return isNaN(num) ? val : num; // If parsing fails, pass original string for Zod to error on
  }
  // Allow numbers, null, undefined to pass through
  if (typeof val === 'number' || val === null || val === undefined) {
    return val;
  }
  // For other types, pass them through for Zod to validate
  return val;
};

// Preprocessor for string fields that can be null or undefined
const preprocessStringOrNull = (val: unknown) => {
  if (typeof val === 'string') {
    const trimmedVal = val.trim();
    const lowerVal = trimmedVal.toLowerCase();
    if (lowerVal === "null" || lowerVal === "n/a" || lowerVal === "none" || lowerVal === "undefined") {
      return null; // Convert common "null" strings to actual null
    }
    return trimmedVal === "" ? null : trimmedVal; // Convert empty trimmed string to null
  }
  if (val === null || val === undefined) {
    return val;
  }
  // Coerce other types to string if they are not already, for Zod to validate as string.
  return String(val);
};


// ProductSchema allows standard fields and any other custom fields specified by a template.
const ProductSchema = z.object({
  item_code: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The item code, SKU, or Artikelnummer if available.'),
  name: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The name or description of the product/service.'),
  quantity: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The quantity of the product/service. Must be a number.'),
  price: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The unit price of the product/service. Must be a number.'),
  amount: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The total price for this line item (quantity * price). Must be a number, if available or calculable.'),
}).catchall(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).describe(
  "Represents a single product or line item from the invoice. Should contain item_code, name, quantity, unit price, and line item total amount where available. If a field is not found, it can be null or omitted."
);
export type InvoiceProduct = z.infer<typeof ProductSchema>;

const ExtractInvoiceInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file represented as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  lineItemColumns: z.array(z.string()).optional().describe("An array of desired column names for product line items (e.g., ['Artikelnummer', 'Artikelbezeichnung', 'Menge', 'Einzelpreis', 'Gesamtpreis']). This is a HINT for the AI to find and map these specific columns, but the output for each product must still try to populate item_code, name, quantity, price, and amount."),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

const ExtractInvoiceOutputSchema = z.object({
  date: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The invoice issue date (e.g., YYYY-MM-DD).'),
  supplier: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The name of the supplier or vendor.'),
  products: z.array(ProductSchema).optional().describe('A list of products. Each product object should aim to contain item_code, name, quantity, price, and amount.'),
  totalPrice: z.preprocess(
    preprocessNumberOrNull,
    z.number().nullable().optional()
  ).describe('The total amount of the invoice. This MUST be a number. If not found or cannot be determined, return null.'),
  currency: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe('The currency code for monetary values (e.g., EUR, RON, USD). Return null if not clearly identifiable. Prioritize RON if supplier is from Romania and currency is ambiguous.'),
  documentLanguage: z.preprocess(
    preprocessStringOrNull,
    z.string().nullable().optional()
  ).describe("The primary language of the document as a two-letter code (e.g., 'ro', 'en', 'de'). Return null if not clearly identifiable. Default to 'ro' if supplier is from Romania and language is ambiguous."),
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
- The total invoice amount (as 'totalPrice'). This MUST be a number. If not found, or if it's not a clear numeric value (e.g. text like "due upon receipt"), return null.
- The currency used for all monetary values (as 'currency', e.g., EUR, RON, USD). If not clearly identifiable, return null. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON.
- The primary language of the document (as 'documentLanguage', a two-letter code e.g., 'ro', 'en', 'de'). If not clearly identifiable, return null. If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'.

For the 'products' array, which should contain a list of all product or service line items:
For EACH distinct product or service line item found on the invoice, you MUST extract an object. Aim to populate the following fields if available. If a field's value is not found or not applicable, return null for that field or omit it.
- 'item_code': The article number, SKU, Artikelnummer, Bestellnummer, Art.-Nr., or any unique product identifier.
- 'name': The product's name, description, Artikelbezeichnung, Produktbezeichnung, or item description.
- 'quantity': The number of units for the item (e.g., Menge, Anzahl, Qty, Stk). This MUST be a number. If not found or clearly not a number, return null.
- 'price': The unit price of the item (e.g., Einzelpreis, Preis pro Einheit, Unit Price, Preis). This MUST be a number. If not found or not a clear numeric value, return null.
- 'amount': The total price for THIS LINE ITEM (e.g., Gesamtpreis, Total, Betrag for the line). This MUST be a number. If it's not explicitly listed but quantity and unit price are valid numbers, you can calculate it (quantity * price). If not calculable or found, return null.

It is crucial to identify each line item accurately. Look for repeating patterns that denote product entries. Examine table structures carefully.
If no products are listed on the invoice, or if you cannot extract any of these details for any line, the 'products' field in your output should be an empty array: [].

You may be provided with 'lineItemColumns' (e.g. {{#if lineItemColumns}}{{#each lineItemColumns}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}{{else}}['some', 'custom', 'columns']{{/if}}) as a HINT. You should try to find values for columns named like those in 'lineItemColumns' AND populate them as additional properties in the product object, IN ADDITION TO the standard 'item_code', 'name', 'quantity', 'price', and 'amount' fields.

General instructions for product extraction:
- Do not skip any product rows.
- Look for rows that follow patterns such as: article number/SKU, product name, quantity, unit price, line total.
- Never summarize or merge product rows. Return them individually.

Ensure that all extracted monetary values (product prices, line amounts, total invoice price) are consistent with the identified currency. Do not convert amounts.
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
    
    // Post-processing and sanitization, even after z.preprocess, as a safeguard
    // and for calculations.
    if (output) {
        // Ensure totalPrice is a number or null
        if (typeof output.totalPrice !== 'number' && output.totalPrice !== null) {
            const parsedPrice = parseFloat(String(output.totalPrice).replace(',', '.'));
            output.totalPrice = isNaN(parsedPrice) ? null : parsedPrice;
        } else if (typeof output.totalPrice === 'number' && isNaN(output.totalPrice)) {
            output.totalPrice = null; // Handle if it somehow became NaN
        }

        if (output.products) {
            output.products = output.products.map(p => {
                const product = {...p}; // Create a shallow copy to modify

                if (typeof product.quantity !== 'number' && product.quantity !== null && product.quantity !== undefined) {
                    const pq = parseFloat(String(product.quantity).replace(',', '.'));
                    product.quantity = isNaN(pq) ? null : pq;
                } else if (typeof product.quantity === 'number' && isNaN(product.quantity)) {
                    product.quantity = null;
                }

                if (typeof product.price !== 'number' && product.price !== null && product.price !== undefined) {
                    const pp = parseFloat(String(product.price).replace(',', '.'));
                    product.price = isNaN(pp) ? null : pp;
                } else if (typeof product.price === 'number' && isNaN(product.price)) {
                    product.price = null;
                }
                
                if (typeof product.amount !== 'number' && product.amount !== null && product.amount !== undefined) {
                    const pa = parseFloat(String(product.amount).replace(',', '.'));
                    product.amount = isNaN(pa) ? null : pa;
                } else if (typeof product.amount === 'number' && isNaN(product.amount)) {
                    product.amount = null;
                }

                // If amount is missing/null but quantity and price are valid numbers, calculate it
                if ((product.amount === undefined || product.amount === null) && typeof product.quantity === 'number' && typeof product.price === 'number') {
                   if (!isNaN(product.quantity) && !isNaN(product.price)) { // Ensure they are not NaN
                        product.amount = product.quantity * product.price;
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
