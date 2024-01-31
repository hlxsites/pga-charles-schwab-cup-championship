// eslint-disable-next-line import/no-cycle
import {
  decorateIcons,
  fetchPlaceholders,
  sampleRUM,
  decorateBlock,
  loadBlock,
  loadScript,
  getMetadata,
  fetchGraphQL,
  sendAnalyticsPageEvent,
} from './scripts.js';

const placeholders = await fetchPlaceholders();
const isProd = window.location.hostname.endsWith(placeholders.hostname);

if (!isProd === 'this') {
  // temporary override for analytics testing
  if (!localStorage.getItem('OptIn_PreviousPermissions')) localStorage.setItem('OptIn_PreviousPermissions', '{"aa":true,"mediaaa":true,"target":true,"ecid":true,"adcloud":true,"aam":true,"campaign":true,"livefyre":false}');
}

// Core Web Vitals RUM collection
sampleRUM('cwv');

// add more delayed functionality here
window.pgatour = window.pgatour || {};
window.pgatour.tracking = {
  branch: {
    apiKey: 'key_live_nnTvCBCejtgfn40wtbQ6ckiprsemNktJ',
    isWebView: 'false',
  },
  krux: {
    id: '',
  },
  indexExchange: {
    status: false,
  },
};

/* setup favorite players */
function alphabetize(a, b) {
  if (a.nameL.toUpperCase() < b.nameL.toUpperCase()) return -1;
  if (a.nameL.toUpperCase() > b.nameL.toUpperCase()) return 1;
  return 0;
}

async function loadPlayers() {
  if (!window.players) {
    const resp = await fetch('https://statdata.pgatour.com/players/player.json');
    if (resp.ok) {
      const { plrs } = await resp.json();
      const players = {
        byId: {},
        r: [],
        s: [],
        h: [],
      };
      plrs.forEach((p) => {
        if (!players.byId[p.pid]) {
          players.byId[p.pid] = p;
          // display in pga tour (R)
          if (p.disR === 'y') players.r.push(p);
          // display in champions tour (S)
          if (p.disS === 'y') players.s.push(p);
          // display in korn ferry tour (H)
          if (p.disH === 'y') players.h.push(p);
        }
      });
      players.r.sort(alphabetize);
      players.s.sort(alphabetize);
      players.h.sort(alphabetize);
      window.players = players;
    }
  }
  return window.players || {};
}

function updateSelectPlayer(select, tour, players) {
  select.innerHTML = '';
  // eslint-disable-next-line no-use-before-define
  select.addEventListener('change', clearFindPlayer);
  const defaultOption = document.createElement('option');
  defaultOption.disabled = true;
  defaultOption.selected = true;
  defaultOption.textContent = 'Select Player';
  select.prepend(defaultOption);
  players.forEach((player) => {
    const option = document.createElement('option');
    option.setAttribute('data-tour', tour);
    option.setAttribute('value', player.pid);
    option.textContent = `${player.nameL}, ${player.nameF}`;
    select.append(option);
  });
}

function updateFindPlayerInput(e) {
  const target = e.target.closest('li');
  const input = target.parentNode.parentNode.querySelector('input');
  input.value = target.textContent;
  input.setAttribute('data-value', target.getAttribute('value'));
  // eslint-disable-next-line no-use-before-define
  clearSelectPlayer();
}

function updateFindPlayer(input, tour, players) {
  const wrapper = input.parentNode.querySelector('.gigya-find-player-options');
  players.forEach((player) => {
    const option = document.createElement('li');
    option.className = 'hide';
    option.setAttribute('data-tour', tour);
    option.setAttribute('value', player.pid);
    option.textContent = `${player.nameL}, ${player.nameF}`;
    option.addEventListener('click', updateFindPlayerInput);
    wrapper.append(option);
  });
}

