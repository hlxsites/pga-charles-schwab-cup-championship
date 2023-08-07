/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * log RUM if part of the sample.
 * @param {string} checkpoint identifies the checkpoint in funnel
 * @param {Object} data additional data for RUM sample
 */

export function sampleRUM(checkpoint, data = {}) {
  try {
    window.hlx = window.hlx || {};
    if (!window.hlx.rum) {
      const usp = new URLSearchParams(window.location.search);
      const weight = (usp.get('rum') === 'on') ? 1 : 100; // with parameter, weight is 1. Defaults to 100.
      // eslint-disable-next-line no-bitwise
      const hashCode = (s) => s.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);
      const id = `${hashCode(window.location.href)}-${new Date().getTime()}-${Math.random().toString(16).substr(2, 14)}`;
      const random = Math.random();
      const isSelected = (random * weight < 1);
      // eslint-disable-next-line object-curly-newline
      window.hlx.rum = { weight, id, random, isSelected };
    }
    const { random, weight, id } = window.hlx.rum;
    if (random && (random * weight < 1)) {
      const sendPing = () => {
        // eslint-disable-next-line object-curly-newline, max-len, no-use-before-define
        const body = JSON.stringify({ weight, id, referer: window.location.href, generation: RUM_GENERATION, checkpoint, ...data });
        const url = `https://rum.hlx.page/.rum/${weight}`;
        // eslint-disable-next-line no-unused-expressions
        navigator.sendBeacon(url, body);
      };
      sendPing();
      // special case CWV
      if (checkpoint === 'cwv') {
        // use classic script to avoid CORS issues
        const script = document.createElement('script');
        script.src = 'https://rum.hlx.page/.rum/web-vitals/dist/web-vitals.iife.js';
        script.onload = () => {
          const storeCWV = (measurement) => {
            data.cwv = {};
            data.cwv[measurement.name] = measurement.value;
            sendPing();
          };
          // When loading `web-vitals` using a classic script, all the public
          // methods can be found on the `webVitals` global namespace.
          window.webVitals.getCLS(storeCWV);
          window.webVitals.getFID(storeCWV);
          window.webVitals.getLCP(storeCWV);
        };
        document.head.appendChild(script);
      }
    }
  } catch (e) {
    // something went wrong
  }
}

/**
 * Loads a CSS file.
 * @param {string} href The path to the CSS file
 */
