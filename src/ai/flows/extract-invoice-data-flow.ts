'use server';
/**
 * @fileOverview An AI flow for extracting structured data from PDF invoices.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// Product type is used in ExtractInvoiceOutput, so it's fine to export its type if needed by consumers of ExtractInvoiceOutput
// However, if it's only used internally or as part of ExtractInvoiceOutput, it might not need to be exported itself.
// For now, keeping it as it might be useful.
// import type { Product } from '@/lib/types'; // This was commented out, assuming ProductSchema is the source of truth here.


const ProductSchema = z.object({
  name: z.string().describe('Name of the product or service.'),
  quantity: z.number().describe('Quantity of the product or service.'),
  price: z.number().optional().describe('Unit price of the product or service.'),
});
export type InvoiceProduct = z.infer<typeof ProductSchema>;

const ExtractInvoiceInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file represented as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

const ExtractInvoiceOutputSchema = z.object({
  date: z.string().optional().describe('The invoice issue date (e.g., YYYY-MM-DD).'),
  supplier: z.string().optional().describe('The name of the supplier or vendor.'),
  products: z.array(ProductSchema).optional().describe('A list of products or services line items.'),
  totalPrice: z.number().optional().describe('The total amount of the invoice.'),
  currency: z.string().optional().describe('The currency code for monetary values (e.g., EUR, RON, USD). Return null if not clearly identifiable. Prioritize RON if supplier is from Romania and currency is ambiguous.'),
  documentLanguage: z.string().optional().describe("The primary language of the document as a two-letter code (e.g., 'ro', 'en', 'de'). Return null if not clearly identifiable. Default to 'ro' if supplier is from Romania and language is ambiguous."),
});
export type ExtractInvoiceOutput = z.infer<typeof ExtractInvoiceOutputSchema>;

const extractInvoicePrompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: { schema: ExtractInvoiceInputSchema },
  output: { schema: ExtractInvoiceOutputSchema },
  prompt: `You are an expert data extraction AI. Your task is to analyze the provided PDF invoice and extract key information.

Please extract the following details:
- Invoice issue date.
- Supplier name.
- A list of line items (products or services), including their name, quantity, and unit price. If unit price is not found, it can be omitted.
- The total invoice amount.
- The currency used for all monetary values (e.g., EUR, RON, USD). If multiple currencies are present for line items vs total, prioritize the currency of the total amount. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON. If no currency is clearly identifiable otherwise, return null for currency.
- The primary language of the document (e.g., 'ro' for Romanian, 'en' for English, 'de' for German). If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'. If no language is clearly identifiable otherwise, return null for documentLanguage.

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
    // The ProductSchema in Zod already defines price as optional.
    // Genkit will handle this based on the schema.
    // If the AI doesn't return a price, it will be undefined in the output object.
    // The UI consuming this should handle cases where price might be undefined.
    return output!;
  }
);

export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput | null> {
  const result = await extractInvoiceDataFlow(input);
  return result;
}