function filterFindPlayer(e) {
  const { target } = e;
  const value = target.value.trim().toLowerCase();
  const parent = target.parentNode.querySelector('.gigya-find-player-options');
  let visibleOptions = 0;
  parent.querySelectorAll('li').forEach((option) => {
    if (value.length && option.textContent.toLowerCase().includes(value)) {
      option.classList.remove('hide');
      visibleOptions += 1;
    } else {
      option.classList.add('hide');
    }
  });
  parent.setAttribute('data-options', visibleOptions);
}

function setupFindPlayer(input) {
  const options = document.createElement('ul');
  options.className = 'gigya-find-player-options';
  input.after(options);
  input.addEventListener('keyup', filterFindPlayer);
}

function getPlayerIdFromForm() {
  const findPlayer = document.querySelector('input[name="data.findPlayer"]');
  const findValue = findPlayer.getAttribute('data-value');
  const selectPlayer = document.querySelector('select[name="data.players"]');
  const selectValue = selectPlayer.value === 'Select Player' ? null : selectPlayer.value;
  return findValue || selectValue;
}

function getTourCodeFromForm() {
  return document.querySelector('select[name="data.tour"]').value;
}

function clearFindPlayer() {
  const findPlayer = document.querySelector('input[name="data.findPlayer"]');
  if (findPlayer) {
    findPlayer.value = '';
    findPlayer.removeAttribute('data-value');
  }
}

function clearSelectPlayer() {
  const selectPlayer = document.querySelector('select[name="data.players"]');
  if (selectPlayer) selectPlayer.selectedIndex = 0;
}

async function updateFavoriteLeaderboardAfterOperation(res) {
  // eslint-disable-next-line no-use-before-define
  updateFavoriteButtons(res.requestParams);
}

async function updateFavoritePlayersAfterAdd(res) {
  // eslint-disable-next-line no-use-before-define
  await writeFavoritePlayers(res.requestParams.data.favorites);
  clearFindPlayer();
  clearSelectPlayer();
  updateFavoriteLeaderboardAfterOperation(res);
}

async function updateFavoritePlayersAfterRemove(res) {
  // eslint-disable-next-line no-use-before-define
  await writeFavoritePlayers(res.requestParams.data.favorites);
  updateFavoriteLeaderboardAfterOperation(res);
}

function updateFavoritePlayerFromLeaderboard(res) {
  const button = document.querySelector('.leaderboard-favorite-button[data-selected="true"]');
  if (button) {
    button.removeAttribute('data-selected');
    const operation = button.getAttribute('data-op');
    const playerId = button.getAttribute('data-id');
    const tourCode = button.getAttribute('data-tour');
    const { favorites } = res.data;
    let newFavorites = favorites;
    if (operation === 'add') {
      newFavorites.push({
        createdDate: new Date().toISOString(),
        tourCode,
        playerId,
      });
    } else if (operation === 'remove') {
      newFavorites = newFavorites.filter((fave) => fave.playerId !== playerId);
    }
    // eslint-disable-next-line no-undef
    gigya.accounts.setAccountInfo({
      data: { favorites: newFavorites },
      callback: updateFavoriteLeaderboardAfterOperation,
    });
  }
}

function addFavoritePlayerFromMenu(res) {
  const { favorites } = res.data;
  const playerId = getPlayerIdFromForm();
  const tourCode = getTourCodeFromForm();
  const alreadyInFavorites = favorites.find((fave) => fave.playerId === playerId);
  if (!alreadyInFavorites) {
    favorites.push({
      createdDate: new Date().toISOString(),
      tourCode,
      playerId,
    });
    // eslint-disable-next-line no-undef
    gigya.accounts.setAccountInfo({
      data: { favorites },
      callback: updateFavoritePlayersAfterAdd,
    });
  } else {
    clearFindPlayer();
    clearSelectPlayer();
  }
}

function addFavoritePlayerFromLeaderboard(e) {
  const button = e.target.closest('button');
  button.setAttribute('data-selected', true);
  // eslint-disable-next-line no-undef
  gigya.accounts.getAccountInfo({ callback: updateFavoritePlayerFromLeaderboard });
}

