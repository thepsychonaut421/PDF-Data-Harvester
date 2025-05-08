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
  name: z.string().optional().describe('The name or description of the product/service (e.g., "Artikelbezeichnung"). This should be populated if a template column maps to it or by default.'),
  quantity: z.number().optional().describe('The quantity of the product/service (e.g., "Menge"). This should be populated if a template column maps to it or by default.'),
  price: z.number().optional().describe('The unit price of the product/service (e.g., "Einzelpreis"). This should be populated if a template column maps to it or by default.'),
}).catchall(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).describe( // Allow undefined for omitted custom fields
  "Represents a single product or line item from the invoice. Contains standard fields (name, quantity, price) that should be populated if possible, and any custom fields based on the extraction template columns. Keys for custom fields must match the provided lineItemColumns."
);
export type InvoiceProduct = z.infer<typeof ProductSchema>;

const ExtractInvoiceInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file represented as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  lineItemColumns: z.array(z.string()).optional().describe("An array of desired column names for product line items (e.g., ['Artikelnummer', 'Artikelbezeichnung', 'Menge']). If provided, the AI will use these as keys in the 'products' output objects and try to populate standard 'name', 'quantity', 'price' fields if semantically applicable."),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

const ExtractInvoiceOutputSchema = z.object({
  date: z.string().optional().describe('The invoice issue date (e.g., YYYY-MM-DD).'),
  supplier: z.string().optional().describe('The name of the supplier or vendor.'),
  products: z.array(ProductSchema).optional().describe('A list of products or services line items. Each item is an object potentially containing custom keys from lineItemColumns and standard keys like name, quantity, price.'),
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
- Invoice issue date. If not found, it can be omitted.
- Supplier name. If not found, it can be omitted.
- The total invoice amount. If the total amount is not explicitly stated or cannot be reliably determined, return null for totalPrice.
- The currency used for all monetary values (e.g., EUR, RON, USD). If multiple currencies are present for line items vs total, prioritize the currency of the total amount. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON. If no currency is clearly identifiable otherwise, return null for currency.
- The primary language of the document (e.g., 'ro' for Romanian, 'en' for English, 'de' for German). If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'. If no language is clearly identifiable otherwise, return null for documentLanguage.

For the 'products' array, each item in this array should be an object representing a single product or line item.
{{#if lineItemColumns}}
You have been provided with specific 'lineItemColumns': {{#each lineItemColumns}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}.
For each product/line item, you MUST create an object where the keys are EXACTLY these 'lineItemColumns'.
For example, if lineItemColumns is ['Artikelnummer', 'Bezeichnung', 'Menge'], a product item MUST look like: { "Artikelnummer": "ART123", "Bezeichnung": "Product X", "Menge": 5.0 }.
If a value for a requested column (from 'lineItemColumns') is not found on a line item, you MUST include the key in the product object with a value of null. DO NOT OMIT THE KEY.

In addition to these custom columns (which are primary):
- If a column from 'lineItemColumns' (e.g., 'Artikelbezeichnung', 'Bezeichnung', 'Descriere Produs', or 'Product Description') semantically matches a product's name/description, its value MUST also be populated in a separate standard 'name' field in the product object.
- If a column from 'lineItemColumns' (e.g., 'Menge', 'Anzahl', 'Cantitate', or 'Quantity') semantically matches a product's quantity, its value MUST also be populated in a separate standard 'quantity' field (ensure it's a number). If the value is not numeric, attempt to parse it or set 'quantity' to null.
- If a column from 'lineItemColumns' (e.g., 'Einzelpreis', 'Preis pro Einheit', 'Pret Unitar', or 'Unit Price') semantically matches a product's unit price, its value MUST also be populated in a separate standard 'price' field (ensure it's a number). If the value is not numeric, attempt to parse it or set 'price' to null.

The presence of these standard fields (name, quantity, price) is secondary. The primary structure of product objects MUST use the keys from 'lineItemColumns'. If a standard field does not have a corresponding semantic match in 'lineItemColumns', it can be omitted (unless 'lineItemColumns' itself directly contains 'name', 'quantity', or 'price', in which case they act as primary custom columns).
{{else}}
For each product/line item, extract 'name', 'quantity', and 'price' if available.
The product object should look like: { "name": "Product Name", "quantity": 1, "price": 10.99 }
If a value for name, quantity, or price is not found for a line item, you may set it to null in the product object.
{{/if}}
If no products are listed on the invoice, the 'products' field can be an empty array or omitted.

Ensure that all extracted monetary values (product prices, total price) are consistent with the identified currency. Do not convert amounts.
Format your response strictly according to the provided output schema.

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

    