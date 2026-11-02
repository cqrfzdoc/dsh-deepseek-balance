/**
 * Host half of the DeepSeek Balance bundle.
 *
 * One operation, two callers: `readBalance` is the single implementation, the
 * floating ball reaches it over the bundle's own HTTP route, and the
 * `deepseek_balance` tool reaches it directly.
 *
 * Balance sources, in order:
 *   1. the DeepSeek account signed in to this harness (`ctx.deepseekAccount`),
 *   2. the wallet API of the configured `DEEPSEEK_API_KEY`.
 * The credential never leaves the Host.
 */

export const inject = ['webServer', 'tools'];

const BALANCE_PATH = '/dsh-deepseek-balance/balance';
const BALANCE_API = 'https://api.deepseek.com/user/balance';
const API_KEY_REF = 'DEEPSEEK_API_KEY';
const REQUEST_TIMEOUT_MS = 15000;

/** Platform client metadata: the UI that asked, not the last caller the Host saw. */
function clientMetadata(locale, version) {
  return {
    version: typeof version === 'string' && version ? version : '0.0.0',
    locale: typeof locale === 'string' && locale ? locale : 'en',
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  };
}

function wallet(currency, toppedUp, granted) {
  return {
    currency: typeof currency === 'string' && currency ? currency : 'CNY',
    toppedUp: toppedUp === undefined || toppedUp === null ? '0' : String(toppedUp),
    granted: granted === undefined || granted === null ? '0' : String(granted),
  };
}

function errorMessage(error) {
  return String((error && error.message) || error || 'unknown error');
}

/** Signed-in platform wallet: recharge wallets plus bonus wallets, kept apart. */
async function readAccountBalance(ctx, metadata) {
  const account = ctx.get('deepseekAccount');
  if (!account) return { ok: false, reason: 'account-unavailable' };

  const state = await account.getState();
  if (!state || state.status !== 'credential-stored') return { ok: false, reason: 'signed-out' };

  const outcome = await account.getBalance(metadata);
  if (!outcome) return { ok: false, reason: 'signed-out' };
  if (outcome.status !== 'ready') return { ok: false, reason: 'account-failed' };

  const normal = Array.isArray(outcome.value) ? outcome.value : [];
  const bonus = Array.isArray(outcome.bonusWallets) ? outcome.bonusWallets : [];
  const currencies = new Set();
  for (const entry of normal) if (entry && entry.currency) currencies.add(entry.currency);
  for (const entry of bonus) if (entry && entry.currency) currencies.add(entry.currency);

  const wallets = [];
  for (const currency of currencies) {
    const toppedUp = normal.find((entry) => entry && entry.currency === currency);
    const granted = bonus.find((entry) => entry && entry.currency === currency);
    wallets.push(wallet(currency, toppedUp && toppedUp.balance, granted && granted.balance));
  }
  return { ok: true, source: 'account', wallets };
}

