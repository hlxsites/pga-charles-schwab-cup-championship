function displayVideo(e) {
  const block = e.target.closest('.block');
  const video = block.querySelector('.video');
  video.classList.add('video-play-mode');
  const iFrame = video.querySelector('iframe');
  if (!iFrame.src && iFrame.dataset.src) {
    iFrame.src = iFrame.dataset.src;
  }
  iFrame.src += '&autoplay=1';
}

function closeVideo(e) {
  const video = e.target.closest('.video');
  video.classList.remove('video-play-mode');
  const iframe = video.querySelector('iframe');
  iframe.src = iframe.getAttribute('src').replace('&autoplay=1', '');
}

function buildDefaultVideo(id, inHero) {
  const videoUrl = 'https://players.brightcove.net/6082840763001/6QBtcb032_default/index.html?videoId=';
  return `<div class="video-iframe-wrapper">
    <iframe loading="lazy" ${inHero ? 'data-' : ''}src='${videoUrl}${id}' allow="encrypted-media" allowfullscreen></iframe>
  </div>`;
}

function loadFranklinVideo(videoHref, block) {
  block.innerHTML = `<video controls>
    <source src="${videoHref}" type="video/${videoHref.split('.').pop()}" >
  </video>`;

  block.setAttribute('data-video-status', 'loaded');
}

function loadBrightcoveVideo(id, block) {
  const inHero = [...block.classList].includes('video-hero');
  const video = buildDefaultVideo(id, inHero);
  block.innerHTML = video;

  if (inHero) {
    block.parentNode.classList.add('video-wrapper-hero');
    // build play button
    const playButton = document.createElement('div');
    playButton.classList.add('video-hero-play');
    playButton.addEventListener('click', displayVideo);
    block.parentNode.append(playButton);
    // build close button
    const closeButton = document.createElement('div');
    closeButton.classList.add('video-hero-close');
    closeButton.addEventListener('click', closeVideo);
    block.prepend(closeButton);
  }

  block.setAttribute('data-video-status', 'loaded');
}

function loadVideo(block) {
  const status = block.getAttribute('data-video-status');
  // eslint-disable-next-line no-useless-return
  if (status === 'loaded') return;

  const videoLink = block.querySelector('a');
  if (videoLink) {
    // load video from franklin media
    loadFranklinVideo(videoLink.href, block);
  } else {
    const id = block.textContent.trim();
    if (id) {
      loadBrightcoveVideo(id, block);
    }
  }
}

function intersectHandler(entries) {
  const entry = entries[0];
  if (entry.isIntersecting) {
    const block = entry.target;
    loadVideo(block);
  }
}

export default function decorate(block) {
  const observer = new IntersectionObserver(intersectHandler, { threshold: 0 });
  observer.observe(block);
}
