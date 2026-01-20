import { useMemo, useState } from "react";
import "./App.css";
import { products } from "./data/products";
import { getRecommendations } from "./services/recommendationService";

const initialSummary =
  "Describe what you are shopping for (budget, brand vibes, must-have features) and let Groq shortlist the best matches.";

const initialMeta = {
  source: "local",
  reason: "init",
  model: null,
  requestId: null,
};

const quickPrompts = [
  `Need a phone under $500 with great battery`,
  `Best laptop under $1200 for students`,
  `Wireless earbuds for gym with ANC`,
  `Flagship phone with best camera`,
  `Smartwatch with GPS & sleep tracking`,
];

function App() {
  const [preference, setPreference] = useState("");
  const [recommended, setRecommended] = useState([]);
  const [summary, setSummary] = useState(initialSummary);
  const [status, setStatus] = useState("idle");
  const [aiSource, setAiSource] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [meta, setMeta] = useState(initialMeta);

  const recommendedIds = useMemo(
    () => new Set(recommended.map((product) => product.id)),
    [recommended]
  );

  const reasonById = useMemo(
    () => Object.fromEntries(recommended.map((product) => [product.id, product.reason])),
    [recommended]
  );

  const orderedProducts = useMemo(() => {
    const highlighted = [];
    const remaining = [];

    products.forEach((product) => {
      if (recommendedIds.has(product.id)) highlighted.push(product);
      else remaining.push(product);
    });

    return [...highlighted, ...remaining];
  }, [recommendedIds]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!preference.trim()) return;

    setStatus("loading");
    setSummary("Thinking... 🔥");

    try {
      const result = await getRecommendations(preference);
      setRecommended(result.matchedProducts);
      setSummary(result.summary);
      setAiSource(result.aiSource);
      setMeta(result.meta ?? initialMeta);
      setLastQuery(preference);
    } catch (error) {
      console.error(error);
      setSummary("Something went wrong. Please try again.");
      setMeta({ source: "local", reason: "ui-error", model: null, requestId: null });
    } finally {
      setStatus("idle");
    }
  };

  const handleReset = () => {
    setPreference("");
    setRecommended([]);
    setSummary(initialSummary);
    setStatus("idle");
    setAiSource(false);
    setLastQuery("");
    setMeta(initialMeta);
  };

  const statusLabel = aiSource
    ? `AI via Groq${meta?.model ? ` (${meta.model})` : ""}`
    : "Local catalog search";

  const statusNoteMap = {
    "missing-api-key": "Add VITE_GROQ_API_KEY (and restart dev server) to use the Groq model.",
    "network-error": "Network issue while reaching Groq. Check the console for details.",
    "api-error": "Groq returned an error. Inspect the console/logs.",
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">✨ AI Catalog Concierge</p>
        <h1>Product recommendations powered by Groq</h1>
        <p className="lede">
          We keep a curated list of gadgets and ask an LLM to match them to your request. Tell us your
          constraints and we will highlight the best options.
        </p>
      </header>

      <section className="panel">
        <form className="preference-form" onSubmit={handleSubmit}>
          <label htmlFor="preference-input">Your shopping brief</label>

          <div className="input-row">
            <input
              id="preference-input"
              type="text"
              placeholder='e.g. "Need a lightweight laptop under $1200 for photo editing"'
              value={preference}
              onChange={(event) => setPreference(event.target.value)}
            />

            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Scouting..." : "Ask Groq"}
            </button>

            <button
              type="button"
              className="reset-btn"
              onClick={handleReset}
              disabled={status === "loading"}
            >
              Reset
            </button>
          </div>

          {/* ✅ Quick prompts */}
          <div className="quick-prompts">
            {quickPrompts.map((text) => (
              <button
                key={text}
                type="button"
                className="prompt-chip"
                onClick={() => setPreference(text)}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="form-foot">
            <span className={`status-pill ${aiSource ? "ai" : "fallback"}`}>{statusLabel}</span>

            {lastQuery && <span className="last-query">Last query: “{lastQuery}”</span>}

            {!aiSource && statusNoteMap[meta?.reason] && (
              <span className="status-note">{statusNoteMap[meta.reason]}</span>
            )}

            {aiSource && meta?.requestId && (
              <span className="status-note">Groq request id: {meta.requestId}</span>
            )}
          </div>
        </form>

        <p className={`summary ${status === "loading" ? "pulse" : ""}`}>{summary}</p>
      </section>

      <section>
        <div className="products-grid fadeIn">
          {status === "loading" ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-card"></div>
              ))}
            </>
          ) : orderedProducts.length ? (
            orderedProducts.map((product) => {
              const highlighted = recommendedIds.has(product.id);
              const reason = reasonById[product.id] ?? 'Tap "Ask Groq" to see why this could fit.';

              return (
                <article
                  key={product.id}
                  className={`product-card ${highlighted ? "highlighted" : ""}`}
                >
                  <div className="product-media">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        if (
                          product.fallbackImage &&
                          event.currentTarget.src !== product.fallbackImage
                        ) {
                          event.currentTarget.src = product.fallbackImage;
                        }
                      }}
                    />
                    {highlighted && <span className="badge">🔥 Recommended</span>}
                  </div>

                  <div className="product-body">
                    <div>
                      <p className="product-category">{product.category}</p>
                      <h3>{product.name}</h3>
                    </div>

                    <p className="product-description">{product.description}</p>

                    <div className="product-meta">
                      <span className="price">${product.price}</span>
                      <div className="tags">
                        {product.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="reason">{reason}</p>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <h2>No products found</h2>
              <p>Try another query like: <b>“phone under $500 with battery”</b></p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
