let timerDisplay = document.getElementById('timer');
let fillBar = document.getElementById('fill');

let defaultDuration = 300; // 5:00 in seconds
let duration = defaultDuration;
let countdownInterval;

const csvUploadButton = document.getElementById('csvUploadButton');
const csvFileInput = document.getElementById('csvFileInput');

csvUploadButton.addEventListener('click', () => csvFileInput.click());
csvFileInput.addEventListener('change', handleFileSelect);

// API /////////////////////////////////////////////////////////////////
const BASE = "https://lous-gts-proxy.louscmh.workers.dev";

// CLASSES ///////////////////////////////////////////////////////////////
class Team {
  constructor(number) {
    this.number = number;
    this.players = []; // array of Player instances
  }
}

class Player {
  constructor(user_id, username, pfp, seed) {
    this.user_id = user_id;
    this.username = username;
    this.pfp = pfp;
    this.seed = seed;
  }
  generateSpinnerItem() {
    // console.log(`Generating spinner item for ${this.username} in seed ${this.seed}`);
    let spinnerContainer = document.getElementById(
      (`player-list-seed-${this.seed}`).toLowerCase()
    );

    this.player = document.createElement('li');
    this.player.id = `player-${this.user_id}-${this.seed}`;
    this.player.className = 'player';
    this.playerPfp = document.createElement('img');
    this.playerPfp.id = `player-pfp-${this.user_id}-${this.seed}`;
    this.playerPfp.className = 'player-pfp';
    this.playerPfp.src = this.pfp;
    this.playerName = document.createElement('span');
    this.playerName.id = `player-name-${this.user_id}-${this.seed}`;
    this.playerName.className = 'player-name';
    this.playerName.textContent = this.username;

    spinnerContainer.appendChild(this.player);
    document.getElementById(this.player.id).appendChild(this.playerPfp);
    document.getElementById(this.player.id).appendChild(this.playerName);
  }
  generateDisplayItem() {
    let seedingContainer = document.getElementById(
      (`seeding-container-seed-${this.seed}`).toLowerCase()
    );

    this.playerSeed = document.createElement('div');
    this.playerSeed.id = `seed-${this.user_id}-${this.seed}`;
    this.playerSeed.className = 'player-seed-container';
    this.playerSeedPfp = document.createElement('img');
    this.playerSeedPfp.id = `seed-pfp-${this.user_id}-${this.seed}`;
    this.playerSeedPfp.className = 'seed-pfp-container';
    this.playerSeedPfp.src = this.pfp;
    this.playerSeedPfpName = document.createElement('span');
    this.playerSeedPfpName.id = `seed-name-${this.user_id}-${this.seed}`;
    this.playerSeedPfpName.className = 'seed-name-container';
    this.playerSeedPfpName.textContent = this.username;

    seedingContainer.appendChild(this.playerSeed);
    document.getElementById(this.playerSeed.id).appendChild(this.playerSeedPfp);
    document.getElementById(this.playerSeed.id).appendChild(this.playerSeedPfpName);
  }
}

// VARIABLES /////////////////////////////////////////////////////////////
let currentTeam = 1;
let currentSeed = 'C';
let spinned = false;
let recentPlayer;
let fadeIn = true;
const spinnerPlayers = new Map();
const teams = new Map()
for (let i = 1; i <= 16; i++) {
  teams.set(i, new Team(i))
}

// teams.get(1).players.push(new Player('123', 'TestUser', 'https://a.ppy.sh/123', 'A'));

// FUNCTIONS /////////////////////////////////////////////////////////////

async function getUserDataSet(user_id) {
  const { data } = await axios.get("/get_user", {
    baseURL: BASE,
    params: { u: user_id, m: 3 }
  });
  return data.length ? data[0] : null;
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => processCSV(evt.target.result);
  reader.readAsText(file);
}

async function processCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  const players = lines.map(line => {
    const vals = line.split(',');
    return headers.reduce((obj, h, i) => {
      obj[h.trim()] = vals[i]?.trim();
      return obj;
    }, {});
  });
  console.log(players);

  // group by seed → array of { user, username, pfp }
  const grouped = players.reduce((acc, cur) => {
    const { seed, user, username } = cur;
    if (!acc[seed]) acc[seed] = [];
    acc[seed].push({
      user,
      username,
      pfp: `https://a.ppy.sh/${user}`
    });
    return acc;
  }, {});
  // console.log(grouped);

  Object.entries(grouped).forEach(([seed, users]) => {
    // initialize a map for this seed if it doesn't exist
    if (!spinnerPlayers.has(seed)) {
      spinnerPlayers.set(seed, new Map());
    }
    const seedMap = spinnerPlayers.get(seed);

    users.forEach(({ user, username, pfp }) => {
      const player = new Player(user, username, pfp, seed);
      // store the Player instance under its user_id
      seedMap.set(username, player);
    });
  });
  console.log(spinnerPlayers);
  const $ul = $(`#player-list-seed-c`);
  buildSpinner($ul, 'C');
  buttonGlow(document.getElementById('promptSeedButton'));
}