function removeFavoritePlayerFromMenu(res) {
  const { favorites } = res.data;
  const favoritesList = document.querySelector('.gigya-your-favorites');
  const selectedPlayer = favoritesList.querySelector('[data-selected="true"]');
  selectedPlayer.removeAttribute('data-selected');
  const playerId = selectedPlayer.getAttribute('data-id');
  const playerToRemove = favorites.find((fave) => fave.playerId === playerId);
  if (playerToRemove) {
    const newFavorites = favorites.filter((fave) => fave !== playerToRemove);
    // eslint-disable-next-line no-undef
    gigya.accounts.setAccountInfo({
      data: { favorites: newFavorites },
      callback: updateFavoritePlayersAfterRemove,
    });
  }
}

function removeFavoritePlayerFromLeaderboard(e) {
  const button = e.target.closest('button');
  button.setAttribute('data-selected', true);
  // eslint-disable-next-line no-undef
  gigya.accounts.getAccountInfo({ callback: updateFavoritePlayerFromLeaderboard });
}

function updateFavoritePlayersFromMenu(e, operation, id) {
  e.preventDefault();
  if (id && operation === 'add') {
    // eslint-disable-next-line no-undef
    gigya.accounts.getAccountInfo({ callback: addFavoritePlayerFromMenu });
  } else if (id && operation === 'remove') {
    // eslint-disable-next-line no-undef
    gigya.accounts.getAccountInfo({ callback: removeFavoritePlayerFromMenu });
  }
}

async function writeFavoritePlayers(favorites) {
  const wrapper = document.querySelector('.gigya-your-favorites');
  wrapper.innerHTML = '';
  const players = await loadPlayers();
  favorites.forEach((favorite) => {
    const player = players.byId[favorite.playerId];
    const row = document.createElement('div');
    row.setAttribute('data-tour', favorite.tourCode);
    row.setAttribute('data-id', favorite.playerId);
    row.innerHTML = `<p>${player.nameF} ${player.nameL}</p>
      <button><span class="icon icon-close"></span></button>`;
    const button = row.querySelector('button');
    button.addEventListener('click', (e) => {
      const target = e.target.closest('[data-id]');
      target.setAttribute('data-selected', true);
      const id = target.getAttribute('data-id');
      updateFavoritePlayersFromMenu(e, 'remove', id);
    });
    wrapper.append(row);
  });
}

async function setupFavoritePlayersScreen(userData) {
  const players = await loadPlayers();
  // setup user favorites
  const wrapper = document.createElement('div');
  wrapper.className = 'gigya-your-favorites';
  const h2 = document.querySelector('h2[data-translation-key="HEADER_53211634253006840_LABEL"]');
  if (h2) h2.after(wrapper);
  if (userData && userData.favorites) {
    await writeFavoritePlayers(userData.favorites);
  }
  // setup add more
  const tourDropdown = document.querySelector('select[name="data.tour"]');
  const findPlayer = document.querySelector('input[name="data.findPlayer"]');
  const selectPlayer = document.querySelector('select[name="data.players"]');
  const addButton = document.querySelector('.js-add-player.gigya-add-player');
  if (tourDropdown && findPlayer && selectPlayer && addButton) {
    tourDropdown.addEventListener('change', () => {
      const { value } = tourDropdown;
      findPlayer.setAttribute('data-filter', value);
      clearFindPlayer();
      updateFindPlayer(findPlayer, value, players[value]);
      selectPlayer.setAttribute('data-filter', value);
      clearSelectPlayer();
      updateSelectPlayer(selectPlayer, value, players[value]);
    });
    setupFindPlayer(findPlayer);
    updateFindPlayer(findPlayer, tourDropdown.value, players[tourDropdown.value]);
    updateSelectPlayer(selectPlayer, tourDropdown.value, players[tourDropdown.value]);
    addButton.addEventListener('click', (e) => {
      const id = getPlayerIdFromForm();
      updateFavoritePlayersFromMenu(e, 'add', id);
    });
  }
  // remove non-submit button
  const submit = document.querySelector('#gigya-players-screen.gigya-screen input[type=submit].gigya-input-submit');
  if (submit) submit.remove();
}

