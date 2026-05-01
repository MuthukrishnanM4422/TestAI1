/* ═══════════════════════════════════════════════════════════════
   BRD Test Case Generator — Enhanced server.js
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

// ── Request logger ────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Groq models allowed ───────────────────────────────────────
const ALLOWED_MODELS = new Set([
  'llama-3.1-8b-instant',       // Fast, production
  'llama-3.3-70b-versatile',    // Best quality, production
  'meta-llama/llama-4-scout-17b-16e-instruct',   // Preview
  'meta-llama/llama-4-maverick-17b-128e-instruct', // Preview
  'qwen/qwen-3-32b',            // Preview
]);

// ── POST /api/generate ────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error('GROQ_API_KEY is not set in .env');
    return res.status(500).json({ error: 'Server misconfiguration: missing GROQ_API_KEY.' });
  }

  const { messages, model, temperature } = req.body;

  // Validate request body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request must include a non-empty messages array.' });
  }

  const selectedModel = ALLOWED_MODELS.has(model) ? model : 'llama-3.3-70b-versatile';
  const selectedTemp  = typeof temperature === 'number'
    ? Math.max(0, Math.min(1, temperature))
    : 0.3;

  console.log(`  → Model: ${selectedModel}  Temp: ${selectedTemp}`);

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model:       selectedModel,
        messages,
        temperature: selectedTemp,
        max_tokens:  4096,
        // Ask for JSON output
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', groqRes.status, errText);

      // Surface user-friendly messages for common codes
      const msg = groqRes.status === 429
        ? 'Rate limit reached. Please wait a moment and try again.'
        : groqRes.status === 401
        ? 'Invalid Groq API key. Check your .env file.'
        : `Groq API error (${groqRes.status}).`;

      return res.status(groqRes.status).json({ error: msg });
    }

    const data = await groqRes.json();

    // Log token usage
    if (data.usage) {
      console.log(
        `  ← Tokens: prompt=${data.usage.prompt_tokens}` +
        ` completion=${data.usage.completion_tokens}` +
        ` total=${data.usage.total_tokens}`
      );
    }

    return res.json(data);

  } catch (err) {
    // Network errors (Groq unreachable, DNS, etc.)
    console.error('Server error calling Groq:', err.message);
    return res.status(502).json({ error: 'Could not reach Groq API. Check your internet connection.' });
  }
});

// ── GET /api/health ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status:   'ok',
    keySet:   !!process.env.GROQ_API_KEY,
    models:   [...ALLOWED_MODELS],
    uptime:   Math.floor(process.uptime()),
  });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ⬡  BRD Test Case Generator');
  console.log(`  ✅  Server running at http://localhost:${PORT}`);
  console.log(`  🔑  GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'set ✓' : 'NOT SET ✗'}`);
  console.log('');
});
