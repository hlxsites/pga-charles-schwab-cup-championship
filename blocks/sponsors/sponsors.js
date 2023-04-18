import {
  createOptimizedPicture,
  lookupPages,
  fetchPlaceholders,
  toClassName,
} from '../../scripts/scripts.js';

export async function setupSponsorsV2(sponsorRows = []) {
  const sponsors = [];
  sponsorRows.forEach((sponsorRow) => {
    const link = sponsorRow.querySelector('a');
    const images = sponsorRow.querySelectorAll('picture');
    const headline = sponsorRow.querySelector('h1');
    const description = sponsorRow.querySelector('h1 + p');

    sponsors.push({
      title: headline.textContent,
      image: images[0].querySelector('img').src,
      logoWhite: images[1].querySelector('img').src,
      description: description.textContent,
      link: link.href,
    });
  });

  return sponsors;
}

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
  let sponsors;
  if (block.classList.contains('v2')) {
    // use new content model
    const sponsorRows = [...block.children];
    sponsors = await setupSponsorsV2(sponsorRows);
  } else {
    // backwards compatability, can be killed off after this is merged and content is updated
    const sponsorLinks = [...block.querySelectorAll('a')].map((a) => a.href);
    sponsors = await setupSponsors(sponsorLinks);
  }

  block.textContent = '';

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