function spinDraft() {
  if (spinnerPlayers.size === 0) {
    buttonGlow(document.getElementById('csvUploadButton'));
    console.log("No players loaded, upload CSV first");
    return;
  }
  if (spinned) {
    buttonGlow(document.getElementById('confirmButton'));
    console.log("Already spinned, confirm first");
    return;
  }
  // first, check for any empty slots in the current team‐seed container
  const playersContainer = document.getElementById(
    `team-seed-${currentSeed.toLowerCase()}-players`
  );
  const slots = playersContainer.querySelectorAll('.player-seed');
  const hasEmptySlot = Array.from(slots).some(slot => {
    const imgEl = slot.querySelector('img.player-pfp');
    const nameEl = slot.querySelector('span.player-name');
    return !imgEl.getAttribute('src') || !nameEl.textContent.trim();
  });
  if (!hasEmptySlot) {
    if (currentTeam < 16) {
      console.log("No empty slots in current team-seed, move to next team");
      buttonGlow(document.getElementById('nextTeamButton'));
    } else if (currentSeed < 'C') {
      console.log("No more teams to fill, move to next seed");
      buttonGlow(document.getElementById('nextSeedButton'));
    }
    return;
  };

  console.log("Spin Check Passed");
  spinned = true;
  document.getElementById("intermediaryStopButton").click();

  // grab the player list UL
  const $ul = $(`#player-list-seed-${currentSeed.toLowerCase()}`);

  // spin with bandit
  $ul.bandit({
    speed: [40, 60],
    delay: 0,
    autoStop: [1000, 1500],
    decel: .4,
    spinOnLoad: true,
    done: function (finalHtml) {
      // parse out pfp URL and player name
      const $frag = $('<div>').append(finalHtml);
      const pfp = $frag.find('img').attr('src');
      const name = $frag.find('.player-name').text().trim();

      // fill the first empty slot in the team container
      for (let slot of slots) {
        const imgEl = slot.querySelector('img.player-pfp');
        const nameEl = slot.querySelector('span.player-name');
        if (!imgEl.getAttribute('src') || !nameEl.textContent.trim()) {
          imgEl.setAttribute('src', pfp);
          nameEl.textContent = name;
          applyBob(slot);
          break;
        }
      }

      recentPlayer = spinnerPlayers.get(currentSeed).get(name) || null;
      buttonGlow(document.getElementById('confirmButton'));
      console.log(`Selected player: ${name} (${pfp})`);
      console.log(recentPlayer);
    }
  });
}

function buildSpinner($ul, seed) {
  const seedMap = spinnerPlayers.get(seed) || new Map();
  const visibleCount = 11;
  let totalItem = seedMap.size;

  // clear existing items
  $ul.empty();

  if (seedMap.size === 0) {
    return;
  }

  // build items from spinnerPlayers
  seedMap.forEach(player => {
    player.generateSpinnerItem();
    player.generateDisplayItem();
  });

  // duplicate items until we reach the visibleCount
  const $originals = $ul.children().clone();
  while ($ul.children().length < visibleCount) {
    $ul.append($originals.clone());
    totalItem += seedMap.size;
  }

  // if even number of players, shift to center
  console.log(seedMap.size, totalItem);
  if (totalItem % 2 == 0) {
    console.log("even")
    $ul.css('transform', 'translateY(-45px)');
  } else {
    console.log("odd");
    $ul.css('transform', 'translateY(0px)');
  }

  // use an intermediary button as the bandit stop trigger
  $ul.bandit({
    speed: 1,
    accel: 1,
    delay: 0,
    autoStop: 0,
    spinOnLoad: true,
    stopButton: "#intermediaryStopButton"
  });
}