export function loadCSS(href, callback) {
  if (!document.querySelector(`head > link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    if (typeof callback === 'function') {
      link.onload = (e) => callback(e.type);
      link.onerror = (e) => callback(e.type);
    }
    document.head.appendChild(link);
  } else if (typeof callback === 'function') {
    callback('noop');
  }
}

/**
 * Retrieves the content of metadata tags.
 * @param {string} name The metadata name (or property)
 * @returns {string} The metadata value(s)
 */
export function getMetadata(name) {
  const attr = name && name.includes(':') ? 'property' : 'name';
  const meta = [...document.head.querySelectorAll(`meta[${attr}="${name}"]`)].map((m) => m.content).join(', ');
  return meta || null;
}

/**
 * Adds one or more URLs to the dependencies for publishing.
 * @param {string|[string]} url The URL(s) to add as dependencies
 */
export function addPublishDependencies(url) {
  const urls = Array.isArray(url) ? url : [url];
  window.hlx = window.hlx || {};
  if (window.hlx.dependencies && Array.isArray(window.hlx.dependencies)) {
    window.hlx.dependencies = window.hlx.dependencies.concat(urls);
  } else {
    window.hlx.dependencies = urls;
  }
}

/**
 * Sanitizes a name for use as class name.
 * @param {string} name The unsanitized name
 * @returns {string} The class name
 */
export function toClassName(name) {
  return name && typeof name === 'string'
    ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-')
    : '';
}

/*
 * Sanitizes a name for use as a js property name.
 * @param {string} name The unsanitized name
 * @returns {string} The camelCased name
 */
export function toCamelCase(name) {
  return toClassName(name).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Replace icons with inline SVG and prefix with codeBasePath.
 * @param {Element} element
 */
function replaceIcons(element) {
  element.querySelectorAll('img.icon').forEach((img) => {
    const span = document.createElement('span');
    span.className = img.className;
    img.replaceWith(span);
  });
}

/**
 * Replace icons with inline SVG and prefix with codeBasePath.
 * @param {Element} element
 */
export function decorateIcons(element) {
  // prepare for forward compatible icon handling
  replaceIcons(element);

  element.querySelectorAll('span.icon').forEach((span) => {
    let iconName = span.className.split('icon-')[1];
    if (iconName.startsWith('flag-')) iconName = iconName.replace('-', '/');
    fetch(`${window.hlx.codeBasePath}/icons/${iconName}.svg`).then((resp) => {
      if (resp.status === 200) resp.text().then((svg) => { span.innerHTML = svg; });
    });
  });
}

/**
 * Turns absolute links within the domain into relative links.
 * @param {Element} main The container element
 */
export function makeLinksRelative(main) {
  // eslint-disable-next-line no-use-before-define
  const hosts = ['hlx.page', 'hlx.live', ...PRODUCTION_DOMAINS];
  main.querySelectorAll('a').forEach((a) => {
    if (a.href) {
      try {
        const url = new URL(a.href);
        const hostMatch = hosts.some((host) => url.hostname.includes(host));
        const hostPathMatch = hosts.find((host) => `${url.hostname}${url.pathname}`.includes(host));
        if (hostMatch) {
          a.href = `${url.pathname.replace('.html', '')}${url.search}${url.hash}`;
        } else if (hostPathMatch) {
          const resultHref = `${url.hostname}${url.pathname}${url.search}${url.hash}`.replace(hostPathMatch, '').replace('.html', '');
          a.href = resultHref.startsWith('/') ? resultHref : `/${resultHref}`;
        }
      } catch (e) {
        // something went wrong
        // eslint-disable-next-line no-console
        console.log(e);
      }
    }
  });
}

/**
 * Sets external target and rel for links in a container element.
 * @param {Element} container The container element
 */
export function updateExternalLinks(container) {
  const REFERERS = [
    window.location.origin,
    'http://pubads.g.doubleclick.net',
    'https://googleads.g.doubleclick.net',
    'https://adclick.g.doubleclick.net',
    'https://www.pgatour.com',
    'https://www.pgatourfanshop.com',
    'https://www.grantthornton.com',
    'http://www.morganstanley.com',
    'http://www.optum.com',
    'https://www.rolex.com',
  ];
  container.querySelectorAll('a[href]').forEach((a) => {
    try {
      const { origin, pathname, hash } = new URL(a.href, window.location.href);
      const targetHash = hash && hash.startsWith('#_');
      const isPDF = pathname.split('.').pop() === 'pdf';
      if ((origin && origin !== window.location.origin && !targetHash) || isPDF) {
        a.setAttribute('target', '_blank');
        if (!REFERERS.includes(origin)) a.setAttribute('rel', 'noopener');
      } else if (targetHash) {
        a.setAttribute('target', hash.replace('#', ''));
        a.href = a.href.replace(hash, '');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid link in ${container}: ${a.href}`);
    }
  });
}

/**
 * Wraps images followed by links within a matching <a> tag.
 * @param {Element} container The container element
 */
export function wrapImgsInLinks(container) {
  const pictures = container.querySelectorAll('p picture');
  pictures.forEach((pic) => {
    const parent = pic.parentNode;
    const link = parent.nextElementSibling.querySelector('a');
    if (link && link.textContent.includes(link.getAttribute('href'))) {
      link.parentElement.remove();
      link.innerHTML = pic.outerHTML;
      parent.replaceWith(link);
    }
  });
}

/**
 * Gets placeholders object
 * @param {string} prefix
 */
export async function fetchPlaceholders(prefix = 'default') {
  window.placeholders = window.placeholders || {};
  const loaded = window.placeholders[`${prefix}-loaded`];
  if (!loaded) {
    window.placeholders[`${prefix}-loaded`] = new Promise((resolve, reject) => {
      try {
        fetch(`${prefix === 'default' ? '' : prefix}/placeholders.json`)
          .then((resp) => resp.json())
          .then((json) => {
            const placeholders = {};
            json.data.forEach((placeholder) => {
              placeholders[toCamelCase(placeholder.Key)] = placeholder.Text;
            });
            window.placeholders[prefix] = placeholders;
            resolve();
          });
      } catch (e) {
        // error loading placeholders
        window.placeholders[prefix] = {};
        reject();
      }
    });
  }
  await window.placeholders[`${prefix}-loaded`];
  return (window.placeholders[prefix]);
}