function updateFavoriteButtons(res) {
  const buttons = document.querySelectorAll('.leaderboard-favorite-button');
  if (res && res != null && res.data) {
    const favorites = res.data.favorites || [];
    buttons.forEach((btn) => {
      // eslint-disable-next-line no-use-before-define
      btn.removeEventListener('click', promptToLogin);
      const playerId = btn.getAttribute('data-id');
      const isFavorite = favorites.find((fave) => fave.playerId === playerId);
      const icon = btn.querySelector('.icon');
      const tooltip = btn.nextElementSibling;
      if (isFavorite) {
        btn.setAttribute('data-op', 'remove');
        if (icon) icon.className = 'icon icon-minus';
        if (tooltip && tooltip.className === 'tooltip') {
          tooltip.querySelector('.tooltip-op').textContent = 'Remove from';
        }
        btn.removeEventListener('click', addFavoritePlayerFromLeaderboard);
        btn.addEventListener('click', removeFavoritePlayerFromLeaderboard);
      } else {
        btn.setAttribute('data-op', 'add');
        // ensure add to favorite button
        if (icon) icon.className = 'icon icon-plus';
        if (tooltip && tooltip.className === 'tooltip') {
          tooltip.querySelector('.tooltip-op').textContent = 'Add to';
        }
        btn.removeEventListener('click', removeFavoritePlayerFromLeaderboard);
        btn.addEventListener('click', addFavoritePlayerFromLeaderboard);
      }
    });
  }
}

function resetFavoriteButtons() {
  const buttons = document.querySelectorAll('.leaderboard-favorite-button');
  buttons.forEach((btn) => {
    const icon = btn.querySelector('.icon');
    const tooltip = btn.nextElementSibling;
    btn.setAttribute('data-op', 'add');
    // ensure add to favorite button
    if (icon) icon.className = 'icon icon-plus';
    if (tooltip && tooltip.className === 'tooltip') {
      tooltip.querySelector('.tooltip-op').textContent = 'Add to';
    }
    btn.removeEventListener('click', removeFavoritePlayerFromLeaderboard);
    btn.removeEventListener('click', addFavoritePlayerFromLeaderboard);
    // eslint-disable-next-line no-use-before-define
    btn.addEventListener('click', promptToLogin);
  });
}

function promptToLogin() {
  const modal = document.createElement('aside');
  modal.classList.add('login-modal');
  modal.innerHTML = `<div class="login-modal-close-wrapper">
      <button class="login-modal-close"><span class="icon icon-close"></span></button>
    </div>
    <p>${placeholders.loginPrompt}</p>
    <div class="button-container">
      <button class="button" id="login-modal-button">${placeholders.loginYes}</button> 
      <button class="button login-modal-close">${placeholders.loginNo}</button> 
    </div>`;
  modal.querySelector('#login-modal-button').addEventListener('click', () => {
    // eslint-disable-next-line no-use-before-define
    showLoginMenu();
    modal.remove();
  });
  modal.querySelectorAll('.login-modal-close').forEach((btn) => {
    btn.addEventListener('click', () => modal.remove());
  });
  document.querySelector('main').prepend(modal);
}

function setupFavoriteButtons(res) {
  const favoriteButtons = document.querySelectorAll('.leaderboard-favorite-button');
  favoriteButtons.forEach((button) => {
    if (res && res != null && res.errorCode === 0) { // user is logged in
      updateFavoriteButtons(res);
    } else {
      button.addEventListener('click', promptToLogin);
    }
  });
}