function confirmPlayer() {
  if (!spinned || !recentPlayer) {
    buttonGlow(document.getElementById('spinButton'));
    return
  };
  document.getElementById('transitionStinger').play();

  // update the UI
  const playersContainer = document.getElementById(
    `team-seed-${currentSeed.toLowerCase()}-players`
  );
  const slots = playersContainer.querySelectorAll('.player-seed');
  const hasEmptySlot = Array.from(slots).some(slot => {
    const imgEl = slot.querySelector('img.player-pfp');
    const nameEl = slot.querySelector('span.player-name');
    return !imgEl.getAttribute('src') || !nameEl.textContent.trim();
  });
  if (!hasEmptySlot) {
    if (currentTeam < 16) {
      buttonGlow(document.getElementById('nextTeamButton'));
    } else if (currentSeed < 'C') {
      buttonGlow(document.getElementById('nextSeedButton'));
    }
  } else {
    buttonGlow(document.getElementById('spinButton'));
  };

  setTimeout(() => {
    // remove from our in-memory map
    const seed = currentSeed;
    spinnerPlayers.get(seed).delete(recentPlayer.username);
    teams.get(currentTeam).players.push(recentPlayer);
    console.log(teams);

    const $ul = $(`#player-list-seed-${currentSeed.toLowerCase()}`);
    buildSpinner($ul, seed);
    recentPlayer = null;
    spinned = false;
  }, 500);
}

function nextTeam() {
  if (spinned) {
    buttonGlow(document.getElementById('confirmButton'));
    return;
  }
  promptTeamTransition()
  if (currentTeam < 16) {
    currentTeam++;
  } else {
    currentTeam = 1;
  }
  setTimeout(() => {
    buildTeamDisplay();
    const playersContainer = document.getElementById(
      `team-seed-${currentSeed.toLowerCase()}-players`
    );
    const slots = playersContainer.querySelectorAll('.player-seed');
    const hasEmptySlot = Array.from(slots).some(slot => {
      const imgEl = slot.querySelector('img.player-pfp');
      const nameEl = slot.querySelector('span.player-name');
      return !imgEl.getAttribute('src') || !nameEl.textContent.trim();
    });
    if (!hasEmptySlot) {
      currentTeam == 16 ? buttonGlow(document.getElementById('nextSeedButton')) : buttonGlow(document.getElementById('nextTeamButton'));
    } else {
      buttonGlow(document.getElementById('spinButton'));
    };
  }, 1300);
}

function prevTeam() {
  if (spinned) {
    buttonGlow(document.getElementById('confirmButton'));
    return;
  }
  promptTeamTransition();
  if (currentTeam > 1) {
    currentTeam--;
  } else {
    currentTeam = 16;
  }
  setTimeout(() => {
    buildTeamDisplay();
    const playersContainer = document.getElementById(
      `team-seed-${currentSeed.toLowerCase()}-players`
    );
    const slots = playersContainer.querySelectorAll('.player-seed');
    const hasEmptySlot = Array.from(slots).some(slot => {
      const imgEl = slot.querySelector('img.player-pfp');
      const nameEl = slot.querySelector('span.player-name');
      return !imgEl.getAttribute('src') || !nameEl.textContent.trim();
    });
    if (!hasEmptySlot) {
      currentTeam == 16 ? buttonGlow(document.getElementById('nextSeedButton')) : buttonGlow(document.getElementById('nextTeamButton'));
    } else {
      buttonGlow(document.getElementById('spinButton'));
    };
  }, 1300);
}

function nextSeed() {
  if (spinnerPlayers.size === 0) {
    buttonGlow(document.getElementById('csvUploadButton'));
    console.log("No players loaded, upload CSV first");
    return;
  }
  if (!fadeIn) {
    buttonGlow(document.getElementById('promptSeedButton'));
    return;
  }
  if (spinned) {
    buttonGlow(document.getElementById('confirmButton'));
    return;
  }
  document.getElementById('transitionStinger').play();
  if (currentSeed > 'A') {
    setTimeout(() => {
      currentSeed = String.fromCharCode(currentSeed.charCodeAt(0) - 1)
    }, 500);
  } else {
    setTimeout(() => {
      currentSeed = 'C';
    }, 500);
  }
  setTimeout(() => {
    updateSeedVisibility()
    const $ul = $(`#player-list-seed-${currentSeed.toLowerCase()}`);
    const playersContainer = document.getElementById(
      `team-seed-${currentSeed.toLowerCase()}-players`
    );
    const slots = playersContainer.querySelectorAll('.player-seed');
    const hasEmptySlot = Array.from(slots).some(slot => {
      const imgEl = slot.querySelector('img.player-pfp');
      const nameEl = slot.querySelector('span.player-name');
      return !imgEl.getAttribute('src') || !nameEl.textContent.trim();
    });
    if (!hasEmptySlot) {
      buttonGlow(document.getElementById('nextTeamButton'));
    } else {
      buttonGlow(document.getElementById('promptSeedButton'));
    };
    buildSpinner($ul, currentSeed);
  }, 500);
}