/**
 * Decorates a block.
 * @param {Element} block The block element
 */
export function decorateBlock(block) {
  const trimDashes = (str) => str.replace(/(^\s*-)|(-\s*$)/g, '');
  const classes = Array.from(block.classList.values());
  const blockName = classes[0];
  if (!blockName) return;
  const section = block.closest('.section');
  if (section) {
    section.classList.add(`${blockName}-container`.replace(/--/g, '-'));
  }
  const blockWithVariants = blockName.split('--');
  const shortBlockName = trimDashes(blockWithVariants.shift());
  const variants = blockWithVariants.map((v) => trimDashes(v));
  block.classList.add(shortBlockName);
  block.classList.add(...variants);

  block.classList.add('block');
  block.setAttribute('data-block-name', shortBlockName);
  block.setAttribute('data-block-status', 'initialized');

  const blockWrapper = block.parentElement;
  blockWrapper.classList.add(`${shortBlockName}-wrapper`);
}

/**
 * Extracts the config from a block.
 * @param {Element} block The block element
 * @returns {object} The block config
 */
export function readBlockConfig(block) {
  const config = {};
  block.querySelectorAll(':scope>div').forEach((row) => {
    if (row.children) {
      const cols = [...row.children];
      if (cols[1]) {
        const col = cols[1];
        const name = toClassName(cols[0].textContent);
        let value = '';
        if (col.querySelector('a')) {
          const as = [...col.querySelectorAll('a')];
          if (as.length === 1) {
            value = as[0].href;
          } else {
            value = as.map((a) => a.href);
          }
        } else if (col.querySelector('img')) {
          const imgs = [...col.querySelectorAll('img')];
          if (imgs.length === 1) {
            value = imgs[0].src;
          } else {
            value = imgs.map((img) => img.src);
          }
        } else if (col.querySelector('p')) {
          const ps = [...col.querySelectorAll('p')];
          if (ps.length === 1) {
            value = ps[0].textContent;
          } else {
            value = ps.map((p) => p.textContent);
          }
        } else value = row.children[1].textContent;
        config[name] = value;
      }
    }
  });
  return config;
}

/**
 * Decorates all sections in a container element.
 * @param {Element} main The container element
 */
export function decorateSections(main) {
  main.querySelectorAll(':scope > div').forEach((section) => {
    const wrappers = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if ([...e.classList].includes('col-right')) return;
      if (e.tagName === 'DIV' || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV';
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers[wrappers.length - 1].append(e);
    });
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.setAttribute('data-section-status', 'initialized');

    /* process section metadata */
    const sectionMeta = section.querySelector('div.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      const keys = Object.keys(meta);
      keys.forEach((key) => {
        if (key === 'style') section.classList.add(toClassName(meta.style));
        else section.dataset[toCamelCase(key)] = meta[key];
      });
      sectionMeta.remove();
    }
  });
}

/**
 * Updates all section status in a container element.
 * @param {Element} main The container element
 */
export function updateSectionsStatus(main) {
  const sections = [...main.querySelectorAll(':scope > .section')];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const status = section.getAttribute('data-section-status');
    if (status !== 'loaded') {
      const loadingBlock = section.querySelector('.block[data-block-status="initialized"], .block[data-block-status="loading"]');
      if (loadingBlock) {
        section.setAttribute('data-section-status', 'loading');
        break;
      } else {
        section.setAttribute('data-section-status', 'loaded');
      }
    }
  }
}

/**
 * Decorates all blocks in a container element.
 * @param {Element} main The container element
 */
export function decorateBlocks(main) {
  main
    .querySelectorAll('div.section > div > div')
    .forEach((block) => decorateBlock(block));
}

/**
 * Builds a block DOM Element from a two dimensional array
 * @param {string} blockName name of the block
 * @param {any} content two dimensional array or string or object of content
 */
export function buildBlock(blockName, content) {
  const table = Array.isArray(content) ? content : [[content]];
  const blockEl = document.createElement('div');
  // build image block nested div structure
  blockEl.classList.add(blockName);
  table.forEach((row) => {
    const rowEl = document.createElement('div');
    row.forEach((col) => {
      const colEl = document.createElement('div');
      const vals = col.elems ? col.elems : [col];
      vals.forEach((val) => {
        if (val) {
          if (typeof val === 'string') {
            colEl.innerHTML += val;
          } else {
            colEl.appendChild(val);
          }
        }
      });
      rowEl.appendChild(colEl);
    });
    blockEl.appendChild(rowEl);
  });
  return (blockEl);
}

