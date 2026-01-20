# Product Recommendation Playground

Small React + Vite experience that showcases how to blend a curated product catalog with Groq’s LLM for natural-language recommendations.

## Start

```bash
npm install
npm run dev
```
Open http://localhost:5173/

## Configure the Groq API

1. Create an API key at [console.groq.com](https://console.groq.com/keys).
2. Add it to a `.env` file in the project root:

```
VITE_GROQ_API_KEY=your_key_here
# Optional: override the default llama-3.1-70b-versatile model
# VITE_GROQ_MODEL=mixtral-8x22b
```

3. Restart the dev server so Vite can pick it up.

If the key is missing or the Groq API is unavailable, the app gracefully falls back to a keyword/budget filter so you can still demo the UI.

## How it works

- `src/data/products.js` holds the sample curated catalog.
- `src/services/recommendationService.js` sends the catalog and the shopper’s prompt to Groq (default `llama-3.3-70b-versatile`) and expects JSON with product IDs and reasoning.
- `src/App.jsx` renders the UI, highlights the suggestions, and surfaces why each item was selected.

Feel free to adjust the catalog, prompt, and UI styling to fit other verticals or larger product sets.
