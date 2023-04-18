import {
  readBlockConfig,
  fetchPlaceholders,
  decorateIcons,
  createOptimizedPicture,
  wrapImgsInLinks,
  decorateLinkedPictures,
} from '../../scripts/scripts.js';

import { setupSponsors, setupSponsorsV2 } from '../sponsors/sponsors.js';

/**
 * collapses all open nav sections
 * @param {Element} sections The container element
 */
function collapseAllNavSections(sections) {
  sections.querySelectorAll('.nav-sections > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', 'false');
  });
}

function displayNextPartner(proud) {
  const partners = [...proud.querySelectorAll('.nav-partner')];
  const appeared = partners.findIndex((e) => e.classList.contains('nav-partner-appear'));
  partners[appeared].classList.remove('nav-partner-appear');
  partners[(appeared + 1) % partners.length].classList.add('nav-partner-appear');
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

  if (sponsors.length > 0) {
    const hasWhiteBg = [...section.classList].includes('white');
    section.classList.add('has-sponsors');
    const partners = document.createElement('div');
    partners.className = 'nav-partners';
    partners.innerHTML = '<div class="nav-partners-title"><span>Proud Partners</span></div><div class="nav-partner-wrapper"></div>';
    sponsors.forEach((sponsor, i) => {
      const partner = document.createElement('div');
      partner.className = 'nav-partner';
      if (!i) partner.classList.add('nav-partner-appear');
      partner.append(createOptimizedPicture(hasWhiteBg ? sponsor.image : sponsor.logoWhite, sponsor.title, false, [{ width: '300' }]));
      partners.querySelector('.nav-partner-wrapper').append(partner);
    });
    setInterval(() => {
      displayNextPartner(partners);
    }, 5000);
    section.append(partners);
  }
}

function setupUser(section) {
  const isStored = sessionStorage.getItem('gigyaAccount');
  const icon = section.querySelector('.icon');
  const text = section.textContent.trim();
  if (isStored) {
    const user = JSON.parse(isStored);
    section.innerHTML = `<button id="nav-user-button" class="nav-user-button" data-status="loading">
        <img src="${user.thumbnailURL}" alt="User Profile Thumbnail"/></span><span>${text}</span>
      </button>`;
  } else {
    section.innerHTML = `<button id="nav-user-button" class="nav-user-button" data-status="loading">
        ${icon.outerHTML}<span>${text}</span>
      </button>`;
  }
  const button = section.querySelector('button');
  button.addEventListener('click', () => {
    import('../../scripts/delayed.js').then((module) => module.initGigya());
  });
}

function parseCountdown(ms) {
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  let days = Math.floor(ms / dayMs);
  let hours = Math.floor((ms - days * dayMs) / hourMs);
  let minutes = Math.round((ms - days * dayMs - hours * hourMs) / 60000);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  } else if (minutes < 10) {
    minutes = `0${minutes}`;
  }
  if (hours === 24) {
    days += 1;
    hours = 0;
  } else if (hours < 10) {
    hours = `0${hours}`;
  }
  return { days, hours, minutes };
}

function findTimeBetween(date) {
  return (date - new Date());
}

