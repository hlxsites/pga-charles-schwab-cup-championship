import { fetchPlaceholders, loadScript } from '../../scripts/scripts.js';

function getDevice() {
  const width = window.innerWidth;
  if (width > 970) return 'desktop';
  if (width > 728) return 'tablet';
  return 'mobile';
}

function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0
    && rect.left >= 0
    && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    && rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function debounce(func, timeout = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

const checkBottomAdDisplay = debounce(() => {
  const topAd = document.getElementById('pb-slot-top');
  const bottomAd = document.getElementById('sticky-anchor--wrapper');
  if (isInViewport(topAd) && bottomAd) {
    bottomAd.setAttribute('aria-hidden', true);
  } else if (bottomAd && bottomAd.getAttribute('aria-hidden') !== 'false') {
    bottomAd.setAttribute('aria-hidden', false);
  }
});

export default async function decorate(block) {
  block.innerHTML = '';
  const placeholders = await fetchPlaceholders();

  window.tude = window.tude || { cmd: [] };
  loadScript('https://www.googletagservices.com/tag/js/gpt.js', () => {
    loadScript(`https://dn0qt3r0xannq.cloudfront.net/${placeholders.adsPath}/prebid-load.js`, () => {
    // loadScript(`https://web.prebidwrapper.com/${placeholders.adsPath}/prebid-load.js`, () => {
      window.tude.cmd.push(() => {
        window.tude.setDeviceType(getDevice()); // optional
        window.tude.setPageTargeting({ // optional
          url_path: window.location.origin,
          s1: placeholders.adsS1,
          s2: placeholders.adsS2,
          s3: placeholders.adsS3,
          m_data: '0',
          m_safety: 'safe',
          m_catagories: 'moat_safe',
          m_mv: 'noHisData',
          m_gv: 'noHisData',
          ksg: '',
          kuid: '',
          aid: '20767395437692810572475817725693908164',
        });
        window.tude.setAdUnitPath(`/${placeholders.adsNetwork}/pgat.${getDevice() === 'mobile' ? 'phone' : getDevice()}/pgatour`);
      });
      window.tude.cmd.push(() => {
        document.querySelectorAll('.ad').forEach((ad) => {
          const slot = ad.querySelector('div').id;
          if (slot.includes('bottom')) { // setup bottom ad slot
            window.tude.setFeatureFlags({ injectAds: true });
            const topAd = document.getElementById('pb-slot-top');
            if (topAd) {
              checkBottomAdDisplay();
              document.addEventListener('scroll', checkBottomAdDisplay);
            }
          } else {
            window.tude.setFeatureFlags({ injectAds: false });
            window.tude.refreshAdsViaDivMappings([{
              divId: slot,
              baseDivId: slot,
            }]);
          }
        });
      });
    });
  });
}