function prevSeed() {
  if (spinnerPlayers.size === 0) {
    buttonGlow(document.getElementById('csvUploadButton'));
    console.log("No players loaded, upload CSV first");
    return;
  }
  if (!fadeIn) {
    buttonGlow(document.getElementById('promptSeedButton'));
    return;
  }
  if (spinned) {
    buttonGlow(document.getElementById('confirmButton'));
    return;
  }
  document.getElementById('transitionStinger').play();
  if (currentSeed < 'C') {
    setTimeout(() => {
      currentSeed = String.fromCharCode(currentSeed.charCodeAt(0) + 1)
    }, 500);
  } else {
    setTimeout(() => {
      currentSeed = 'A';
    }, 500);
  }
  setTimeout(() => {
    updateSeedVisibility()
    const $ul = $(`#player-list-seed-${currentSeed.toLowerCase()}`);
    const playersContainer = document.getElementById(
      `team-seed-${currentSeed.toLowerCase()}-players`
    );
    const slots = playersContainer.querySelectorAll('.player-seed');
    const hasEmptySlot = Array.from(slots).some(slot => {
      const imgEl = slot.querySelector('img.player-pfp');
      const nameEl = slot.querySelector('span.player-name');
      return !imgEl.getAttribute('src') || !nameEl.textContent.trim();
    });
    if (!hasEmptySlot) {
      buttonGlow(document.getElementById('nextTeamButton'));
    } else {
      buttonGlow(document.getElementById('promptSeedButton'));
    };
    buildSpinner($ul, currentSeed);
  }, 500);
}

function updateSeedVisibility() {
  // show/hide spinner content per seed
  const containers = document.querySelectorAll("[id^='spinner-content-seed-']")
  containers.forEach(container => {
    const seed = container.id.split('-').pop()            // e.g. "a", "b", "c"
    container.style.opacity = (seed === currentSeed.toLowerCase()) ? '1' : '0'
  })

  // update the seed text in #spinner-text-back
  const spinnerText = document.getElementById('spinner-text-back')
  if (spinnerText) {
    spinnerText.textContent = currentSeed
    if (currentSeed === 'C') {
      spinnerText.classList.remove('spinner-text-adjustment');
    } else {
      spinnerText.classList.add('spinner-text-adjustment');
    }
  }
}

function buildTeamDisplay() {
  function pad(n) {
    return n.toString().padStart(2, '0');
  }
  const paddedTeam = pad(currentTeam);
  document.getElementById('team-text-front').innerHTML = `Team ${paddedTeam}`;
  document.getElementById('team-text-back').innerHTML = paddedTeam;

  // Find all team-seed divs
  const teamDivs = document.querySelectorAll('.team-seed');
  teamDivs.forEach(teamDiv => {
    // Within each team-seed, find the container for players
    const playersContainer = teamDiv.querySelector('.team-seed-players');
    if (!playersContainer) return;

    // For each player-seed slot, clear the image src and the player name
    const slots = playersContainer.querySelectorAll('.player-seed');
    slots.forEach(slot => {
      const imgEl = slot.querySelector('img.player-pfp');
      if (imgEl) {
        imgEl.src = 'https://lous.s-ul.eu/NoNVoJCf';
      }

      const nameEl = slot.querySelector('span.player-name');
      if (nameEl) {
        nameEl.textContent = '';
      }
    });
  });

  const currentTeamList = teams.get(currentTeam);
  console.log(currentTeamList);
  // … inside buildTeamDisplay(), replacing $SELECTION_PLACEHOLDER$:
  currentTeamList.players.forEach(player => {
    // locate the container for this player's seed
    const playersContainer = document.getElementById(
      `team-seed-${player.seed.toLowerCase()}-players`
    );
    if (!playersContainer) return;

    // find first empty slot
    const emptySlot = Array.from(
      playersContainer.querySelectorAll('.player-seed')
    ).find(slot => {
      const imgEl = slot.querySelector('img.player-pfp');
      const nameEl = slot.querySelector('span.player-name');
      return (!imgEl.getAttribute('src') || !nameEl.textContent.trim());
    });

    // fill it
    if (emptySlot) {
      emptySlot.querySelector('img.player-pfp').src = player.pfp;
      emptySlot.querySelector('span.player-name').textContent = player.username;
    }
  });

}

