import {
  readBlockConfig,
  decorateIcons,
  decorateLinkedPictures,
  createOptimizedPicture,
  wrapImgsInLinks,
} from '../../scripts/scripts.js';

import { setupSponsors, setupSponsorsV2 } from '../sponsors/sponsors.js';

function setupCookieChoices(section) {
  const cookieLink = section.querySelector('a[href*="onetrust-link"]');
  if (cookieLink) {
    cookieLink.removeAttribute('href');
    cookieLink.className = 'ot-sdk-show-settings';
    cookieLink.id = 'ot-sdk-btn';
    cookieLink.parentNode.className = 'onetrust-link';
  }
}

function setupSocialButtons(section) {
  section.querySelectorAll('p').forEach((button) => {
    const icon = [...button.querySelector('.icon').classList][1].replace('icon-', '');
    button.classList.add(`footer-social-${icon}`);
  });
}

async function setupPartners(section) {
  let sponsors = [];
  try {
    // const resp = await fetch('/drafts/shsteimer/sponsors');
    const resp = await fetch('/sponsors');
    // eslint-disable-next-line no-await-in-loop
    const html = await resp.text();
    const dp = new DOMParser();
    const sponsorsDoc = dp.parseFromString(html, 'text/html');
    if (sponsorsDoc.querySelector('.sponsors.v2')) {
      const sponsorRows = [...sponsorsDoc.querySelector('.sponsors.v2').children];
      sponsors = await setupSponsorsV2(sponsorRows);
    } else {
      // backwards compat, kill off after marge and content update
      const sponsorLinks = [...sponsorsDoc.querySelectorAll('.sponsors a')].map((a) => a.href);
      sponsors = await setupSponsors(sponsorLinks);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
  }

  const wrapper = document.createElement('div');
  // combine ordered sponsors with any remaining unordered sponsors
  sponsors.forEach((sponsor) => {
    const partner = document.createElement('div');
    partner.className = 'footer-partner';
    const link = document.createElement('a');
    link.href = sponsor.link;
    link.append(createOptimizedPicture(sponsor.image, sponsor.title, false, [{ width: '300' }]));
    partner.append(link);
    wrapper.append(partner);
  });
  section.append(wrapper);
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  block.textContent = '';

  // fetch footer content
  const footerPath = config.footer || '/footer';
  const resp = await fetch(`${footerPath}.plain.html`);
  if (resp.ok) {
    const html = await resp.text();

    // decorate footer DOM
    const footer = document.createElement('div');
    footer.innerHTML = html;

    let hasPartners = footer.children.length > 4;
    let classes = ['partners', 'nav', 'links', 'social', 'copyright'];
    if (!hasPartners) {
      classes = ['nav', 'links', 'social', 'copyright'];
    }
    classes.forEach((c, i) => {
      const section = footer.children[i];
      if (section) section.classList.add(`footer-${c}`);
    });

    const pageHasSponsers = document.querySelector('.block.sponsors');
    if (pageHasSponsers) {
      // hide partners in footer when page contains sponsors block
      hasPartners = false;
      footer.querySelector('.footer-partners').remove();
    }

    // setup ribbon
    const ribbon = document.createElement('div');
    ribbon.classList.add('footer', 'footer-ribbon');
    const wrapper = document.createElement('div');

    if (hasPartners) {
      wrapper.append(footer.querySelector('.footer-partners'), footer.querySelector('.footer-nav'));
    } else {
      wrapper.append(footer.querySelector('.footer-nav'));
    }

    ribbon.append(wrapper);

    setupCookieChoices(footer.querySelector('.footer-links'));
    setupSocialButtons(footer.querySelector('.footer-social'));

    block.append(footer);
    block.parentNode.prepend(ribbon);
    wrapImgsInLinks(block);
    decorateIcons(block);
    decorateLinkedPictures(block);

    if (hasPartners) {
      await setupPartners(ribbon.querySelector('.footer-partners'));
    }
  }
}
