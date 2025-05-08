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
  quantity: z.number().optional().describe('The quantity of the product/service. Must be a number.'),
  price: z.number().optional().describe('The unit price of the product/service. Must be a number.'),
  amount: z.number().optional().describe('The total price for this line item (quantity * price). Must be a number, if available or calculable.'),
}).catchall(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).describe(
  "Represents a single product or line item from the invoice. Should contain item_code, name, quantity, unit price, and line item total amount where available."
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
  date: z.string().optional().describe('The invoice issue date (e.g., YYYY-MM-DD).'),
  supplier: z.string().optional().describe('The name of the supplier or vendor.'),
  products: z.array(ProductSchema).optional().describe('A list of products. Each product object should aim to contain item_code, name, quantity, price, and amount.'),
  totalPrice: z.number().nullable().optional().describe('The total amount of the invoice. This MUST be a number. If not found or cannot be determined, return null.'),
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
- The total invoice amount (as 'totalPrice', ensure this is a number. If not found, return null).
- The currency used for all monetary values (as 'currency', e.g., EUR, RON, USD). If not clearly identifiable, return null. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON.
- The primary language of the document (as 'documentLanguage', a two-letter code e.g., 'ro', 'en', 'de'). If not clearly identifiable, return null. If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'.

For the 'products' array, which should contain a list of all product or service line items:
For EACH distinct product or service line item found on the invoice, you MUST extract an object with the following fields if available:
- 'item_code': The article number, SKU, Artikelnummer, Bestellnummer, Art.-Nr., or any unique product identifier found on the line item.
- 'name': The product's name, description, Artikelbezeichnung, Produktbezeichnung, or item description.
- 'quantity': The number of units for the item (e.g., Menge, Anzahl, Qty, Stk). This MUST be a number. If you find a quantity, always parse it as a number.
- 'price': The unit price of the item (e.g., Einzelpreis, Preis pro Einheit, Unit Price, Preis). This MUST be a number.
- 'amount': The total price for THIS LINE ITEM (e.g., Gesamtpreis, Total, Betrag for the line). This MUST be a number. If it's not explicitly listed but quantity and unit price are, you can calculate it.

It is crucial to identify each line item accurately. Look for repeating patterns that denote product entries. Examine table structures carefully.
If a value for one of these fields (item_code, name, quantity, price, amount) is not found for a specific line item after careful searching, you may set its value to null or omit it in that product's object, but strive to include all. Quantity and Price are particularly important.

If no products are listed on the invoice, or if you cannot extract any of these details for any line, the 'products' field in your output should be an empty array: []. Do NOT return an array of empty objects if no data can be extracted.

You may be provided with 'lineItemColumns' (e.g. {{#if lineItemColumns}}{{#each lineItemColumns}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}{{else}}['some', 'custom', 'columns']{{/if}}) as a HINT to understand the type of information the user is ultimately interested in for mapping purposes. The AI should try to find values for columns named like those in 'lineItemColumns' AND populate them in the product object, IN ADDITION TO the standard 'item_code', 'name', 'quantity', 'price', and 'amount' fields. For example, if lineItemColumns includes 'Artikelgruppe', the AI should try to find 'Artikelgruppe' and include it in the product object if found, alongside the standard fields. The standard fields are always the priority.

General instructions for product extraction:
- Do not skip any product rows.
- Look for rows that follow patterns such as: article number/SKU, product name, quantity, unit price, line total.
- Never summarize or merge product rows. Return them individually.

Ensure that all extracted monetary values (product prices, line amounts, total invoice price) are consistent with the identified currency. Do not convert amounts.
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
    // Ensure totalPrice is a number or null
    if (output && typeof output.totalPrice !== 'number' && output.totalPrice !== null) {
        const parsedPrice = parseFloat(String(output.totalPrice));
        output.totalPrice = isNaN(parsedPrice) ? null : parsedPrice;
    }
    if (output && output.products) {
        output.products = output.products.map(p => {
            if (typeof p.quantity !== 'number' && p.quantity !== undefined && p.quantity !== null) {
                const pq = parseFloat(String(p.quantity));
                p.quantity = isNaN(pq) ? undefined : pq;
            }
            if (typeof p.price !== 'number' && p.price !== undefined && p.price !== null) {
                const pp = parseFloat(String(p.price));
                p.price = isNaN(pp) ? undefined : pp;
            }
            if (typeof p.amount !== 'number' && p.amount !== undefined && p.amount !== null) {
                const pa = parseFloat(String(p.amount));
                p.amount = isNaN(pa) ? undefined : pa;
            }
            // If amount is missing but quantity and price are present, calculate it
            if ((p.amount === undefined || p.amount === null) && typeof p.quantity === 'number' && typeof p.price === 'number') {
                p.amount = p.quantity * p.price;
            }
            return p;
        });
    }
    return output!;
  }
);

export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput | null> {
  const result = await extractInvoiceDataFlow(input);
  return result;
}

