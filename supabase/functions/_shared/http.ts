// The SDK calls these endpoints from any customer site, so CORS is open. None of them use
// cookies; the SDK endpoints only accept the project's public key, and the dashboard's
// endpoints check the bearer token it sends.
export const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
  'access-control-max-age': '86400',
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', ...headers },
  });
}

export function empty(status: number): Response {
  return new Response(null, { status, headers: corsHeaders });
}