// new: render grouped data into #playerList
function displayGrouped(grouped) {
  const ul = document.getElementById('playerList');
  ul.innerHTML = '';
  Object.entries(grouped).forEach(([seed, users]) => {
    const li = document.createElement('li');
    li.textContent = `${seed}: ${users.join(', ')}`;
    ul.appendChild(li);
  });
}

function applyBob(object, isSpinner = false) {
  object.style.animation = isSpinner ? "bobAnimateSpinner 1.5s cubic-bezier(0,.7,.39,.99)" : "bobAnimate 1s cubic-bezier(0,.7,.39,.99)";
  setInterval(() => {
    object.style.animation = "none";
  }, 1500);
}

async function buttonGlow(button) {
  button.style.animation = "buttonGlow 2.5s ease-in-out";
  setInterval(() => {
    button.style.animation = "none";
  }, 3000);
}

function promptTeamTransition() {

  const teamTextFront = document.getElementById('team-text-front');
  const teamTextBack = document.getElementById('team-text-back');
  const teamSeedA = document.getElementById('team-seed-a');
  const teamSeedABG = document.getElementById('team-seed-a-bg');
  const teamSeedB = document.getElementById('team-seed-b');
  const teamSeedBBG = document.getElementById('team-seed-b-bg');
  const teamSeedC = document.getElementById('team-seed-c');
  const teamSeedCBG = document.getElementById('team-seed-c-bg');

  const anim = "fadeOutTeam 1s cubic-bezier(.45,0,1,.48)";
  const animIn = "fadeInTeam 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";

  // fade out cascade
  teamTextFront.style.animation = anim;
  setTimeout(() => { teamTextBack.style.animation = anim; }, 50);
  setTimeout(() => {
    teamSeedA.style.animation = anim;
    teamSeedABG.style.animation = anim;
  }, 100);
  setTimeout(() => {
    teamSeedB.style.animation = anim;
    teamSeedBBG.style.animation = anim;
  }, 200);
  setTimeout(() => {
    teamSeedC.style.animation = anim;
    teamSeedCBG.style.animation = anim;
    teamTextFront.style.opacity = '0';
    teamTextBack.style.opacity = '0';
    teamSeedA.style.opacity = '0';
    teamSeedABG.style.opacity = '0';
    teamSeedB.style.opacity = '0';
    teamSeedBBG.style.opacity = '0';
    teamSeedC.style.opacity = '0';
    teamSeedCBG.style.opacity = '0';
  }, 300);

  // fade in cascade after 100ms
  setTimeout(() => {
    teamTextFront.style.animation = animIn;
    setTimeout(() => { teamTextBack.style.animation = animIn; }, 50);
    setTimeout(() => {
      teamSeedA.style.animation = animIn;
      teamSeedABG.style.animation = animIn;
    }, 100);
    setTimeout(() => {
      teamSeedB.style.animation = animIn;
      teamSeedBBG.style.animation = animIn;
    }, 200);
    setTimeout(() => {
      teamSeedC.style.animation = animIn;
      teamSeedCBG.style.animation = animIn;
      teamTextFront.style.opacity = '1';
      teamTextBack.style.opacity = '1';
      teamSeedA.style.opacity = '1';
      teamSeedABG.style.opacity = '1';
      teamSeedB.style.opacity = '1';
      teamSeedBBG.style.opacity = '1';
      teamSeedC.style.opacity = '1';
      teamSeedCBG.style.opacity = '1';
    }, 300);
  }, 1400);
}

