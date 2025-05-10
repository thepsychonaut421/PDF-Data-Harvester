# PDF Data Harvester

A Next.js application built in Firebase Studio for extracting line‑item data from invoice PDFs and formatting it as CSV ready for import into ERPNext.

## Features

* **Upload & Process**: Drag & drop invoice PDFs and run AI‑driven extraction.
* **Configurable Export Templates**: Choose or fix the export template to match ERPNext's import schema.
* **CSV Export**: Generate CSV with exactly the columns `Artikel-Code`, `Artikelname`, `Artikelgruppe`, `Standardmaßeinheit`.
* **Data Cleaning**: Automatic trimming of whitespace, removal of newlines/tab characters, and filtering non‑numeric codes.
* **Static Fields**: Automatically append `Artikelgruppe: Produkte` and `Standardmaßeinheit: Stk`.
* **Sorting**: Output sorted by `Artikel-Code` ascending.

## Prerequisites

* Node.js >= 18
* Firebase CLI & account
* Firebase Studio enabled

## Installation

1. Clone the repo:

   ```bash
   git clone https://github.com/thepsychonaut421/PDF-Data-Harvester.git
   cd PDF-Data-Harvester
   ```
2. Install dependencies:

   ```bash
   npm install
   ```
3. Login to Firebase:

   ```bash
   firebase login
   ```
4. Initialize or connect to your Firebase project:

   ```bash
   firebase init
   ```

## Usage

1. In Firebase Studio, open the **PDF Data Harvester** app.
2. **Upload PDFs**: Drag invoice PDFs into the upload area and click **Încarcă și Proce­sează**.
3. **Select Extract Template**:

   * Use **Comprehensive Details (Upload)** for AI‑driven line extraction.
4. **Configure Export**:

   * Set **Format Export Produse** to **Detaliat (Fiecare produs pe rând nou)**.
   * Choose the **ERPNext Export (Fixed: Artikel‑Code, Artikelname, Produkte, Stk)** template under **Șablon Coloane Produse**.
   * Click **Coloane Export** and select only **Produs: Cod Articol** and **Produs: Nume**, renaming them to `Artikel-Code` and `Artikelname`.
5. **Export CSV**: Hit **Exportă CSV (ERPNext)** to download a clean, ready‑to‑import CSV.

## Configuration Tips

* **Whitespace & Newlines**: The export pipeline automatically replaces `\n`, `\r`, or tabs with a single space and collapses multiple spaces.
* **Filtering**: Only lines where `item_code` is purely numeric are included.
* **Sorting**: The CSV is sorted by `Artikel-Code` ascending.
* **Delimiter & Encoding**: The file is UTF‑8 (no BOM) with comma separators.

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/YourFeature`.
3. Commit your changes: `git commit -m "Add cool feature"`.
4. Push to the branch: `git push origin feature/YourFeature`.
5. Open a Pull Request.

## License

MIT © thepsychonaut421