/** Wallet API for the configured API key; works without a browser sign-in. */
async function readApiKeyBalance(ctx) {
  const credentials = ctx.get('credentials');
  if (!credentials) return { ok: false, reason: 'credentials-unavailable' };

  const resolved = await credentials.resolve(API_KEY_REF);
  const key = resolved && typeof resolved.value === 'string' ? resolved.value.trim() : '';
  if (!key) return { ok: false, reason: 'no-api-key' };

  const response = await fetch(BALANCE_API, {
    method: 'GET',
    headers: { accept: 'application/json', authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) return { ok: false, reason: 'api-key-failed', status: response.status };

  const body = await response.json();
  const infos = body && Array.isArray(body.balance_infos) ? body.balance_infos : [];
  const wallets = infos.map((info) =>
    wallet(info && info.currency, info && info.topped_up_balance, info && info.granted_balance));
  return { ok: true, source: 'api-key', isAvailable: !body || body.is_available !== false, wallets };
}

/** The one implementation both callers use. */
async function readBalance(ctx, metadata) {
  const notes = [];
  try {
    const account = await readAccountBalance(ctx, metadata);
    if (account.ok) return account;
    notes.push(account.reason);
  } catch (error) {
    notes.push(`account-error: ${errorMessage(error)}`);
  }

  try {
    const apiKey = await readApiKeyBalance(ctx);
    if (apiKey.ok) return apiKey;
    notes.push(apiKey.reason);
  } catch (error) {
    notes.push(`api-key-error: ${errorMessage(error)}`);
  }

  const unconfigured = new Set(['signed-out', 'no-api-key', 'account-unavailable', 'credentials-unavailable']);
  const reason = notes.every((note) => unconfigured.has(note)) ? 'not-configured' : 'failed';
  return { ok: false, reason, detail: notes };
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Accept this page (`localhost` and `127.0.0.1` reach the same server) and refuse every other origin. */
function trustedRequestOrigin(requestOrigin, origin) {
  if (!requestOrigin || !origin) return true;
  if (requestOrigin === origin) return true;
  try {
    const requested = new URL(requestOrigin);
    const served = new URL(origin);
    return requested.protocol === served.protocol
      && requested.port === served.port
      && LOOPBACK_HOSTS.has(requested.hostname);
  } catch {
    return false;
  }
}

function sameOriginRequest(req, origin) {
  const requestOrigin = req.headers.origin;
  if (!trustedRequestOrigin(typeof requestOrigin === 'string' ? requestOrigin : '', origin)) return false;
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

function serverOrigin(ctx) {
  try {
    return ctx.webServer.getOrigin();
  } catch {
    return undefined;
  }
}

function createHandler(ctx) {
  return async function handleBalance(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET' });
      res.end();
      return;
    }
    if (!sameOriginRequest(req, serverOrigin(ctx))) {
      res.writeHead(403);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    const metadata = clientMetadata(url.searchParams.get('locale'), url.searchParams.get('version'));

    let payload;
    try {
      payload = { ...(await readBalance(ctx, metadata)), fetchedAt: Date.now() };
    } catch (error) {
      payload = { ok: false, reason: 'failed', detail: errorMessage(error), fetchedAt: Date.now() };
    }

    const body = JSON.stringify(payload);
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  };
}

function round2(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function money(currency, amount) {
  const text = round2(amount).toFixed(2);
  if (currency === 'CNY') return `¥${text}`;
  if (currency === 'USD') return `$${text}`;
  return `${text} ${currency}`;
}

function describeBalance(value) {
  if (!value || value.ok !== true) {
    const detail = value && Array.isArray(value.detail) ? ` (${value.detail.join(', ')})` : '';
    const reason = value && value.reason ? value.reason : 'unknown failure';
    return `DeepSeek balance unavailable: ${reason}${detail}.`;
  }
  const lines = (value.wallets || []).map((entry) => {
    const toppedUp = round2(entry.toppedUp);
    const granted = round2(entry.granted);
    return `${entry.currency} total ${money(entry.currency, round2(toppedUp + granted))}`
      + ` (top-up ${money(entry.currency, toppedUp)}, granted ${money(entry.currency, granted)})`;
  });
  const source = value.source === 'account' ? 'DeepSeek account' : 'DeepSeek API key';
  return `DeepSeek balance from the ${source}: ${lines.length ? lines.join('; ') : 'no wallet reported'}.`;
}

function balanceTool(ctx) {
  return {
    name: 'deepseek_balance',
    description:
      'Read the DeepSeek wallet balance (total, topped-up and granted amounts per currency) '
      + 'for the account configured in this harness: the signed-in DeepSeek account when there '
      + 'is one, otherwise the configured DEEPSEEK_API_KEY.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          source: { type: 'string' },
          reason: { type: 'string' },
          detail: { type: 'array', items: { type: 'string' } },
          isAvailable: { type: 'boolean' },
          wallets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                currency: { type: 'string' },
                toppedUp: { type: 'string' },
                granted: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      render(_args, value) {
        return [{ type: 'text', text: describeBalance(value) }];
      },
    },
    async execute() {
      return readBalance(ctx, clientMetadata('en', '0.0.0'));
    },
  };
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: BALANCE_PATH,
    handler: createHandler(ctx),
  }));
  ctx.effect(() => ctx.tools.register(balanceTool(ctx)));
}
