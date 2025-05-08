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

// ProductSchema allows standard fields and any other custom fields specified by a template.
const ProductSchema = z.object({
  item_code: z.string().optional().describe('The item code, SKU, or Artikelnummer if available.'),
  name: z.string().optional().describe('The name or description of the product/service.'),
  quantity: z.number().optional().describe('The quantity of the product/service.'),
  price: z.number().optional().describe('The unit price of the product/service.'),
}).catchall(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).describe(
  "Represents a single product or line item from the invoice. Should contain item_code, name, quantity, and price where available."
);
export type InvoiceProduct = z.infer<typeof ProductSchema>;

const ExtractInvoiceInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file represented as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  lineItemColumns: z.array(z.string()).optional().describe("An array of desired column names for product line items (e.g., ['Artikelnummer', 'Artikelbezeichnung', 'Menge']). This is a HINT for the AI."),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

const ExtractInvoiceOutputSchema = z.object({
  date: z.string().optional().describe('The invoice issue date (e.g., YYYY-MM-DD).'),
  supplier: z.string().optional().describe('The name of the supplier or vendor.'),
  products: z.array(ProductSchema).optional().describe('A list of products. Each product object should contain item_code, name, quantity, price.'),
  totalPrice: z.number().nullable().optional().describe('The total amount of the invoice. If not found or cannot be determined, return null.'),
  currency: z.string().nullable().optional().describe('The currency code for monetary values (e.g., EUR, RON, USD). Return null if not clearly identifiable. Prioritize RON if supplier is from Romania and currency is ambiguous.'),
  documentLanguage: z.string().nullable().optional().describe("The primary language of the document as a two-letter code (e.g., 'ro', 'en', 'de'). Return null if not clearly identifiable. Default to 'ro' if supplier is from Romania and language is ambiguous."),
});
export type ExtractInvoiceOutput = z.infer<typeof ExtractInvoiceOutputSchema>;

const extractInvoicePrompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: { schema: ExtractInvoiceInputSchema },
  output: { schema: ExtractInvoiceOutputSchema },
  prompt: `You are an expert data extraction AI. Your task is to analyze the provided PDF invoice and extract key information.

Please extract the following general invoice details:
- Invoice issue date (as 'date').
- Supplier name (as 'supplier').
- The total invoice amount (as 'totalPrice', ensure this is a number or null).
- The currency used for all monetary values (as 'currency', e.g., EUR, RON, USD). If not clearly identifiable, return null. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON.
- The primary language of the document (as 'documentLanguage', a two-letter code e.g., 'ro', 'en', 'de'). If not clearly identifiable, return null. If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'.
- Invoice number, if clearly identifiable. (The system will attempt to use this information, though it's not a primary schema field for now).

For the 'products' array, which should contain a list of all product or service line items:
For EACH distinct product or service line item found on the invoice, you MUST extract an object with the following fields if available:
- 'item_code': The article number, SKU, Artikelnummer, Bestellnummer, Art.-Nr., or any unique product identifier found on the line item.
- 'name': The product's name, description, Artikelbezeichnung, Produktbezeichnung, or item description.
- 'quantity': The number of units for the item (e.g., Menge, Anzahl, Qty, Stk). This MUST be a number. If you find a quantity, always try to parse it as a number.
- 'price': The unit price of the item (e.g., Einzelpreis, Preis pro Einheit, Unit Price, Preis). This MUST be a number.

It is crucial to identify each line item accurately. Look for repeating patterns that denote product entries. Examine table structures carefully.
If a value for one of these fields (item_code, name, quantity, price) is not found for a specific line item after careful searching, you may set its value to null in that product's object.
Prioritize finding values for 'item_code', 'name', and 'quantity'.

If no products are listed on the invoice, or if you cannot extract any of these details for any line, the 'products' field in your output should be an empty array: []. Do NOT return an array of empty objects if no data can be extracted.

You may be provided with 'lineItemColumns' (e.g. {{#if lineItemColumns}}{{#each lineItemColumns}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}{{else}}['some', 'custom', 'columns']{{/if}}) as a general HINT to understand the type of information the user is ultimately interested in. However, your primary task for product extraction is to populate the 'item_code', 'name', 'quantity', and 'price' fields for each product object as described above. The 'lineItemColumns' hint should NOT change the structure of the product objects you return; they must always aim to have item_code, name, quantity, and price.

General instructions for product extraction:
- Do not skip any product rows, even if some fields are missing or values are ambiguous.
- Look for rows that follow patterns such as: article number/SKU, product name, quantity, unit price, total price.
- Never summarize or merge product rows. Return them individually, as listed.
- If the layout is irregular or products are not clearly marked, still attempt to infer product rows based on repeated formatting, visual grouping, or contextual clues.

Ensure that all extracted monetary values (product prices, total price) are consistent with the identified currency. Do not convert amounts.
Format your response strictly according to the provided output schema (top-level fields: date, supplier, products, totalPrice, currency, documentLanguage).

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
    return output!;
  }
);

export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput | null> {
  const result = await extractInvoiceDataFlow(input);
  return result;
}