/**
 * Loads JS and CSS for a block.
 * @param {Element} block The block element
 */
export async function loadBlock(block, eager = false) {
  if (!(block.getAttribute('data-block-status') === 'loading' || block.getAttribute('data-block-status') === 'loaded')) {
    block.setAttribute('data-block-status', 'loading');
    const blockName = block.getAttribute('data-block-name');
    try {
      const cssLoaded = new Promise((resolve) => {
        loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`, resolve);
      });
      const decorationComplete = new Promise((resolve) => {
        (async () => {
          try {
            const mod = await import(`../blocks/${blockName}/${blockName}.js`);
            if (mod.default) {
              await mod.default(block, blockName, document, eager);
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.log(`failed to load module for ${blockName}`, err);
          }
          resolve();
        })();
      });
      await Promise.all([cssLoaded, decorationComplete]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`failed to load block ${blockName}`, err);
    }
    makeLinksRelative(block);
    updateExternalLinks(block);
    block.setAttribute('data-block-status', 'loaded');
  }
}

/**
 * Loads JS and CSS for all blocks in a container element.
 * @param {Element} main The container element
 */
export async function loadBlocks(main) {
  updateSectionsStatus(main);
  const blocks = [...main.querySelectorAll('div.block')];
  for (let i = 0; i < blocks.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await loadBlock(blocks[i]);
    updateSectionsStatus(main);
  }
}

/**
 * Returns a picture element with webp and fallbacks
 * @param {string} src The image URL
 * @param {boolean} eager load image eager
 * @param {Array} breakpoints breakpoints and corresponding params (eg. width)
 */
export function createOptimizedPicture(src, alt = '', eager = false, breakpoints = [{ media: '(min-width: 400px)', width: '2000' }, { width: '750' }]) {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute('srcset', `${pathname}?width=${br.width}&format=webply&optimize=medium`);
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
    }
  });

  return picture;
}

/**
 * returns an image caption of a picture element
 * @param {Element} picture picture element
 */
function getImageCaption(picture) {
  const parent = picture.parentNode;
  const parentSibling = parent.nextElementSibling;
  return parentSibling && parentSibling.firstChild.nodeName === 'EM' ? parentSibling : undefined;
}

/**
 * builds images blocks from default content.
 * @param {Element} main The container element
 */
function buildImageBlocks(main) {
  // select all non-featured, default (non-images block) images
  const imgs = [...main.querySelectorAll(':scope > div > p > picture')];
  let lastImagesBlock;
  imgs.forEach((img) => {
    const parent = img.parentNode;
    const imgBlock = buildBlock('images', {
      elems: [img.cloneNode(true), getImageCaption(img)],
    });
    if (parent.parentNode) {
      parent.replaceWith(imgBlock);
      lastImagesBlock = imgBlock;
    } else {
      // same parent, add image to last images block
      lastImagesBlock.firstChild.append(imgBlock.firstChild.firstChild);
    }
  });
}

/**
 * Normalizes all headings within a container element.
 * @param {Element} el The container element
 * @param {[string]} allowedHeadings The list of allowed headings (h1 ... h6)
 */
export function normalizeHeadings(el, allowedHeadings) {
  const allowed = allowedHeadings.map((h) => h.toLowerCase());
  el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((tag) => {
    const h = tag.tagName.toLowerCase();
    if (allowed.indexOf(h) === -1) {
      // current heading is not in the allowed list -> try first to "promote" the heading
      let level = parseInt(h.charAt(1), 10) - 1;
      while (allowed.indexOf(`h${level}`) === -1 && level > 0) {
        level -= 1;
      }
      if (level === 0) {
        // did not find a match -> try to "downgrade" the heading
        while (allowed.indexOf(`h${level}`) === -1 && level < 7) {
          level += 1;
        }
      }
      if (level !== 7) {
        tag.outerHTML = `<h${level} id="${tag.id}">${tag.textContent}</h${level}>`;
      }
    }
  });
}

/**
 * Decorates the picture elements and removes formatting.
 * @param {Element} main The container element
 */
export function decoratePictures(main) {
  main.querySelectorAll('img[src*="/media_"').forEach((img, i) => {
    const newPicture = createOptimizedPicture(img.src, img.alt, !i);
    const picture = img.closest('picture');
    if (picture) picture.parentElement.replaceChild(newPicture, picture);
    if (['EM', 'STRONG'].includes(newPicture.parentElement.tagName)) {
      const styleEl = newPicture.parentElement;
      styleEl.parentElement.replaceChild(newPicture, styleEl);
    }
  });
}

/**
 * Set template (page structure) and theme (page styles).
 */
function decorateTemplateAndTheme() {
  const template = getMetadata('template');
  if (template) document.body.classList.add(toClassName(template));
  const theme = getMetadata('theme');
  if (theme) document.body.classList.add(toClassName(theme));
}

/**
 * decorates paragraphs containing a single link as buttons and combines adjacent button containers.
 * @param {Element} element container element
 */
export function decorateButtons(element) {
  element.querySelectorAll('a').forEach((a) => {
    a.title = a.title || a.textContent;
    if (a.href !== a.textContent) {
      const up = a.parentElement;
      const twoup = a.parentElement.parentElement;
      if (!a.querySelector('img')) {
        if (up.childNodes.length === 1 && (up.tagName === 'P' || up.tagName === 'DIV')) {
          a.className = 'button primary'; // default
          up.classList.add('button-container');
        }
        if (up.childNodes.length === 1 && up.tagName === 'STRONG'
          && twoup.childNodes.length === 1 && twoup.tagName === 'P') {
          a.className = 'button primary';
          twoup.classList.add('button-container');
          up.outerHTML = a.outerHTML;
        }
        if (up.childNodes.length === 1 && up.tagName === 'EM'
          && twoup.childNodes.length === 1 && twoup.tagName === 'P') {
          a.className = 'button secondary';
          twoup.classList.add('button-container');
          up.outerHTML = a.outerHTML;
        }
      }
    }
  });
  // combine adjacent button containers
  element.querySelectorAll('.button-container').forEach((container) => {
    const adjacentContainers = [];
    let next = container.nextElementSibling;
    while (next && next.className === 'button-container') {
      adjacentContainers.push(next);
      next = next.nextElementSibling;
    }
    adjacentContainers.forEach((ac) => {
      [...ac.children].forEach((child) => container.append(child));
      ac.remove();
    });
  });
}

/**
 * Adds the favicon.
 * @param {string} href The favicon URL
 */
export function addFavIcon(href) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = href;
  const existingLink = document.querySelector('head link[rel="icon"]');
  if (existingLink) {
    existingLink.parentElement.replaceChild(link, existingLink);
  } else {
    document.getElementsByTagName('head')[0].appendChild(link);
  }
}

/**
 * load LCP block and/or wait for LCP in default content.
 */
async function waitForLCP() {
  // eslint-disable-next-line no-use-before-define
  const lcpBlocks = LCP_BLOCKS;
  const block = document.querySelector('.block');
  const hasLCPBlock = (block && lcpBlocks.includes(block.getAttribute('data-block-name')));
  if (hasLCPBlock) await loadBlock(block, true);

  document.querySelector('body').classList.add('appear');
  const lcpCandidate = document.querySelector('main img');
  await new Promise((resolve) => {
    if (lcpCandidate && !lcpCandidate.complete) {
      lcpCandidate.setAttribute('loading', 'eager');
      lcpCandidate.addEventListener('load', () => resolve());
      lcpCandidate.addEventListener('error', () => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * Decorates the page.
 */
async function loadPage(doc) {
  // eslint-disable-next-line no-use-before-define
  await loadEager(doc);
  // eslint-disable-next-line no-use-before-define
  await loadLazy(doc);
  // eslint-disable-next-line no-use-before-define
  loadDelayed(doc);
}

export function initHlx() {
  window.hlx = window.hlx || {};
  window.hlx.lighthouse = new URLSearchParams(window.location.search).get('lighthouse') === 'on';
  window.hlx.codeBasePath = '';

  const scriptEl = document.querySelector('script[src$="/scripts/scripts.js"]');
  if (scriptEl) {
    try {
      [window.hlx.codeBasePath] = new URL(scriptEl.src).pathname.split('/scripts/scripts.js');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e);
    }
  }
}

initHlx();

/*
 * ------------------------------------------------------------
 * Edit above at your own risk
 * ------------------------------------------------------------
 */

const LCP_BLOCKS = ['carousel', 'hero']; // add your LCP blocks to the list
const RUM_GENERATION = 'intercept-aa-2'; // add your RUM generation information here
const PRODUCTION_DOMAINS = ['www.charlesschwabcupchampionship.com'];

sampleRUM('top');
window.addEventListener('load', () => sampleRUM('load'));
document.addEventListener('click', () => sampleRUM('click'));

loadPage(document);

function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    const elems = [];
    const currentSection = h1.closest('main > div');
    if (!currentSection.previousElementSibling) {
      [...currentSection.children].forEach((child) => { elems.push(child); });
    } else {
      elems.push(picture);
      elems.push(h1);
    }

    section.append(buildBlock('hero', { elems }));
    main.prepend(section);
    const sibling = section.nextElementSibling;
    if (sibling) { // remove empty sibling if exists
      if (!sibling.textContent.trim().length) sibling.remove();
    }
  }
}

function buildShareBlock(main) {
  const section = document.createElement('div');
  section.append(buildBlock('share', ''));
  const ad = main.querySelector('.ad-top');
  const hero = main.querySelector('.hero, .carousel');
  if (ad) {
    ad.parentNode.after(section);
  } else if (hero) {
    hero.parentNode.after(section);
  }
}

function buildRelatedStoriesBlock(main, tags) {
  const FULL_WIDTH_BLOCKS = ['carousel', 'carousel course', 'hero', 'news', 'player-feature', 'share', 'teaser', 'weather'];
  const sections = main.querySelectorAll(':scope > div');
  const nonFullWidthSection = [...sections]
    .find((section) => ![...section.children] // check section
      .find((child) => FULL_WIDTH_BLOCKS.includes(child.className))); // check content in section
  let storiesSection = nonFullWidthSection;
  if (!storiesSection) { // if no section without full-width content, create one
    storiesSection = document.createElement('div');
    main.append(storiesSection);
  } else {
    storiesSection.classList.add('two-col');
  }
  const block = buildBlock('related-stories', [['<div>Tags</div>', `<div>${tags}</div>`]]);
  const wrapper = document.createElement('section');
  wrapper.className = 'col-right';
  wrapper.append(block);
  decorateBlock(block);
  storiesSection.append(wrapper);
}

export function linkPicture(picture) {
  const nextSib = picture.parentNode.nextElementSibling;
  if (nextSib) {
    const a = nextSib.querySelector('a');
    if (a && a.textContent.startsWith('https://')) {
      a.innerHTML = '';
      a.className = '';
      a.appendChild(picture);
    }
  }
}

export function decorateLinkedPictures(main) {
  /* thanks to word online */
  main.querySelectorAll('picture').forEach((picture) => {
    if (!picture.closest('div.block')) {
      linkPicture(picture);
    }
  });
}

async function loadHeader(header) {
  const headerBlock = buildBlock('header', '');
  header.append(headerBlock);
  decorateBlock(headerBlock);
  await loadBlock(headerBlock);
}

async function loadFooter(footer) {
  const footerBlock = buildBlock('footer', '');
  footer.append(footerBlock);
  decorateBlock(footerBlock);
  await loadBlock(footerBlock);
}

export function loadScript(url, callback, attributes) {
  const head = document.querySelector('head');
  if (!head.querySelector(`script[src="${url}"]`)) {
    const script = document.createElement('script');
    script.src = url;

    if (attributes) {
      Object.keys(attributes).forEach((key) => {
        script.setAttribute(key, attributes[key]);
      });
    }

    head.append(script);
    script.onload = callback;
    return script;
  }
  return head.querySelector(`script[src="${url}"]`);
}

/**
 * checks is search param 'view' is set to 'app'
 */
function isAppView() {
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'app';
}

/**
 * Provides a single point of acess to do a cross-domain fetch
 * for bypassing cors when getting pga tour feed data.
 * @param {string} url the url to fetch
 * @returns the fetch responst
 */
export async function fetchCors(url) {
  const worker = 'https://little-forest-58aa.david8603.workers.dev';
  const fetchUrl = `${worker}/?url=${encodeURIComponent(url)}`;
  return fetch(fetchUrl);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
async function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
    buildImageBlocks(main);

    const hasAd = getMetadata('ad');
    if (hasAd && !isAppView()) {
      const positions = hasAd.split(',').map((a) => a.trim().toLowerCase());
      let validPositions = false;
      positions.forEach((position) => {
        if (position === 'top') {
          validPositions = true;
          const adPlaceholder = document.createElement('aside');
          adPlaceholder.setAttribute('data-section-status', 'loading');
          adPlaceholder.className = 'section ad';
          adPlaceholder.innerHTML = '<div id="pb-slot-top" class="ad-top"></div>';
          const hero = main.querySelector('.hero, .carousel');
          if (hero) hero.parentNode.after(adPlaceholder);
        } else if (position === 'bottom') {
          validPositions = true;
          const adPlaceholder = document.createElement('aside');
          adPlaceholder.className = 'section ad';
          adPlaceholder.innerHTML = '<div id="pb-slot-bottom" class="ad-bottom"></div>';
          main.append(adPlaceholder);
        }
      });
      if (validPositions) main.append(buildBlock('ads', ''));
    }

    const template = getMetadata('template');
    if (template === 'left-align' || template === 'past-champions') {
      buildShareBlock(main);
    }
    if (template === 'past-champions') {
      const image = main.querySelector('.images');
      if (image) image.classList.add('float');
    }

    const relatedStories = getMetadata('related-stories');
    if (relatedStories) buildRelatedStoriesBlock(main, relatedStories);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

export async function fetchGraphQL(query, variables) {
  const placeholders = await fetchPlaceholders();
  if (placeholders.graphqlApiEndpoint && placeholders.graphqlApiKey) {
    return fetch(placeholders.graphqlApiEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        variables,
        query,
      }),
      headers: {
        'x-api-key': placeholders.graphqlApiKey,
        'x-pgat-platform': 'web',
      },
    });
  }
  throw new Error('fail');
}

/**
 * injects and decorates buttons for fevo offers.
 * @param {Element} main the container element for the buttons.
 */
function decorateFevoButtons(main) {
  const fevoButtons = main.querySelectorAll('a[href*="fevogm.com"]');
  if (fevoButtons.length > 0) {
    fevoButtons.forEach((a) => {
      const offerCode = new URL(a.href).searchParams.get('offercode');
      if (offerCode) {
        a.classList.add('fevo-btn');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          // this gets loaded in delayed, so checking JIC
          if (window.GMWidget) {
            window.GMWidget.open(offerCode);
          }
        });
      }
    });
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
export async function decorateMain(main) {
  // forward compatible pictures redecoration
  decoratePictures(main);
  decorateLinkedPictures(main);
  // forward compatible link rewriting
  makeLinksRelative(main);
  updateExternalLinks(main);
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateFevoButtons(main);

  decorateIcons(main);
  await buildAutoBlocks(main);
  decorateSections(main);

  const sections = [...main.querySelectorAll('.section')];
  sections.forEach((section) => {
    const bg = section.dataset.background;
    if (bg) {
      const picture = createOptimizedPicture(bg);
      picture.classList.add('section-background');
      section.prepend(picture);

      const videoId = section.dataset.video;
      if (videoId) {
        const playLink = document.createElement('a');

        fetchGraphQL(`query getVideoById($brightcoveId: ID!) {    
          videoById(brightcoveId: $brightcoveId, tourcast: false) {
               id
               shareUrl
           }
       }`, {
          brightcoveId: videoId,
        }).then(async (resp) => {
          if (resp.ok) {
            const json = await resp.json();
            if (json && json.data && json.data.videoById && json.data.videoById.shareUrl) {
              playLink.href = json.data.videoById.shareUrl;
              section.insertBefore(playLink, picture.nextSibling);
            }
          }
        });

        playLink.target = '_blank';

        const playIcon = document.createElement('span');

        playIcon.classList.add('teaser-play');
        playLink.append(playIcon);
      }
    }
  });

  decorateBlocks(main);
}

/**
 * loads everything needed to get to LCP.
 */
async function loadEager(doc) {
  decorateTemplateAndTheme();
  if (isAppView()) document.querySelector('header').remove();
  const main = doc.querySelector('main');
  if (main) {
    await decorateMain(main);
    await waitForLCP();
    if (!isAppView()) loadHeader(doc.querySelector('header'));
  }
}

/**
 * loads everything that doesn't need to be delayed.
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? main.querySelector(hash) : false;
  if (hash && element) element.scrollIntoView();

  if (!isAppView()) loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  addFavIcon(`${window.hlx.codeBasePath}/styles/favicon.ico`);

  doc.querySelectorAll('div:not([class]):not([id]):empty').forEach((empty) => empty.remove());
}

/**
 * loads everything that happens a lot later, without impacting
 * the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 4000);
  // load anything that can be postponed to the latest here
}

export async function lookupPages(pathnames) {
  if (!window.pageIndex) {
    const resp = await fetch('/query-index.json');
    const json = await resp.json();
    const lookup = {};
    json.data.forEach((row) => {
      lookup[row.path] = row;
    });
    window.pageIndex = { data: json.data, lookup };
  }
  if (pathnames) {
    const result = pathnames.map((path) => window.pageIndex.lookup[path]).filter((e) => e);
    return (result);
  }
  return window.pageIndex.data;
}

/**
 * Add dynamic font sizing CSS class names to headings
 *
 * The CSS class names are determined by character counts.
 * @param {Element} block The container element
 * @param {string} classPrefix Prefix in CSS class names before "-long", "-very-long", "-x-long".
 * Default is "heading".
 * @param {string} selector CSS selector to select the target heading tags. Default is "h1, h2".
 */
export function addHeaderSizing(block, classPrefix = 'heading', selector = 'h1, h2') {
  const headings = block.querySelectorAll(selector);
  const sizes = [
    { name: 'long', threshold: 30 },
    { name: 'very-long', threshold: 40 },
    { name: 'x-long', threshold: 50 },
  ];
  headings.forEach((h) => {
    const { length } = h.textContent;
    sizes.forEach((size) => {
      if (length >= size.threshold) h.classList.add(`${classPrefix}-${size.name}`);
    });
  });
}

export function clearDataLayer() {
  window.adobeDataLayer = [];
}

export function pushOneTrustConsentGroups() {
  window.adobeDataLayer = window.adobeDataLayer || [];
  const dl = window.adobeDataLayer;
  dl.push({
    event: 'LaunchOTLoaded',
    // eslint-disable-next-line no-undef
    OnetrustActiveGroups: typeof OnetrustActiveGroups !== 'undefined' ? OnetrustActiveGroups : '',
  });
}

function getPageNameAndSections() {
  const pageSectionParts = window.location.pathname.split('/').filter((subPath) => subPath !== '');
  const pageName = pageSectionParts.join(':');
  const finalPageName = pageName === '' ? 'Home' : pageName;

  return {
    pageName: finalPageName,
    sections: pageSectionParts,
  };
}

export async function sendAnalyticsPageEvent() {
  window.adobeDataLayer = window.adobeDataLayer || [];
  const dl = window.adobeDataLayer;
  const placeholders = await fetchPlaceholders();
  const isUserLoggedIn = window.gigyaAccountInfo && window.gigyaAccountInfo != null
    && window.gigyaAccountInfo.errorCode === 0;

  const { pageName, sections } = getPageNameAndSections();
  dl.push({
    event: 'pageLoaded',
    pageName,
    pageUrl: window.location.href,
    siteSection: sections[0] || '',
    siteSubSection: sections[1] || '',
    siteSubSection2: sections[2] || '',
    gigyaID: isUserLoggedIn && window.gigyaAccountInfo.UID ? window.gigyaAccountInfo.UID : '',
    userLoggedIn: isUserLoggedIn ? 'Logged In' : 'Logged Out',
    tourName: 'pgatour',
    tournamentID: `${placeholders.tourCode.toUpperCase()}${placeholders.currentYear}${placeholders.tournamentId}`,
    ipAddress: '127.0.0.1',
    deviceType: 'Web',
  });
}

try {
  const hidden = Symbol('hidden');
  const proxy = Symbol('proxy');
  Object.defineProperty(window, 's', {
    set(x) {
      this[hidden] = x;
      const handler = {
        get(target, prop, receiver) {
          if (prop === 't') {
            sampleRUM('adobe-analytics');
          }
          return Reflect.get(target, prop, receiver);
        },
      };
      this[proxy] = new Proxy(this[hidden], handler);
    },
    get() {
      return this[proxy];
    },
  });
} catch (e) { /* ignore */ }
