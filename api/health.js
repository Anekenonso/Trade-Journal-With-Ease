// Vercel serverless function: reports whether the secure AI review backend is
// available, without ever exposing the key. The frontend polls this to decide
// between "secure-ai" and "local-only" modes.
export default function handler(_req, res) {
  const enabled = Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
  return res.status(200).json({
    aiReviewEnabled: enabled,
    mode: enabled ? 'secure-ai' : 'local-only',
  });
}