function setupAccountMenu(res) {
  // setup favorite players
  if (res.currentScreen === 'gigya-players-screen') {
    setupFavoritePlayersScreen(res.data);
  }
  // setup logout
  const logoutBtn = document.querySelector('a[href="javascript:pgatour.GigyaSocialize.logout()"]');
  if (logoutBtn) {
    logoutBtn.removeAttribute('href');
    // eslint-disable-next-line no-use-before-define
    logoutBtn.addEventListener('click', logout);
    logoutBtn.style.cursor = 'pointer';
  }
}

/* setup user authentication */
function saveUserInfo(userInfo) {
  sessionStorage.setItem('gigyaAccount', JSON.stringify(userInfo));
}

function removeUserInfo() {
  sessionStorage.removeItem('gigyaAccount');
}

function showAccountMenu() {
  // eslint-disable-next-line no-undef
  gigya.accounts.showScreenSet({
    screenSet: 'Website-ManageProfile',
    onAfterScreenLoad: setupAccountMenu,
  });
}

function showLoginMenu() {
  // eslint-disable-next-line no-undef
  gigya.accounts.showScreenSet({
    screenSet: 'Website-RegistrationLogin',
    startScreen: 'gigya-long-login-screen',
    // eslint-disable-next-line no-use-before-define
    onAfterSubmit: updateGigyaButtons,
  });
}

function updateUserButton(user) {
  // eslint-disable-next-line no-param-reassign
  if (user.eventName === 'afterSubmit') user = user.response.user;
  const button = document.getElementById('nav-user-button');
  if (user && user != null && user.isConnected) {
    saveUserInfo({
      isConnected: user.isConnected,
      thumbnailURL: user.thumbnailURL,
    });
    // add button caret
    button.innerHTML = `${button.innerHTML}<span class="icon icon-caret"></span>`;
    // update button text
    const text = button.querySelector('span:not([class])');
    text.textContent = 'Manage Profile';
    // update button icon
    if (user.thumbnailURL.length > 0 && !button.querySelector('img')) {
      const icon = button.querySelector('span.icon.icon-user');
      const img = document.createElement('img');
      img.src = user.thumbnailURL;
      img.alt = 'User Profile Thumbnail';
      icon.replaceWith(img);
    }
    // reset click to open manage account
    button.removeEventListener('click', showLoginMenu);
    button.addEventListener('click', showAccountMenu);
  }
}

function clearUserButton() {
  const button = document.getElementById('nav-user-button');
  if (button) {
    // remove caret
    const caret = button.querySelector('.icon.icon-caret');
    if (caret) caret.remove();
    // update button text
    const text = button.querySelector('span:not([class])');
    text.textContent = 'Login/Register';
    // update button icon
    const img = button.querySelector('img');
    if (img) {
      const icon = document.createElement('span');
      icon.classList.add('icon', 'icon-user');
      img.replaceWith(icon);
      decorateIcons(button);
    }
    // reset click to open login menu
    button.removeEventListener('click', showAccountMenu);
    button.addEventListener('click', showLoginMenu);
  }
}

function logout() {
  clearUserButton();
  resetFavoriteButtons();
  // eslint-disable-next-line no-undef
  gigya.accounts.hideScreenSet({ screenSet: 'Website-ManageProfile' });
  // eslint-disable-next-line no-undef
  gigya.socialize.logout({ callback: removeUserInfo });
}

function setupUserButton(res) {
  const button = document.getElementById('nav-user-button');
  if (button) {
    if (res && res != null && res.errorCode === 0) { // user is logged in
      const user = res.profile;
      user.isConnected = true;
      updateUserButton(user);
    } else {
      clearUserButton();
      removeUserInfo();
      // set click to open login menu
      button.addEventListener('click', showLoginMenu);
    }
    button.setAttribute('data-status', 'initialized');
  }
}

function updateGigyaButtons(res) {
  updateUserButton(res);
  updateFavoriteButtons(res);
}

function setupGigyaButtons(res) {
  setupUserButton(res);
  setupFavoriteButtons(res);
}

