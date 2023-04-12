import {
  createOptimizedPicture,
  lookupPages,
  fetchPlaceholders,
  toClassName,
} from '../../scripts/scripts.js';

export async function setupSponsors(sponsorLinks = []) {
  let sponsors = [];
  let orderedSponsors = [];

  if (sponsorLinks.length) {
    for (let i = 0; i < sponsorLinks.length; i += 1) {
      const sponsorLink = sponsorLinks[i];
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(sponsorLink);
      // eslint-disable-next-line no-await-in-loop
      const html = await resp.text();
      const dp = new DOMParser();
      const sponsorDoc = dp.parseFromString(html, 'text/html');
      const title = sponsorDoc.querySelector('title').textContent;
      const image = sponsorDoc.querySelector('meta[property="og:image"]').content;
      const description = sponsorDoc.querySelector('meta[property="og:description"]').content;
      const link = sponsorDoc.querySelector('meta[name="external-link"]').content;
      const logoWhite = sponsorDoc.querySelector('meta[name="logo-white"]').content;

      sponsors.push({
        title, image, description, link, logoWhite,
      });
    }
  } else {
    const pages = await lookupPages();
    const { sponsorOrder } = await fetchPlaceholders();
    sponsors = pages.filter((e) => e.path.startsWith('/sponsors/'));
    orderedSponsors = [];
    if (sponsorOrder) {
      sponsorOrder.split(',').forEach((sp) => {
        // eslint-disable-next-line no-param-reassign
        sp = sp.trim();
        const match = sponsors.find((sponsor) => sponsor.title === sp);
        if (match) {
          // remove match from sponsors
          sponsors.splice(sponsors.indexOf(match), 1);
          // add match to ordered sponsors
          orderedSponsors.push(match);
        }
      });
    }
  }
  return ([...orderedSponsors, ...sponsors]);
}

export default async function decorate(block) {
  const sponsorLinks = [...block.querySelectorAll('a')].map((a) => a.href);
  const sponsors = await setupSponsors(sponsorLinks);
  block.textContent = '';

  // combine ordered sponsors with any remaining unordered sponsors
  sponsors.forEach((sponsor) => {
    const card = document.createElement('div');
    card.className = 'sponsors-sponsor';
    const wrapper = document.createElement('div');
    const front = document.createElement('div');
    front.className = 'sponsors-sponsor-front';
    front.innerHTML = `${createOptimizedPicture(sponsor.image, sponsor.title, false, [{ width: '300' }]).outerHTML}`;
    const back = document.createElement('div');
    back.className = `sponsors-sponsor-back sponsor-${toClassName(sponsor.title)}`;
    back.innerHTML = `<h2>${sponsor.title}</h2>
      <p>${sponsor.description}</p>
      <p class="button-container"><a class="button" href="${sponsor.link}">${sponsor.title.replace(' ', '')}.com</a></p>`;
    wrapper.append(front, back);
    card.append(wrapper);
    block.append(card);
  });
}