function promptSeedDisplay() {
  if (spinnerPlayers.size === 0) {
    buttonGlow(document.getElementById('csvUploadButton'));
    console.log("No players loaded, upload CSV first");
    return;
  }

  const teamTextFront = document.getElementById('team-text-front');
  const teamTextBack = document.getElementById('team-text-back');
  const teamSeedA = document.getElementById('team-seed-a');
  const teamSeedABG = document.getElementById('team-seed-a-bg');
  const teamSeedB = document.getElementById('team-seed-b');
  const teamSeedBBG = document.getElementById('team-seed-b-bg');
  const teamSeedC = document.getElementById('team-seed-c');
  const teamSeedCBG = document.getElementById('team-seed-c-bg');
  const spinner = document.getElementById('spinner');
  const spinnerBG = document.getElementById('spinner-bg');
  const seedingTextFront = document.getElementById('seeding-text-front');
  const seedingTextBack = document.getElementById('seeding-text-back');
  const seedingContainer = document.getElementById('seeding-container');
  const seedingContainerContent = document.getElementById(`seeding-container-seed-${currentSeed.toLowerCase()}`);

  seedingTextFront.innerHTML = `Seed ${currentSeed}`;

  const animOut = "fadeOutSeed 1s cubic-bezier(.45,0,1,.48)";
  const animIn = "fadeInTeam 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
  const animOutTeam = "fadeOutTeam 1s cubic-bezier(.45,0,1,.48)";
  const animOutSpinner = "fadeOutSpinner 1s cubic-bezier(.45,0,1,.48)";
  const animInSpinner = "fadeInSpinner 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
  const animOutDisplaySeed = "fadeOutDisplaySeed 1s cubic-bezier(.45,0,1,.48)";
  const animInDisplaySeed = "fadeInDisplaySeed 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";

  if (fadeIn) {
    teamTextFront.style.animation = animOut;
    spinner.style.animation = animOutSpinner;
    spinnerBG.style.animation = animOutSpinner;
    setTimeout(() => { teamTextBack.style.animation = animOut; }, 50);
    setTimeout(() => {
      teamSeedA.style.animation = animOut;
      teamSeedABG.style.animation = animOut;
    }, 100);
    setTimeout(() => {
      teamSeedB.style.animation = animOut;
      teamSeedBBG.style.animation = animOut;
    }, 200);
    setTimeout(() => {
      teamSeedC.style.animation = animOut;
      teamSeedCBG.style.animation = animOut;
      teamTextFront.style.opacity = '0';
      teamTextBack.style.opacity = '0';
      teamSeedA.style.opacity = '0';
      teamSeedABG.style.opacity = '0';
      teamSeedB.style.opacity = '0';
      teamSeedBBG.style.opacity = '0';
      teamSeedC.style.opacity = '0';
      teamSeedCBG.style.opacity = '0';
      spinner.style.opacity = '0';
      spinnerBG.style.opacity = '0';
    }, 300);
    setTimeout(() => {
      seedingContainer.style.animation = animIn;
      seedingContainer.style.opacity = '1';
      seedingTextFront.style.animation = animInDisplaySeed;
      seedingTextFront.style.opacity = '1';
    }, 1300);
    setTimeout(() => {
      seedingContainerContent.style.animation = animIn;
      seedingContainerContent.style.opacity = '1';
      seedingTextBack.style.animation = animInDisplaySeed;
      seedingTextBack.style.opacity = '1';
      buttonGlow(document.getElementById('promptSeedButton'));
    }, 1400);
  } else {
    seedingContainerContent.style.animation = animOutTeam;
    seedingContainerContent.style.opacity = '0';
    seedingTextBack.style.animation = animOutDisplaySeed;
    seedingTextBack.style.opacity = '0';

    setTimeout(() => {
      seedingContainer.style.animation = animOutTeam;
      seedingContainer.style.opacity = '0';
      seedingTextFront.style.animation = animOutDisplaySeed;
      seedingTextFront.style.opacity = '0';
    }, 100);

    setTimeout(() => {
      teamTextFront.style.animation = animIn;
      spinner.style.animation = animInSpinner;
      spinnerBG.style.animation = animInSpinner;
    }, 1100);
    setTimeout(() => { teamTextBack.style.animation = animIn; }, 1150);
    setTimeout(() => {
      teamSeedA.style.animation = animIn;
      teamSeedABG.style.animation = animIn;
    }, 1200);
    setTimeout(() => {
      teamSeedB.style.animation = animIn;
      teamSeedBBG.style.animation = animIn;
    }, 1300);
    setTimeout(() => {
      teamSeedC.style.animation = animIn;
      teamSeedCBG.style.animation = animIn;
      teamTextFront.style.opacity = '1';
      teamTextBack.style.opacity = '1';
      teamSeedA.style.opacity = '1';
      teamSeedABG.style.opacity = '1';
      teamSeedB.style.opacity = '1';
      teamSeedBBG.style.opacity = '1';
      teamSeedC.style.opacity = '1';
      teamSeedCBG.style.opacity = '1';
      spinner.style.opacity = '1';
      spinnerBG.style.opacity = '1';
      buttonGlow(document.getElementById('spinButton'));
    }, 1400);
  }

  fadeIn = !fadeIn;
}

buttonGlow(document.getElementById('csvUploadButton'));