function checkIfLoggedIn(res) {
  if (res && res != null && res.errorCode === 0) { // user is logged in
    // eslint-disable-next-line no-undef
    gigya.accounts.getAccountInfo({ callback: setupGigyaButtons });
  } else {
    clearUserButton();
    removeUserInfo();
    setupUserButton();
    setupFavoriteButtons();
  }
}

function setupGigya() {
  // eslint-disable-next-line no-undef
  gigya.accounts.session.verify({ callback: checkIfLoggedIn });
}

// eslint-disable-next-line import/prefer-default-export
export function initGigya() {
  const userButton = document.getElementById('nav-user-button');
  if (userButton) userButton.replaceWith(userButton.cloneNode(true));
  const favoriteButtons = document.querySelectorAll('.leaderboard-favorite-button');
  if (favoriteButtons) favoriteButtons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
  loadScript(
    'https://cdns.gigya.com/JS/socialize.js?apikey=3__4H034SWkmoUfkZ_ikv8tqNIaTA0UIwoX5rsEk96Ebk5vkojWtKRZixx60tZZdob',
    setupGigya,
  );
}

initGigya();

/* status bar weather */
async function populateStatusBar(statusBar) {
  if (statusBar) {
    const statusBarData = document.querySelector('.status-bar-data');
    const id = `${placeholders.tourCode.toUpperCase()}${placeholders.currentYear}${placeholders.tournamentId}`;
    // fetch weather
    try {
      const weatherResp = await fetchGraphQL(`query Weather($tournamentId: ID!) {
        weather(tournamentId: $tournamentId) {
          hourly {
            condition
            temperature {
              ... on StandardWeatherTemp {
                __typename
                tempF
              }
              ... on RangeWeatherTemp {
                __typename
                maxTempF
              }
            }
          }
        }
      }
      `, {
        tournamentId: id,
      });
      if (weatherResp.ok) {
        const weatherData = await weatherResp.json();
        if (weatherData && weatherData.data && weatherData.data.weather) {
          const location = placeholders.city;
          const currentWeather = weatherData.data.weather.hourly[0];
          const icon = `/icons/weather-${currentWeather.condition.toLowerCase().replaceAll('_', '-')}.svg`;
          // eslint-disable-next-line no-underscore-dangle
          const temp = currentWeather.temperature.__typename === 'StandardWeatherTemp' ? currentWeather.temperature.tempF : currentWeather.temperature.maxTempF;
          sessionStorage.setItem(`${id}Weather`, JSON.stringify({
            location, icon, temp,
          }));
          const weatherDisplayed = statusBar.querySelector('.status-bar-weather');
          if (weatherDisplayed) {
            const barLocation = weatherDisplayed.querySelector('.status-bar-location');
            barLocation.textContent = location;
            const barImg = weatherDisplayed.querySelector('img');
            barImg.src = icon;
            barImg.alt = currentWeather.condition;
            const barTemp = weatherDisplayed.querySelector('.status-bar-temp');
            barTemp.textContent = temp;
          } else {
            const weather = document.createElement('div');
            weather.className = 'status-bar-weather';
            weather.innerHTML = `<p>
                  <a href="/weather">
                    <span class="status-bar-location">${location}</span>
                    <img src="${icon}" alt="${currentWeather.condition}"/ >
                    <span class="status-bar-temp">${temp}</span>
                  </a>
                </p>`;
            statusBarData.append(weather);
          }
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('failed to load weather', error);
    }
  }
}

populateStatusBar(document.querySelector('header > .status-bar'));

/* setup cookie preferences */
function getCookie(cookieName) {
  const name = `${cookieName}=`;
  const decodedCookie = decodeURIComponent(document.cookie);
  const split = decodedCookie.split(';');
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < split.length; i++) {
    let c = split[i];
    while (c.charAt(0) === ' ') c = c.substring(1);
    if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
  }
  return null;
}

async function OptanonWrapper() {
  const geoInfo = window.Optanon.getGeolocationData();
  Object.keys(geoInfo).forEach((key) => {
    const cookieName = `PGAT_${key.charAt(0).toUpperCase() + key.slice(1)}`;
    const cookie = getCookie(cookieName);
    if (!cookie || cookie !== geoInfo[key]) document.cookie = `${cookieName}=${geoInfo[key]}`;
  });

  const prevOptIn = localStorage.getItem('OptIn_PreviousPermissions');
  if (prevOptIn) {
    try {
      const settings = JSON.parse(prevOptIn);
      if (settings.tempImplied) {
        localStorage.removeItem('OptIn_PreviousPermissions');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('OptIn_PreviousPermissions parse failed');
    }
  }
  sendAnalyticsPageEvent();
}

const otId = placeholders.onetrustId;
if (otId) {
  const cookieScript = loadScript('https://cdn.cookielaw.org/scripttemplates/otSDKStub.js');
  cookieScript.setAttribute('data-domain-script', `${otId}${isProd ? '' : '-test'}`);
  cookieScript.setAttribute('data-dlayer-name', 'dataLayer');
  cookieScript.setAttribute('data-nscript', 'beforeInteractive');

  const gtmId = placeholders.googletagmanagerId;
  if (gtmId) {
    const GTMScript = document.createElement('script');
    GTMScript.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmId}');`;
    document.head.append(GTMScript);

    const GTMFrame = document.createElement('no-script');
    GTMFrame.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.prepend(GTMFrame);
  }

  window.OptanonWrapper = OptanonWrapper;

  if (document.querySelector('.marketing')) {
    const marketingBlock = document.querySelector('.marketing');
    decorateBlock(marketingBlock);
    loadBlock(marketingBlock);
  }
}

async function loadLiveChat() {
  const liveChat = getMetadata('live-chat');
  if (liveChat && ['yes', 'on', 'true'].includes(liveChat.toLowerCase())) {
    loadScript('//sdk.engage.co/sdk.js', () => { /* noop */ }, {
      'data-company': placeholders.chatCompany,
      'data-widget': placeholders.chatWidget,
    });
  }
}
loadLiveChat();

function injectFevoScript() {
  let fevoWidget = window.GMWidget;
  if (!fevoWidget) {
    // eslint-disable-next-line
    var fO, f1, ho = "https://fevogm.com/react/dist/js/widget/gm-widget.js", cs0 = "position:fixed;top:0;bottom:0;left:0;right:0;background:#15232e99;transitio" + "n:opacity .5s;z-index:10000;", cs1 = "text-align:center;position:absolute;color:#5" + "E5E5E;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-r" + "adius:20px;", wn = "GMWidget", aC = "appendChild", cE = "createElement", as = [], w = window, d = document, h = d.getElementsByTagName("head")[0], s = d[cE]("script"); s.type = "text/java" + "script", s.src = ho, h[aC](s), w[wn] = { open: t => { as.push(t), (fO = d[cE]("div")).style.cssText = cs0, (f1 = d[cE]("div")).style.cssText = cs1, f1.innerHTML = '<img src="https://fe' + 'vogm.com/react/dist/assets/images/FEVO_Loading.gif"/>', fO[aC](f1), d.body[aC](fO), w[wn].clear = () => (fO.remove(), as) } };
    fevoWidget = window.GMWidget;
  }

  return fevoWidget;
}

function injectWeFevoScript() {
  loadScript('https://offer.fevo.com/js/fevo.js', () => { }, {
    type: 'text/javascript',
  });
}

// there are 2 distinct types of fevo buttons
// and we need to support both
// see decorateFevoButtons in scripts.js
const hasFevo = document.querySelector('a.fevo-btn');
if (hasFevo) {
  injectFevoScript();
}

const hasWeFevo = document.querySelector('a.we-fevo-btn');
if (hasWeFevo) {
  injectWeFevoScript();
}
