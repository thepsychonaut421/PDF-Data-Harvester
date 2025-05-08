# **App Name**: PDF Data Harvester

## Overview
The PDF Data Harvester is a web application designed to extract structured data from multiple PDF invoices efficiently. It leverages AI models for data extraction, provides a user-friendly interface for managing and validating data, and exports the results into a configurable CSV format suitable for ERP systems.

## 1. Frontend Features

### 1.1. PDF Upload Interface
-   **Multiple File Upload:** Users can upload multiple PDF files simultaneously via a drag-and-drop interface.
-   **Bulk Processing:** Uploaded files are queued for batch processing.

### 1.2. Extraction Template Selector
-   **Dropdown Menu:** Users can select an extraction template from a dropdown list (e.g., "Standard," "Avansat").
-   **Template-Specific Extraction:** The selected template dictates the fields to be extracted and their mapping.

### 1.3. Real-time File Status Dashboard
-   **Live Updates:** The interface displays the status of each uploaded file in real-time.
-   **Status Categories:**
    -   `În curs` (Processing): File is currently being processed by the backend.
    -   `Procesat` (Processed): File has been successfully processed, and data is extracted.
    -   `Nevalidat` (Unvalidated): File processed, but data may require user review or failed automated validation checks.
    -   `În eroare` (Error): Processing failed for the file (e.g., corrupted PDF, extraction failure after fallbacks).

### 1.4. CSV Export Functionality
-   **Export Button:** A dedicated "Exportă CSV" button initiates the CSV generation process.
-   **Detailed Format:** The CSV is generated in a "detailed" format, including individual product line items (not just a summary).
-   **Automatic Generation:** The CSV file is generated automatically based on successfully processed and validated data.

### 1.5. Configurable CSV Columns
-   **Standard Columns:** The CSV export will include the following configurable columns for product lines:
    -   `Artikelnummer` (Item Number)
    -   `Artikelbezeichnung` (Item Description)
    -   `Menge` (Quantity)
    -   `Einzelpreis` (Unit Price)
    -   `Gesamtpreis` (Total Price)
-   **Invoice Details:** General invoice details (date, number, supplier) will also be included.

## 2. Backend Logic (Genkit + Firebase Functions)

### 2.1. Invoice Processing Workflow
-   **Trigger:** Upon PDF upload, each file is sent to a Genkit flow named `extractInvoiceDataFlow`.
-   **Orchestration:** This flow manages the data extraction process, including AI calls and fallbacks.

### 2.2. Primary Data Extraction (LLM: Gemini 1.5 Pro)
-   **AI Model:** The primary extraction mechanism uses a Large Language Model (Gemini 1.5 Pro).
-   **Data Points:** The LLM is prompted to extract:
    -   **Invoice Details:** Date of issue, invoice number, supplier name.
    -   **Product Line Items:** Details for each product/service, mapped according to the selected extraction template's column definitions.

### 2.3. OCR Fallback Mechanism
-   **Condition:** If a PDF contains no selectable text (e.g., image-based PDF) or if the LLM fails to extract meaningful data.
-   **Tool:** Google Cloud Vision API OCR is used as a fallback to extract raw text from the PDF.
-   **Re-processing:** The extracted OCR text (if any) might be re-submitted to the LLM or parsed using heuristic methods.

### 2.4. Data Storage (Firestore)
-   **`parsed_invoices` Collection:**
    -   Stores successfully extracted and parsed data from invoices.
    -   Each document represents an invoice and includes its extracted details and line items.
-   **`invoices_failed` Collection:**
    -   Stores records of invoices that failed processing (after all attempts, including OCR fallback).
    -   Includes the error message and a preview of any text extracted by OCR to aid in debugging.

## 3. Data Schemas & Templates

### 3.1. Extraction Templates
-   **JSON Format:** Extraction templates are defined in JSON files (e.g., `Standard.json`, `Avansat.json`).
-   **Content:** Each template specifies the fields to be extracted, their data types, and any specific instructions or keywords for the LLM related to those fields.
-   **Location:** Stored in the `/schemas/` directory.

## 4. Export Rules & Format

### 4.1. CSV Generation
-   **Trigger:** Initiated by the "Exportă CSV" button on the frontend.
-   **Data Aggregation:** Combines data from the `parsed_invoices` collection for all files that meet the inclusion criteria.
-   **Formatting:** Data is formatted into a CSV structure compatible with Excel and common ERP systems like ERPNext.

