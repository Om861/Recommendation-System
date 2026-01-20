import { products } from '../data/products'

const defaultGroqModel = 'llama-3.3-70b-versatile'
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || defaultGroqModel

const productDigest = products
  .map(
    (product) =>
      `${product.id}: ${product.name} (${product.category}) - $${product.price}. Tags: ${product.tags.join(', ')}`,
  )
  .join('\n')

const systemPrompt = `You help shoppers pick items from an existing catalog.
Return strict JSON in this shape:
{
  "summary": "one sentence on why the picks fit the request",
  "recommendations": [
    {"id": "p-001", "reason": "short reason tied to the user request"}
  ]
}
Pick up to 3 unique ids from the catalog.`

const extractJson = (content) => {
  if (!content) return null

  try {
    return JSON.parse(content)
  } catch (_error) {
    const maybeJson = content.match(/\{[\s\S]*\}/)?.[0]
    if (!maybeJson) return null
    try {
      return JSON.parse(maybeJson)
    } catch {
      return null
    }
  }
}

const fallbackFilter = (preference, reason = 'no-match') => {
  const text = preference.toLowerCase()
  const priceMatch = text.match(/(?:under|below|less than|\$)(\d{2,5})/)
  const budget = priceMatch ? Number(priceMatch[1]) : null

  const keywords = text
    .replace(/[^a-z0-9\s-/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const scored = products
    .map((product) => {
      const haystack = `${product.name} ${product.category} ${product.tags.join(' ')}`.toLowerCase()
      const keywordScore = keywords.reduce(
        (total, keyword) => (haystack.includes(keyword) ? total + 1 : total),
        0,
      )
      const priceScore = budget ? (product.price <= budget ? 1 : -1) : 0
      return {
        product,
        score: keywordScore * 2 + priceScore,
      }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return {
    matchedProducts: scored.map(({ product }) => ({
      ...product,
      reason: 'Best local match based on your keywords and budget.',
    })),
    summary: scored.length
      ? 'Showing the closest matches directly from the local catalog.'
      : 'No strong local matches. Try describing the category, price, or key features.',
    aiSource: false,
    meta: {
      source: 'local',
      reason,
    },
  }
}

export const getRecommendations = async (preference) => {
  const trimmed = preference.trim()
  if (!trimmed) {
    return {
      matchedProducts: [],
      summary: 'Share what you are shopping for (price, category, must-have features).',
      aiSource: false,
      meta: { source: 'local', reason: 'empty-query' },
    }
  }

  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    console.warn('[Groq] Missing VITE_GROQ_API_KEY. Falling back to local filtering.')
    return fallbackFilter(trimmed, 'missing-api-key')
  }

  try {
    console.info('[Groq] Calling model', GROQ_MODEL)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Catalog:
${productDigest}

User request: "${trimmed}"`,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('Groq API error', await response.text())
      return fallbackFilter(trimmed, 'api-error')
    }

    const payload = await response.json()
    const messageContent = payload?.choices?.[0]?.message?.content
    const parsed = extractJson(messageContent)

    if (!parsed?.recommendations?.length) {
      return fallbackFilter(trimmed, 'no-ai-matches')
    }

    const selectedIds = parsed.recommendations.map((item) => item.id)
    const matchedProducts = products.filter((product) => selectedIds.includes(product.id))
    const hasMatches = matchedProducts.length > 0

    if (!hasMatches) {
      return fallbackFilter(trimmed, 'id-mismatch')
    }

    const reasons = Object.fromEntries(
      parsed.recommendations.map((item) => [item.id, item.reason ?? 'Fits your criteria.']),
    )

    return {
      matchedProducts: matchedProducts.map((product) => ({
        ...product,
        reason: reasons[product.id],
      })),
      summary: parsed.summary ?? 'Here are tailored picks from the catalog.',
      aiSource: true,
      meta: {
        source: 'groq',
        model: payload?.model ?? GROQ_MODEL,
        requestId: payload?.id ?? null,
      },
    }
  } catch (error) {
    console.error('Groq integration failed', error)
    return fallbackFilter(trimmed, 'network-error')
  }
}

