# PDF Data Harvester

A web application that extracts structured data from PDF invoices and exports it to CSV for seamless import into ERP systems like ERPNext.

Built with Next.js, Firebase Studio and GenKit AI for advanced PDF parsing and data transformation.

---

## 🚀 Features

* **AI‑powered extraction**: Use GenKit AI to identify and harvest invoice fields (invoice number, dates, supplier, totals).
* **Customizable templates**: Define and manage extraction/export templates for different invoice layouts.
* **CSV export**: Export detailed or summarized CSV files ready for ERPNext import.
* **Batch processing**: Upload multiple PDFs and process them in bulk.
* **Validation & cleaning**: Trim whitespace, normalize spacing, filter numeric codes, and ensure CSV columns match ERPNext requirements.
* **Clear‑all**: Quickly reset uploads and templates.

---

## 📦 Prerequisites

* Node.js ≥ 18
* npm (or Yarn)
* A Firebase project (for hosting and Firestore)
* GenKit AI credentials (Google AI key)

---

## ⚙️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/thepsychonaut421/PDF-Data-Harvester.git
   cd PDF-Data-Harvester
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or yarn install
   ```

3. **Configure environment variables**
   Copy `.env.example` to `.env` and fill in your keys:

   ```bash
   cp .env.example .env
   ```

   ```ini
   NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
   FIREBASE_PROJECT_ID=your-project-id
   GENKIT_GOOGLE_AI_KEY=your-google-ai-key
   ```

---

## 🛠️ Development

* **Start the dev server**

  ```bash
  npm run dev
  # opens at http://localhost:3000
  ```

* **GenKit AI dev watchers**

  ```bash
  npm run genkit:dev      # run AI-powered development server
  npm run genkit:watch    # AI prompt watcher
  ```

---

## 🔨 Building & Production

* **Build**

  ```bash
  npm run build
  ```

* **Preview production build**

  ```bash
  npm start
  ```

* **Deploy to Firebase Hosting**

  ```bash
  firebase deploy
  ```

---

## 📐 Folder Structure

```
├── src/
│   ├── ai/              # GenKit AI prompts and handlers
│   ├── components/      # UI components (Radix, Tailwind)
│   ├── lib/             # Types, utils, API wrappers
│   ├── pages/           # Next.js pages (app router)
│   └── styles/          # Global styles & Tailwind config
├── public/              # Static assets
├── docs/                # Design docs & wireframes
├── .env.example         # Sample environment variables
├── next.config.ts       # Next.js config (allowedDevOrigins, images)
├── tailwind.config.ts   # Tailwind CSS config
└── package.json         # Scripts & dependencies
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/foo`)
3. Commit your changes (`git commit -m "feat: add foo"`)
4. Push to the branch (`git push origin feature/foo`)
5. Open a Pull Request

Please adhere to the existing code style and run `npm run lint` and `npm run typecheck` before submitting.

---

## 📝 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
