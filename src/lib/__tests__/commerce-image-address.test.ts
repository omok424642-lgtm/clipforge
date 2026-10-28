import { describe, expect, it } from 'vitest';
import { commerceImageAddress } from '../commerce-image-address';
import { allowedCommerceImage } from '../commerce-product';
const direct = 'https://shop-phinf.pstatic.net/20261028/item.jpg?type=w860';
describe('shared bookmarklet and server image address policy', () => {
  it('accepts direct product CDN resize queries and locally unwraps only a fixed public wrapper', () => {
    expect(commerceImageAddress(direct,'naver').url).toBe(direct);
    const wrapper = 'https://search.pstatic.net/common/?src='+encodeURIComponent(direct)+'&type=f300';
    expect(commerceImageAddress(wrapper,'naver')).toMatchObject({url:direct,reason:'unwrapped',query:'source_wrapper'});
    expect(allowedCommerceImage(wrapper,'naver')).toBe(true);
  });
  it.each([
    ['http://shop-phinf.pstatic.net/a.jpg','protocol'],
    ['https://shop-phinf.pstatic.net.evil.test/a.jpg','host'],
    ['https://a:b@shop-phinf.pstatic.net/a.jpg','credentials'],
    ['https://shop-phinf.pstatic.net:8443/a.jpg','port'],
    ['https://shop-phinf.pstatic.net/a.jpg#secret','fragment'],
    ['https://shop-phinf.pstatic.net/a.jpg?token=private','sensitive_query'],
    ['data:image/png;base64,AA==','protocol'],
    ['not a url','invalid'],
    ['https://search.pstatic.net/other?src=https://shop-phinf.pstatic.net/a.jpg','host'],
    ['https://search.pstatic.net/common?src=https://127.0.0.1/private','wrapper'],
    ['https://search.pstatic.net/common?src=https://shop-phinf.pstatic.net/a.jpg&src=https://evil.test/a','wrapper'],
    ['https://search.pstatic.net/common?src=https://search.pstatic.net/common','wrapper'],
    ['https://search.pstatic.net/common?src='+encodeURIComponent('https://shop-phinf.pstatic.net/a.jpg?auth=secret'),'wrapper'],
  ])('rejects %s with a specific safe reason', (url,reason) => {
    const result=commerceImageAddress(url,'naver'); expect(result.url).toBe(''); expect(result.reason).toBe(reason);
    expect(JSON.stringify({...result,url:undefined})).not.toMatch(/private|secret|evil/);
  });
  it('does not widen the host allowlist based on guesses about an unobserved image URL', () => {
    expect(commerceImageAddress('https://phinf.pstatic.net/checkout/a.jpg','naver')).toMatchObject({url:'',host:'phinf.pstatic.net',reason:'host'});
    expect(commerceImageAddress(direct,'coupang').url).toBe('');
    expect(commerceImageAddress('https://thumbnail.coupangcdn.com/a.jpg','coupang').url).toContain('coupangcdn.com');
  });
});
