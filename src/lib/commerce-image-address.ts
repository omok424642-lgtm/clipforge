/** Pure URL policy, also embedded in the bookmarklet. Never resolves or requests a URL. */
export function commerceImageAddress(raw: string, platform: string) {
  let host = 'other';
  let query = 'none';
  const fail = (reason: string) => ({ url: '', reason, host, query });
  try {
    const u = new URL(raw);
    const known = ['shop-phinf.pstatic.net', 'shopping-phinf.pstatic.net', 'search.pstatic.net', 'phinf.pstatic.net', 'storep-phinf.pstatic.net', 'dthumb-phinf.pstatic.net', 'store.storeimages.cdn-apple.com'];
    host = known.includes(u.hostname) ? u.hostname : /^(?:[a-z-]{1,32}\.)?pstatic\.net$/.test(u.hostname) ? 'other_pstatic' : 'other';
    query = u.search ? (u.searchParams.has('src') ? 'source_wrapper' : [...u.searchParams.keys()].every(k => /^(type|w|h|width|height|quality|q)$/.test(k)) ? 'resize' : 'other') : 'none';
    if (u.protocol !== 'https:') return fail('protocol');
    if (u.username || u.password) return fail('credentials');
    if (u.port) return fail('port');
    if (u.hash) return fail('fragment');
    if ([...u.searchParams.keys()].some(k => /token|auth|session|password|credential|signature/i.test(k))) return fail('sensitive_query');
    const direct = (v: URL) => platform === 'naver' ? /^(?:shopping-phinf|shop-phinf)\.pstatic\.net$/.test(v.hostname) : /^(?:image|thumbnail\d*)\.coupangcdn\.com$/.test(v.hostname);
    if (direct(u)) return { url: u.href, reason: 'accepted', host, query };
    // A fixed public image wrapper is unwrapped locally, never fetched or used as a redirect service.
    if (platform === 'naver' && u.hostname === 'search.pstatic.net' && /^\/common\/?$/.test(u.pathname)) {
      if (u.searchParams.getAll('src').length !== 1) return fail('wrapper');
      const inner = new URL(u.searchParams.get('src') || '');
      if (inner.protocol !== 'https:' || inner.username || inner.password || inner.port || inner.hash || !direct(inner) || [...inner.searchParams.keys()].some(k => /token|auth|session|password|credential|signature/i.test(k))) return fail('wrapper');
      return { url: inner.href, reason: 'unwrapped', host, query };
    }
    return fail('host');
  } catch { return fail('invalid'); }
}
