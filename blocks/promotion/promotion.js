import { fetchPlaceholders } from '../../scripts/scripts.js';

function getDateObj(dateStr) {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear().toString(),
    month: (date.getMonth() + 1).toString().padStart(2, '0'),
    day: date.getDay().toString(),
    hour: date.getHours().toString().padStart(2, '0'),
    minutes: date.getMinutes().toString(),
  };
}

function getStartEndDates(countdown, spanStr) {
  if (spanStr.includes('-')) {
    const [start, end] = spanStr.split(' ').find((s) => s.includes('-')).replace(',', '').split('-');
    return {
      start: `${parseInt(countdown.year, 10) - 5}${countdown.month}${start.padStart(2, '0')}`,
      end: `${parseInt(countdown.year, 10) + 5}${countdown.month}${end.padStart(2, '0')}`,
    };
  }
  return {
    start: `${parseInt(countdown.year, 10) - 5}${countdown.month}01`,
    end: `${parseInt(countdown.year, 10) + 5}${countdown.month}28`,
  };
}

async function buildClock(block) {
  const placeholders = await fetchPlaceholders();
  const countdown = getDateObj(placeholders.countdown);
  const dates = getStartEndDates(countdown, placeholders.dates);
  // setup clock
  window[`rolex${placeholders.rolexId}`] = [{
    city: placeholders.city,
    local: 'Your Time',
    cdtext: 'Change countdown values',
    startDate: dates.start,
    endDate: dates.end,
    cdyear: countdown.year,
    cdmonth: countdown.month,
    cdday: countdown.day,
    cdhour: countdown.hour,
    cdmin: countdown.minutes,
    offset: placeholders.eventOffset,
    dst: '0',
  }];
  const clock = document.createElement('div');
  clock.className = 'rolex-frame';
  clock.innerHTML = `<iframe
      id="rolexFrame${placeholders.rolexId}"
      src="/blocks/promotion/rolex/rolex-frame.html?cities=rolex${placeholders.rolexId}"
      style="width:100%;height:90px;border:0;padding:0;overflow:hidden;scroll:none"
      scrolling="NO"
      frameborder="NO"
      transparency="true">
    </iframe>`;
  block.append(clock);
}

async function buildToggle(block) {
  const placeholders = await fetchPlaceholders();
  const toggle = document.createElement('div');
  toggle.className = 'rolex-frame';
  toggle.innerHTML = `<iframe
      id="rolexFrame1txbOyjg"
      class="rolex-frame-medium"
      src="/blocks/promotion/rolex/rolex-frameToggle.html?eventcity=${placeholders.city.split(' ').join('+')}&utc=${placeholders.eventOffset}&lang=en"
      style="width:450px;height:100px;border:0;margin:0;padding:0;overflow:hidden;scroll:none"
      scrolling="NO"
      frameborder="NO"
      transparency="true">
    </iframe>
    <iframe
      id="rolexFrame1txbOyjg"
      class="rolex-frame-small"
      src="/blocks/promotion/rolex/rolex-frameToggleMobile.html?eventcity=${placeholders.city.split(' ').join('+')}&utc=${placeholders.eventOffset}&lang=en"
      style="width:100%;height:58px;border:0px;margin:0px;padding:0px;overflow:hidden;background-color:rgb(0,96,57);"
      scrolling="NO"
      frameborder="NO"
      transparency="true">
    </iframe>`;
  block.append(toggle);
}

export default function decorate(block) {
  const observer = new IntersectionObserver(async (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();

      if (block.className.includes('clock')) {
        buildClock(block);
      } else if (block.className.includes('toggle')) {
        buildToggle(block);
      }
    }
  }, { threshold: 0 });

  observer.observe(block.parentElement);
}