### 4.2. Data Inclusion Criteria
-   **Status Filter:** Only files with a status indicating successful processing and validation (e.g., `Procesat`, or a specific "validated" status if implemented) are included in the export.
-   **Exclusion:** Files with status `nevalidat` (unvalidated) or `în eroare` (error) are **not** included in the CSV export.

### 4.3. Download Mechanism
-   **Direct Download:** The generated CSV file is offered as a direct download in the user's browser.

## 5. File and Folder Structure

-   **`/src/app/`**: Contains the frontend application code (Next.js, TypeScript, Tailwind CSS, Firebase SDK).
    -   Components for UI elements (upload, dashboard, selectors).
    -   Services for interacting with Firebase.
-   **`/functions/`**: Contains backend logic deployed as Firebase Cloud Functions.
    -   Genkit `extractInvoiceDataFlow`.
    -   HTTP triggers for file processing and export.
    -   OCR fallback implementation.
-   **`/schemas/`**: Contains JSON definitions for each extraction template (e.g., `Standard.json`, `Avansat.json`).
-   **`/utils/`**: Contains utility functions shared across the application.
    -   CSV generation logic.
    -   Data validation functions.
    -   Helper functions for Firestore interactions.

## 6. Fallback and Validation Logic

### 6.1. LLM Extraction Fallback
-   **Primary Method:** Gemini 1.5 Pro for structured data extraction.
-   **Fallback Trigger:** If the LLM fails to return structured data or if the PDF is image-based (no embedded text).
-   **Fallback Action:** The system automatically invokes Google Cloud Vision API OCR to extract raw text. This text can then be re-processed or presented to the user.

### 6.2. Data Validation and Statuses
-   **Post-Extraction Validation:** Extracted data undergoes basic validation checks (e.g., date formats, numeric values for prices/quantities).
-   **File Statuses:**
    -   `în curs`: Actively being processed.
    -   `procesat`: AI extraction successful, basic validation passed.
    -   `nevalidate`: Data extracted but requires user confirmation or failed more complex validation rules. This status prevents inclusion in export until resolved.
    -   `în eroare`: All extraction attempts (LLM and OCR) failed, or critical data is missing/malformed.

### 6.3. Error Handling and Logging
-   **`invoices_failed` Collection:** Detailed error messages and any available OCR previews are logged in this Firestore collection for troubleshooting.
-   **User Feedback:** The frontend clearly indicates files that are in an error state.

## 7. Key Technical Requirements

### 7.1. Firebase Integration
-   **Firestore:** Used for storing extracted invoice data, failed invoice logs, and potentially user configurations or templates.
-   **Firebase Functions:** Hosts the backend Genkit flows, OCR logic, and CSV export functionality.
-   **Firebase Storage:** Used for temporarily storing uploaded PDF files before processing. (Assumed, good practice)

### 7.2. Code Quality
-   **Comments:** Code should be well-commented to explain logic, especially for complex parts like AI prompting and data transformations.
-   **Clarity:** Code should be clearly structured and maintainable.
-   **Modularity:** Break down functionalities into reusable modules/functions.

## 8. Future Extensibility

-   **Plug-and-Play Templates:** Design the system so that new extraction templates (JSON schemas) can be added easily without requiring significant code changes.
-   **Multi-Language Support:**
    -   Frontend interface localization.
    -   Ability for the LLM to handle invoices in multiple languages, potentially guided by template settings or language detection.
-   **Custom CSV Formats:** Allow users to define or select different CSV export structures or mappings.
-   **Additional Data Fields:** Easily extend the schemas and processing logic to include more data fields from invoices.
-   **Advanced Validation Rules:** Implement more sophisticated, configurable validation rules for extracted data.
-   **User-Driven Validation UI:** Enhance the UI to allow users to easily correct or validate data flagged as `nevalidat`.

## 9. Style Guidelines

-   **Primary color**: A clean white or light gray for the background to ensure readability.
-   **Secondary color**: A calming blue (#3498db) for headers and primary actions.
-   **Accent colors**:
    -   Green (#2ecc71) to indicate successfully parsed/validated data.
    -   Red (#e74c3c) to flag PDFs requiring validation or in an error state.
    -   Yellow/Orange for "in progress" or "unvalidated" states.
-   **Layout**: Use a grid-based layout for the data dashboard to organize extracted information clearly.
-   **Icons**: Employ simple, recognizable icons for actions like upload, edit, export, and status indicators.
