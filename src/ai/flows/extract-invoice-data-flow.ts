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

Please extract the following details:
- Invoice issue date. If not found, it can be omitted.
- Supplier name. If not found, it can be omitted.
- A list of line items (products or services), including their name, quantity, and unit price. If unit price is not found, it can be omitted from the product item. If no products are listed, the 'products' field can be omitted.
- The total invoice amount. If the total amount is not explicitly stated or cannot be reliably determined, return null for totalPrice.
- The currency used for all monetary values (e.g., EUR, RON, USD). If multiple currencies are present for line items vs total, prioritize the currency of the total amount. If the supplier seems to be from Romania and the currency is ambiguous or not explicitly stated, assume RON. If no currency is clearly identifiable otherwise, return null for currency.
- The primary language of the document (e.g., 'ro' for Romanian, 'en' for English, 'de' for German). If the supplier seems to be from Romania and the language is ambiguous, assume 'ro'. If no language is clearly identifiable otherwise, return null for documentLanguage.

Ensure that all extracted monetary values (product prices, total price) are consistent with the identified currency. Do not convert amounts.

Format your response strictly according to the provided output schema. If a field is optional and the information is not found or applicable, you may omit the field or set it to null if the schema allows (e.g. for totalPrice, currency, documentLanguage).

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