function updateCountdown(id) {
  const days = document.getElementById('countdown-days');
  const hours = document.getElementById('countdown-hours');
  const minutes = document.getElementById('countdown-minutes');
  const timeBetween = findTimeBetween(window.placeholders.countdown);
  if (timeBetween > 0) { // if event occurs in the future
    const countdownData = parseCountdown(timeBetween);
    days.textContent = countdownData.days;
    hours.textContent = countdownData.hours;
    minutes.textContent = countdownData.minutes;
  } else { // event has already begun
    document.querySelector('.status-bar-countdown').remove();
    clearTimeout(id);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  block.textContent = '';

  // fetch nav content
  const navPath = config.nav || '/nav';
  const resp = await fetch(`${navPath}.plain.html`);
  if (resp.ok) {
    const html = await resp.text();

    // decorate nav DOM
    const nav = document.createElement('nav');
    nav.innerHTML = html;

    const classes = ['brand', 'sections', 'social', 'tour', 'user'];
    classes.forEach((c, i) => {
      const section = nav.children[i];
      if (section) {
        section.classList.add(`nav-${c}`);
      }
    });

    const navSections = [...nav.children][1];
    if (navSections) {
      navSections.querySelectorAll(':scope > ul > li').forEach((navSection) => {
        if (navSection.querySelector('ul')) {
          navSection.classList.add('nav-drop');
          const ul = navSection.querySelector('ul');
          const title = navSection.innerHTML.split('<')[0].trim();
          navSection.innerHTML = `<span>${title}</span>${ul.outerHTML}`;
          navSection.setAttribute('aria-expanded', false);
          navSection.addEventListener('click', () => {
            const expanded = navSection.getAttribute('aria-expanded') === 'true';
            collapseAllNavSections(navSections);
            navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          });
        }
      });
    }

    // hamburger for mobile
    const hamburger = document.createElement('div');
    hamburger.classList.add('nav-hamburger');
    hamburger.innerHTML = '<div class="nav-hamburger-icon"></div>';
    hamburger.addEventListener('click', () => {
      const expanded = nav.getAttribute('aria-expanded') === 'true';
      document.body.style.overflowY = expanded ? '' : 'hidden';
      nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });
    nav.prepend(hamburger);
    nav.setAttribute('aria-expanded', 'false');

    wrapImgsInLinks(nav);
    const userNav = nav.querySelector('.nav-user');
    if (userNav) {
      setupUser(userNav);
    } else {
      nav.classList.add('no-user');
    }

    decorateIcons(nav);
    decorateLinkedPictures(nav);
    block.append(nav);

    // build status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    block.parentNode.append(statusBar);
    const data = document.createElement('div');
    data.className = 'status-bar-data';

    try {
      const placeholders = await fetchPlaceholders();
      if (placeholders.course) data.insertAdjacentHTML('beforeend', `<div class="status-bar-course"><p>${placeholders.course}</p></div>`);
      if (placeholders.dates) data.insertAdjacentHTML('beforeend', `<div class="status-bar-dates"><p>${placeholders.dates}</p></div>`);
      // setup countdown
      if (placeholders.countdown) {
        window.placeholders.countdown = new Date(placeholders.countdown);
        const timeBetween = findTimeBetween(window.placeholders.countdown);
        if (timeBetween > 0) { // if event occurs in the future
          const countdownData = parseCountdown(timeBetween);
          const countdown = `<div class="status-bar-countdown">
            <p>
              <span id="countdown-days">${countdownData.days}</span> days : 
              <span id="countdown-hours">${countdownData.hours}</span> hours : 
              <span id="countdown-minutes">${countdownData.minutes}</span> minutes
            </p>
          </div>`;
          data.insertAdjacentHTML('beforeend', countdown);
          // update countdown every minute
          const intervalId = setInterval(() => updateCountdown(intervalId), 6 * 1000);
        }
      }
      // check for stored weather
      const isStored = sessionStorage.getItem(`${placeholders.tourCode}${placeholders.tournamentId}Weather`);
      if (isStored) {
        // build weather from session storage
        const weatherData = JSON.parse(isStored);
        const weather = document.createElement('div');
        weather.className = 'status-bar-weather';
        weather.innerHTML = `<p>
            <a href="/weather">
              <span class="status-bar-location">${weatherData.location}</span>
              <img src="${weatherData.icon}"/ >
              <span class="status-bar-temp">${weatherData.temp}</span>
            </a>
          </p>`;
        data.append(weather);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('failed to load placeholders', error);
    }
    if (data.hasChildNodes()) statusBar.append(data);

    const brand = nav.querySelector('.nav-brand');
    const sectionMeta = brand.querySelector('.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);

      if (meta.background) {
        brand.classList.add(meta.background);
      }

      sectionMeta.remove();
    }

    await setupPartners(brand);
    block.classList.add('appear');
  }
}
