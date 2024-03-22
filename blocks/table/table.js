import { fetchGraphQL, fetchPlaceholders, readBlockConfig } from '../../scripts/scripts.js';

function buildCell(col, rowNum) {
  const cell = rowNum > 0 ? document.createElement('td') : document.createElement('th');
  cell.innerHTML = typeof col === 'object' ? col.innerHTML : col;
  if (rowNum) {
    // eslint-disable-next-line eqeqeq
    if (cell.textContent == parseInt(cell.textContent, 10)) {
      // if cell contents are only numerical
      cell.classList.add('table-cell-num');
    }
  }
  return cell;
}

async function buildDataTable(table, head, body, resp, config) {
  if (resp.statDetails) {
    const { statDetails } = resp;
    if (statDetails.rows && statDetails.statHeaders) {
      // build table head
      const headData = [
        'Rank This Week',
        'Rank Difference',
        'Player Name',
        ...Object.values(statDetails.statHeaders),
      ];
      headData.forEach((hd) => head.append(buildCell(hd)));
      // build table body
      for (let i = 0; i < 5; i += 1) { // display top five
        const player = statDetails.rows[i];
        const playerName = player.playerName.split(' ');
        const playerLink = document.createElement('em');
        playerLink.innerHTML = `<a
          href="https://www.pgatour.com/players/player.${player.playerId}.${playerName[0]}-${playerName[1]}.html">
            ${playerName[0]} ${playerName[1]}
          </a>`;
        const rankDifferenceContainer = document.createElement('p');
        const rankDifference = document.createElement('div');
        rankDifferenceContainer.append(rankDifference);
        if (player.rankDiff === '0' || player.rankDiff === '-') {
          rankDifference.innerHTML = '-';
        } else if (player.rankChangeTendency === 'UP') {
          rankDifference.innerHTML = `+${player.rankDiff}`;
          rankDifference.style.color = '#25845D';
        } else if (player.rankChangeTendency === 'DOWN') {
          rankDifference.innerHTML = `-${player.rankDiff}`;
          rankDifference.style.color = '#ED0000';
        }
        const rowData = [
          player.rank,
          rankDifferenceContainer,
          playerLink,
          ...Object.values(Object.values(player.stats)).map((stat) => stat.statValue)];
        const row = document.createElement('tr');
        rowData.forEach((rd) => row.append(buildCell(rd, i + 1)));
        body.append(row);
      }
      table.append(head, body);
      // build caption
      if (statDetails.statTitle) {
        const caption = document.createElement('caption');
        caption.innerHTML = `${config.year || new Date().getFullYear()} <strong>${statDetails.statTitle}</strong>`;
        table.prepend(caption);
      }
    }
  }
  return table;
}

async function getStatDetails(config) {
  try {
    const placeholders = await fetchPlaceholders();
    const resp = await fetchGraphQL(`query StatDetails($statId: String!, $tourCode: TourCode!, $year: Int, $eventQuery: StatDetailEventQuery) {
  statDetails(statId: $statId, tourCode: $tourCode, eventQuery: $eventQuery, year: $year) {
    displaySeason
    lastProcessed
    statDescription
    statHeaders
    statId
    statTitle
    tourCode
    tourAvg
    statType
    tournamentPills {
      displayName
      tournamentId
    }
    year
    yearPills {
      displaySeason
      year
    }
    cutOffNumber
    cutOffButtonText
    rows {
    ... on StatDetailsPlayer {
        __typename
        rankChangeTendency
        country
        countryFlag
        playerId
        playerName
        rank
        rankDiff
        rankLogoDark
        rankLogoLight
        stats {
          color
          statName
          statValue
        }
      }
    ... on StatDetailTourAvg {
        __typename
        displayName
        value
      }
    }
    statCategories {
      category
      displayName
      subCategories {
        stats {
          statId
          statTitle
        }
        displayName
      }
    }
  }
}`, {
      tourCode: placeholders.tourCode.toUpperCase(),
      statId: config['stat-id'],
      year: config.year,
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json.data) {
        return json.data;
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not retrieve Stat Details', err);
  }
  return {};
}

export default async function decorate(block) {
  const date = new Date();
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const body = document.createElement('tbody');
  if (block.className.includes('stats')) {
    const config = readBlockConfig(block);
    if (config.year === 'current') {
      config.year = date.getFullYear();
    }
    block.innerHTML = '';
    if (config['stat-id']) {
      const observer = new IntersectionObserver(async (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          const statsTable = await buildDataTable(
            table,
            head,
            body,
            await getStatDetails(config),
            config,
          );
          block.innerHTML = statsTable.outerHTML;
        }
      }, { threshold: 0 });

      observer.observe(block);
    }
  } else {
    // build rows
    block.querySelectorAll(':scope > div').forEach((row, i) => {
      const tr = document.createElement('tr');
      // build cells
      row.querySelectorAll('div').forEach((col) => {
        tr.append(buildCell(col, i));
      });
      if (i > 0) body.append(tr);
      else head.append(tr);
    });
    // populate table
    table.append(head, body);
  }
  block.innerHTML = table.outerHTML;
}
