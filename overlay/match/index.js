// SOCKET /////////////////////////////////////////////////////////////////
console.log(location.host);
let socket = new ReconnectingWebSocket("ws://localhost:24050/ws");
socket.onopen = () => {
    console.log("Successfully Connected");
};
socket.onclose = event => {
    console.log("Socket Closed Connection: ", event);
    socket.send("Client Closed!");
};
socket.onerror = error => {
    console.log("Socket Error: ", error);
};

// API /////////////////////////////////////////////////////////////////
const BASE = "https://lous-gts-proxy.louscmh.workers.dev";

// STAGES DATA STRUCTURE ///////////////////////////////////////////////////////
// Each entry is a tuple of stageName and stageAcronym
const stages = [
    { stageName: "Round of 16", stageAcronym: "RO16" },
    { stageName: "Quarterfinals", stageAcronym: "QF" },
    { stageName: "Semifinals", stageAcronym: "SF" },
    { stageName: "Finals", stageAcronym: "F" },
    { stageName: "Grand Finals", stageAcronym: "GF" }
]
let currentStage = 0;

const modColors = [
    { mod: "RC", color: "#FD0A07" },
    { mod: "HB", color: "#F9CB5D" },
    { mod: "LN", color: "#2F21EC" },
    { mod: "SV", color: "#EA13F9" },
    { mod: "TB", color: "#000000" },
]

// BEATMAP DATA /////////////////////////////////////////////////////////////////
let initialized = false;
let matchManager;
let beatmapSet;
let beatmapsIds;
let playersSetup = false;
let tempLeft;
let leftTeam;
const seedData = [];
const addFlags = [];
let preLoading = document.getElementById("preLoading");

// AUTO controls hookup
const autoPickCheckbox = document.getElementById('autoPickCheckbox');
// const autoSceneCheckbox = document.getElementById('autoSceneCheckbox');

let autoPickEnabled = autoPickCheckbox ? autoPickCheckbox.checked : true;
// let autoSceneEnabled = autoSceneCheckbox ? autoSceneCheckbox.checked : true;

function applyAutoSettings() {
    if (!matchManager) return;
    matchManager.autoPicker = autoPickEnabled;
    // matchManager.autoScene = autoSceneEnabled;
}

// apply when checkboxes change
if (autoPickCheckbox) {
    autoPickCheckbox.addEventListener('change', (e) => {
        autoPickEnabled = e.target.checked;
        applyAutoSettings();
    });
}

// if (autoSceneCheckbox) {
//     autoSceneCheckbox.addEventListener('change', (e) => {
//         autoSceneEnabled = e.target.checked;
//         applyAutoSettings();
//     });
// }

// ensure settings are applied once matchManager is created
const _applyOnceInterval = setInterval(() => {
    if (typeof matchManager !== 'undefined' && matchManager) {
        applyAutoSettings();
        clearInterval(_applyOnceInterval);
    }
}, 100);

(async () => {
    try {
        const jsonData = await $.getJSON("../../_data/seed.json");
        jsonData.Teams.map((seed) => {
            seedData.push(seed);
        });
        console.log(seedData);
        const jsonData2 = await $.getJSON("../../_data/flags.json");
        jsonData2.map((flags) => {
            addFlags.push(flags);
        });
        console.log(addFlags);
    } catch (error) {
        console.error("Could not read JSON file", error);
    }
})();

// MAIN LOOP ////////////////////////////////////////////////////////////////////
socket.onmessage = async event => {
    if (!initialized) { return };
    let data = JSON.parse(event.data);

    // NORMAL CODE
    matchManager.updateScores(data);
    matchManager.updateChat(data);

    tempLeft = data.tourney.manager.teamName.left;
    // tempLeft = "Cyclopentanoperhy";

    if (tempLeft != leftTeam && tempLeft != "" && !playersSetup) {
        leftTeam = tempLeft;
        playersSetup = true;
        setTimeout(function (event) {
            matchManager.updatePlayerId([data.tourney.manager.teamName.left, data.tourney.manager.teamName.right])
            // matchManager.updatePlayerId(["Cyclopentanoperhy", "sicks wann"])
        }, 150);
    }

    let tempStats = [data.menu.bm.id, data.menu.bm.stats.memoryOD, data.menu.bm.stats.fullSR, data.menu.bm.stats.BPM.min, data.menu.bm.stats.BPM.max];
    if (matchManager.currentFile != data.menu.bm.path.file || !arraysEqual(matchManager.currentStats, tempStats)) {
        matchManager.currentFile = data.menu.bm.path.file;
        matchManager.currentStats = tempStats;
        matchManager.updateMatchSong(data);
    };

    if (!playersSetup) { return };

    matchManager.checkState(data.tourney.manager.ipcState);
    // matchManager.gameplayManager.updateProgress(data);
    matchManager.gameplayManager.updateClientName(data);
    matchManager.gameplayManager.updateClients(data, data.tourney.manager.bools.scoreVisible, data.tourney.manager.ipcState);
    // matchManager.debug();
};

// CLASSES /////////////////////////////////////////////////////////////////////////
class MatchManager {
    constructor(beatmapSet) {
        this.beatmapSet = beatmapSet;
        this.overviewBeatmaps = [];
        this.pickCount = 0;
        this.leftWins = 0;
        this.rightWins = 0;
        this.playerTurn = "left";
        this.banCount = 0;
        this.leftPlayerData;
        this.leftPlayerDataFlag;
        this.rightPlayerData;
        this.rightPlayerDataFlag;
        this.currentMappoolScene = 1;
        this.currentFile;
        this.currentStats = [];
        this.scoreOne = 0;
        this.scoreTwo = 0;
        this.bestOf;

        this.hasBanned = false;
        this.togglePickVar = false;
        this.mappoolSwitchVar = true;
        this.matchSwitchVar = true;
        this.introSwitchVar = true;
        this.resultSwitchVar = false;
        this.currentMatchScene = false;
        this.currentIntroScene = 0;
        this.currentResultScene = false;
        this.autoPicker = true;
        this.autoScene = true;
        this.hiddenPick = false;

        this.gameplayManager = new GameplayManager;
        // this.resultsManager = new ResultsManager;
        // this.historyManager;
        this.currentState;
        this.chatLen = 0;

        this.mappoolOverview = document.getElementById("pool-middle");

        this.matchPickOriginal = document.getElementById("match-top-playing-original");
        this.matchSource = document.getElementById("match-top-playing-source");
        this.matchSongTitle = document.getElementById("match-top-playing-title-og");
        this.matchSongTitleDelay = document.getElementById("match-top-playing-title-delay");
        this.matchArtistTitle = document.getElementById("match-top-playing-artist-og");
        this.matchArtistTitleDelay = document.getElementById("match-top-playing-artist-delay");
        this.matchMapperTitle = document.getElementById("match-top-playing-mapper");
        this.matchDifficultyTitle = document.getElementById("match-top-playing-difficulty");
        this.matchPickTop = document.getElementById("match-top-playing-pick-top");
        this.matchPickBottom = document.getElementById("match-top-playing-pick-bottom");
        this.matchOutline = document.getElementById("match-top-playing-outline");

        this.bottomPlayerOnePfp = document.getElementById("match-bottom-left-team-pic");
        this.bottomPlayerTwoPfp = document.getElementById("match-bottom-right-team-pic");
        this.bottomPlayerOneName = document.getElementById("match-bottom-left-team-name");
        this.bottomPlayerTwoName = document.getElementById("match-bottom-right-team-name");
        this.bottomPlayerOneSeed = document.getElementById("match-bottom-left-team-seed-value");
        this.bottomPlayerTwoSeed = document.getElementById("match-bottom-right-team-seed-value");
        this.bottomScoreLeft = document.getElementById("match-bottom-left-score");
        this.bottomScoreRight = document.getElementById("match-bottom-right-score");
        // this.bottomP1Pick = document.getElementById("match-bottom-left-pick");
        // this.bottomP2Pick = document.getElementById("match-bottom-right-pick");
        // this.bottomP1PickText = document.getElementById("match-bottom-left-pick-text");
        // this.bottomP2PickText = document.getElementById("match-bottom-right-pick-text");

        // this.effectsShimmer = document.getElementById("effectsShimmer");

        this.matchSongSr = document.getElementById("match-top-stats-sr");
        this.matchSongOd = document.getElementById("match-top-stats-od");
        this.matchSongBpm = document.getElementById("match-top-stats-bpm");
        this.matchSongLength = document.getElementById("match-top-stats-length");

        this.bg = document.getElementById("bg");
        this.bg_match = document.getElementById("bg_match");

        this.chatbox = document.getElementById("match-bottom-chat");
        this.stagebox = document.getElementById("match-bottom-stage");
        this.chats = document.getElementById("match-bottom-chat-box");
        this.chatsDebug = document.getElementById("chat-debug");
        // this.matchStage = document.getElementById("matchStage");
        this.mainMatchScene = document.getElementById("match-middle-client");
        this.matchBottom = document.getElementById("match-bottom");
        this.matchTop = document.getElementById("match-top");

        // this.introPlayerOnePfp = document.getElementById("introPlayerOnePfp");
        // this.introPlayerTwoPfp = document.getElementById("introPlayerTwoPfp");
        // this.introPlayerOneName = document.getElementById("introPlayerOneName");
        // this.introPlayerTwoName = document.getElementById("introPlayerTwoName");
        // this.introPlayerOneSeed = document.getElementById("introPlayerOneSeed");
        // this.introPlayerTwoSeed = document.getElementById("introPlayerTwoSeed");
        // this.introPlayerOneRank = document.getElementById("introPlayerOneRank");
        // this.introPlayerTwoRank = document.getElementById("introPlayerTwoRank");
        // this.introScene = document.getElementById("introScene");

        this.controllerTurn = document.getElementById("turnButton");
        this.controllerPick = document.getElementById("pickButton");
        this.controllerMatch = document.getElementById("gameplayButton");
        this.poolPickingLeft = document.getElementById("pool-picking-left");
        this.poolPickingRight = document.getElementById("pool-picking-right");
        this.poolPickingContainer = document.getElementById("pool-picking-container");
        this.mappoolScene = document.getElementById("pool-middle");
        
    }

    turn() {
        // this.unpulseOverview("");
        // this.poolPickingContainer.style.opacity = 1;
        if (this.playerTurn == "left") {
            if (this.hasBanned && this.banCount < 2) {
                this.hasBanned = false;
                this.controllerTurn.innerHTML = `Left Player ${this.banCount < 2 ? "Ban" : "Pick"}`;
                this.poolPickingLeft.style.animation = "fadeInRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingLeft.style.opacity = 1;
                this.poolPickingRight.style.animation = "fadeOutLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingRight.style.opacity = 0;
            } else if (this.hasBanned || this.banCount < 2) {
                this.playerTurn = "right";
                this.controllerTurn.innerHTML = `Right Player ${this.banCount < 2 ? "Ban" : "Pick"}`;
                this.poolPickingRight.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingRight.style.opacity = 1;
                this.poolPickingLeft.style.animation = "fadeOutRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingLeft.style.opacity = 0;
            } else {
                this.hasBanned = true;
                this.controllerTurn.innerHTML = `Left Player ${this.banCount < 2 ? "Ban" : "Pick"}`;
                this.poolPickingLeft.style.animation = "pickingBob 1s cubic-bezier(0,.7,.39,.99)";
            }
        } else {
            if (this.hasBanned && this.banCount < 2) {
                this.hasBanned = false;
                this.controllerTurn.innerHTML = `Right Player ${this.banCount < 2 ? "Ban" : "Pick"}`;
                this.poolPickingRight.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingRight.style.opacity = 1;
                this.poolPickingLeft.style.animation = "fadeOutRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingLeft.style.opacity = 0;
            } else if (this.hasBanned || this.banCount < 2) {
                this.playerTurn = "left";
                this.controllerTurn.innerHTML = `Left Player ${this.banCount < 2 ? "Ban" : "Pick"}`;
                this.poolPickingLeft.style.animation = "fadeInRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingLeft.style.opacity = 1;
                this.poolPickingRight.style.animation = "fadeOutLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.poolPickingRight.style.opacity = 0;
            } else {
                this.hasBanned = true;
                this.controllerTurn.innerHTML = `Right Player ${this.banCount < 2 ? "Ban" : "Pick"}`;
                this.poolPickingRight.style.animation = "pickingBob 1s cubic-bezier(0,.7,.39,.99)";
            }
        }
        this.poolPickingLeft.innerHTML = this.banCount < 2 ? "Banning" : "Picking";
        this.poolPickingRight.innerHTML = this.banCount < 2 ? "Banning" : "Picking";
    }

    hidePick() {
        if (this.hiddenPick) {
            this.hiddenPick = false;
            this.unpulseOverview("")
            this.controllerPick.innerHTML = "Hide Pick/Ban Sign";
            this.poolPickingContainer.style.opacity = 1;
            // this.poolPickingContainer.style.transform = "scale(1)";
        } else {
            this.hiddenPick = true;
            this.controllerPick.innerHTML = "Show Pick/Ban Sign";
            this.poolPickingContainer.style.opacity = 0;
            // this.poolPickingContainer.style.transform = "scale(1.5)";
        }
    }

    undo() {
        this.unpulseOverview();
        let deletedPick;
        if (this.pickCount > 2) {
            deletedPick = this.overviewBeatmaps.find(overviewBeatmap => overviewBeatmap.pickIndex == this.pickCount && overviewBeatmap.isPick);
            deletedPick.isWin ? deletedPick.isWinPlayerOne ? this.leftWins-- : this.rightWins-- : null;
            deletedPick.cancelOperation(this.pickCount);
            this.pickCount--;
            this.controllerTurn.click();
        } else if (this.pickCount <= 2 & this.banCount > 0) {
            deletedPick = this.overviewBeatmaps.find(overviewBeatmap => overviewBeatmap.pickIndex == this.pickCount && overviewBeatmap.isBan);
            deletedPick.isWin ? deletedPick.isWinPlayerOne ? this.leftWins-- : this.rightWins-- : null;
            deletedPick.cancelOperation(this.pickCount);
            this.pickCount--;
            this.banCount--;
            this.controllerTurn.click();
        }

    }

    gameplay() {
        if (!this.matchSwitchVar) return;
        this.dimButton(this.controllerMatch);
        this.matchSwitchVar = false;
        if (this.currentMatchScene) {
            this.controllerMatch.innerHTML = "Switch to Gameplay";
            this.currentMatchScene = false;
            this.gameplayManager.hideGameplay();
            setTimeout(function () {
                this.mappoolScene.style.animation = "mappoolSceneIn 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
                this.mappoolScene.style.opacity = 1;
            }.bind(this), 1000);
            // setTimeout(function () {
            //     this.autoSceneChange(3);
            // }.bind(this), 25000);
        } else {
            this.controllerMatch.innerHTML = "Switch to Mappool";
            this.currentMatchScene = true;
            this.mappoolScene.style.animation = "mappoolSceneOut 1s cubic-bezier(.45,0,1,.48)";
            this.mappoolScene.style.opacity = 0;
            setTimeout(function () {
                this.gameplayManager.promptGameplay();
            }.bind(this), 1000);
        }
        setTimeout(function () {
            this.undimButton(this.controllerMatch);
            this.matchSwitchVar = true;
        }.bind(this), 2000);
    }

    generateOverview() {
        this.beatmapSet.map(async (beatmap, index) => {
            let pickMod = beatmap.pick.substring(0, 2);
            const bm = new Beatmap(pickMod, beatmap.beatmapId, `map${index}`);
            bm.generateOverview();
            const mapData = await getDataSet(beatmap.beatmapId);
            bm.sourceImg.setAttribute("src", `https://assets.ppy.sh/beatmaps/${mapData.beatmapset_id}/covers/cover.jpg`);
            mapData.title = mapData.title.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            mapData.version = mapData.version.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            bm.titleOg.innerHTML = mapData.title;
            makeScrollingText(bm.titleOg, bm.titleDelay, 20, 340, 20);
            bm.artistOg.innerHTML = mapData.artist;
            bm.mapper.innerHTML = mapData.creator;
            bm.difficulty.innerHTML = mapData.version;
            bm.mapData = mapData;
            pickMod == "SV" ? this.beatmapSet.reduce((acc, b) => acc + ((b.pick || '').startsWith('LN') ? 1 : 0), 0) === 5 ? bm.clicker.setAttribute("class", `pick-playing pick-playing-sv-special`) : bm.clicker.setAttribute("class", `pick-playing pick-playing-sv-normal`) : null;
            bm.clicker.addEventListener("click", async (event) => {
                console.log("test");
                if (bm.mods != "TB") {
                    if (event.altKey && this.hasBanned && bm.isPick && (!bm.isWinPlayerOne || bm.isWinPlayerOne == null)) {
                        // WINNING
                        bm.isWin ? this.rightWins-- : null;
                        this.leftWins++;
                        bm.toggleWin(this.leftPlayerDataFlag, true);
                        // this.controllerArrow.click();
                        // this.checkWin();
                    } else if (event.ctrlKey || event.shiftKey) {
                        return;
                    } else {
                        if (this.banCount < 2 && !bm.isBan) {
                            // BANNING
                            this.pickCount++;
                            this.banCount++;
                            bm.toggleBan(this.playerTurn == "left" ? this.leftPlayerDataFlag : this.rightPlayerDataFlag, this.playerTurn == "left" ? true : false, this.pickCount);
                            this.controllerTurn.click();
                        } else if (this.banCount == 2 && !bm.isPick && !bm.isBan && (this.bestOf - 1) * 2 != this.pickCount - 2) {
                            // PICKING
                            this.pickCount++;
                            this.unpulseOverview(bm.layerName);
                            bm.togglePick(this.playerTurn == "left" ? this.leftPlayerDataFlag : this.rightPlayerDataFlag, this.playerTurn == "left" ? true : false, this.pickCount);
                            this.controllerTurn.click();
                            this.hiddenPick ? null : this.controllerPick.click();
                            // this.poolPickingContainer.style.opacity = 0;
                            // this.changeUpcoming(bm.mapData);
                            // this.undimButton(this.controllerArrow);
                            // this.togglePickVar = true;
                            // this.effectsShimmer.style.animation = "glow 1.5s ease-in-out";
                            // setTimeout(function () {
                            //     this.effectsShimmer.style.animation = "none";
                            // }.bind(this), 1500);
                            // setTimeout(function () {
                            //     if (this.currentMappoolScene == 1) {
                            //         this.autoSceneChange(1);
                            //     } else if (this.currentMappoolScene == 3) {
                            //         this.autoSceneChange(3);
                            //         setTimeout(function () {
                            //             this.autoSceneChange(1);
                            //         }.bind(this), 5000);
                            //     }
                            // }.bind(this), 15000);
                        }
                    }
                } else {
                    if (event.altKey && this.hasBanned && bm.isPick && (!bm.isWinPlayerOne || bm.isWinPlayerOne == null)) {
                        // WINNING
                        bm.isWin ? this.rightWins-- : null;
                        this.leftWins++;
                        bm.toggleWin(this.leftPlayerDataFlag, true);
                        // this.controllerArrow.click();
                        // this.checkWin();
                    } else if (event.ctrlKey) {
                        // CANCELING
                        this.unpulseOverview();
                        // bm.cancelOperation(null);
                    } else if (!bm.isPick) {
                        this.pickCount++;
                        this.unpulseOverview(bm.layerName);
                        bm.togglePick(this.playerTurn == "left" ? this.leftPlayerDataFlag : this.rightPlayerDataFlag, this.playerTurn == "left" ? true : false, null);
                        this.hiddenPick ? null : this.controllerPick.click();
                        // setTimeout(function () {
                        //     this.effectsShimmer.style.animation = "none";
                        // }.bind(this), 1500);
                        // setTimeout(function () {
                        //     this.autoSceneChange(1);
                        // }.bind(this), 15000);
                    }
                }
            });
            bm.clicker.addEventListener("contextmenu", async (event) => {
                if (event.altKey && this.hasBanned && bm.isPick && (bm.isWinPlayerOne || bm.isWinPlayerOne == null)) {
                    bm.isWin ? this.leftWins-- : null;
                    this.rightWins++;
                    bm.toggleWin(this.rightPlayerDataFlag, false);
                    // this.controllerArrow.click();
                    // this.checkWin();
                }
            });
            this.overviewBeatmaps.push(bm);
        });
        preLoading.innerHTML = "Generating pools and checking if both team names are correct...";
        setTimeout(function () {
            initialized = true;
        }, 1000);
    }

    unpulseOverview(layerName = "") {
        this.overviewBeatmaps.map(beatmap => {
            if (beatmap.layerName != layerName) {
                beatmap.indicator.style.opacity = 0;
                beatmap.indicator.style.animation = "";
                beatmap.clicker.style.animation = "";
            }
        })
    }

    updateMatchSong(data) {
        console.log(beatmapsIds.includes(data.menu.bm.id));
        console.log(beatmapsIds);
        console.log(data.menu.bm.id);
        if (beatmapsIds.includes(String(data.menu.bm.id))) {
            this.autoPick(String(data.menu.bm.id));
            console.log(this.overviewBeatmaps);
            let mapData = this.beatmapSet.find(beatmap => beatmap.beatmapId == data.menu.bm.id);
            let { memoryOD, fullSR, BPM: { min, max } } = data.menu.bm.stats;
            let { full } = data.menu.bm.time;
            let { difficulty, mapper, artist, title } = data.menu.bm.metadata;
            let modColor = modColors.find(mc => mc.mod === mapData.pick.substring(0, 2));
            this.matchOutline.style.borderColor = modColor ? modColor.color : "#FFFFFF";
            this.matchPickOriginal.style.opacity = mapData.isOriginal ? 1 : 0;
            this.matchPickTop.innerHTML = mapData.pick.substring(0, 2);
            this.matchPickBottom.innerHTML = mapData.pick.substring(0, 2);
            this.matchSongTitle.innerHTML = title;
            this.matchArtistTitle.innerHTML = artist;
            this.matchMapperTitle.innerHTML = mapper;
            this.matchDifficultyTitle.innerHTML = difficulty;
            this.matchSongOd.innerHTML = `OD ${Number(memoryOD).toFixed(1)}`;
            this.matchSongSr.innerHTML = `SR ${Number(fullSR).toFixed(2)}*`;
            this.matchSongBpm.innerHTML = "BPM " + (min === max ? min : `${min}-${max}`);
            this.matchSongLength.innerHTML = `LEN ${parseTimeMs(full)}`;
            this.matchSource.setAttribute("src", `https://assets.ppy.sh/beatmaps/${data.menu.bm.set}/covers/cover.jpg`);
            this.matchSource.onerror = function () {
                this.matchSource.setAttribute('src', `../../_shared_assets/design/main_banner.ong`);
            };
        } else {
            let { memoryOD, fullSR, BPM: { min, max } } = data.menu.bm.stats;
            let { full } = data.menu.bm.time;
            let { difficulty, mapper, artist, title } = data.menu.bm.metadata;

            this.matchPickOriginal.style.opacity = 0;
            this.matchPickTop.innerHTML = "";
            this.matchPickBottom.innerHTML = "";
            this.matchSongTitle.innerHTML = title;
            this.matchArtistTitle.innerHTML = artist;
            this.matchMapperTitle.innerHTML = mapper;
            this.matchDifficultyTitle.innerHTML = difficulty;
            this.matchSongOd.innerHTML = `OD ${Number(memoryOD).toFixed(1)}`;
            this.matchSongSr.innerHTML = `SR ${Number(fullSR).toFixed(2)}*`;
            this.matchSongBpm.innerHTML = "BPM " + (min === max ? min : `${min}-${max}`);
            this.matchSongLength.innerHTML = `LEN ${parseTimeMs(full)}`;
            this.matchSource.setAttribute('src', `http://127.0.0.1:24050/Songs/${data.menu.bm.path.full}?a=${Math.random(10000)}`);
            this.matchSource.onerror = function () {
                this.matchSource.setAttribute('src', `../../_shared_assets/design/main_banner.ong`);
            };

        }
        makeScrollingText(this.matchSongTitle, this.matchSongTitleDelay, 20, 589, 30);
        makeScrollingText(this.matchArtistTitle, this.matchArtistTitleDelay, 20, 589, 30);
    }

    updateScores(data) {

        if (!(this.bestOf !== Math.ceil(data.tourney.manager.bestOF / 2) || this.scoreOne !== data.tourney.manager.stars.left || this.scoreTwo !== data.tourney.manager.stars.right)) return;

        let scoreEvent;
        this.bestOf = Math.ceil(data.tourney.manager.bestOF / 2);
        // console.log(this.bestOf);

        // console.log(data.tourney.manager.stars.left, data.tourney.manager.stars.right);

        if (this.scoreOne < data.tourney.manager.stars.left) {
            scoreEvent = "blue-add";
        } else if (this.scoreOne > data.tourney.manager.stars.left) {
            scoreEvent = "blue-remove";
        } else if (this.scoreTwo < data.tourney.manager.stars.right) {
            scoreEvent = "red-add";
        } else if (this.scoreTwo > data.tourney.manager.stars.right) {
            scoreEvent = "red-remove";
        }

        // console.log(scoreEvent);
        this.scoreOne = data.tourney.manager.stars.left;
        // this.resultsManager.scoreLeft = data.tourney.manager.stars.left;
        this.bottomScoreLeft.innerHTML = "";
        for (var i = 0; i < this.scoreOne; i++) {
            let scoreContainer = document.createElement("div");
            scoreContainer.setAttribute("class", "match-score");
            let scoreFill = document.createElement("img");
            let scoreOutline = document.createElement("img");
            scoreOutline.setAttribute("class", "match-score-outline");
            scoreFill.setAttribute("src", "../../_shared_assets/design/match_point_full.png")
            scoreOutline.setAttribute("src", "../../_shared_assets/design/match_point_empty.png")
            if (scoreEvent === "blue-add" && i === this.scoreOne - 1) {
                scoreFill.setAttribute("class", "match-score-fill score-fill-animate");
            } else {
                console.log("happened1");
                scoreFill.setAttribute("class", "match-score-fill match-score-toggle");
            }
            scoreContainer.appendChild(scoreFill);
            scoreContainer.appendChild(scoreOutline);
            this.bottomScoreLeft.appendChild(scoreContainer);
        }
        for (var i = 0; i < this.bestOf - this.scoreOne; i++) {
            let scoreContainer = document.createElement("div");
            scoreContainer.setAttribute("class", "match-score");
            let scoreFill = document.createElement("img");
            let scoreOutline = document.createElement("img");
            scoreOutline.setAttribute("class", "match-score-outline");
            scoreFill.setAttribute("src", "../../_shared_assets/design/match_point_full.png")
            scoreOutline.setAttribute("src", "../../_shared_assets/design/match_point_empty.png")
            if (scoreEvent === "blue-remove" && i === 0) {
                scoreFill.setAttribute("class", "match-score-fill score-none-animate");
            } else {
                scoreFill.setAttribute("class", "match-score-fill");
            }
            scoreContainer.appendChild(scoreFill);
            scoreContainer.appendChild(scoreOutline);
            this.bottomScoreLeft.appendChild(scoreContainer);
        }

        this.scoreTwo = data.tourney.manager.stars.right;
        // this.resultsManager.scoreRight = data.tourney.manager.stars.right;
        this.bottomScoreRight.innerHTML = "";
        for (var i = 0; i < this.bestOf - this.scoreTwo; i++) {
            let scoreContainer = document.createElement("div");
            scoreContainer.setAttribute("class", "match-score");
            let scoreFill = document.createElement("img");
            let scoreOutline = document.createElement("img");
            scoreOutline.setAttribute("class", "match-score-outline");
            scoreFill.setAttribute("src", "../../_shared_assets/design/match_point_full.png")
            scoreOutline.setAttribute("src", "../../_shared_assets/design/match_point_empty.png")
            if (scoreEvent === "red-remove" && i === this.bestOf - this.scoreTwo - 1) {
                scoreFill.setAttribute("class", "match-score-fill score-none-animate");
            } else {
                scoreFill.setAttribute("class", "match-score-fill");
            }
            scoreContainer.appendChild(scoreFill);
            scoreContainer.appendChild(scoreOutline);
            this.bottomScoreRight.appendChild(scoreContainer);
        }
        for (var i = 0; i < this.scoreTwo; i++) {
            let scoreContainer = document.createElement("div");
            scoreContainer.setAttribute("class", "match-score");
            let scoreFill = document.createElement("img");
            let scoreOutline = document.createElement("img");
            scoreOutline.setAttribute("class", "match-score-outline");
            scoreFill.setAttribute("src", "../../_shared_assets/design/match_point_full.png")
            scoreOutline.setAttribute("src", "../../_shared_assets/design/match_point_empty.png")
            if (scoreEvent === "red-add" && i === 0) {
                scoreFill.setAttribute("class", "match-score-fill score-fill-animate");
            } else {
                scoreFill.setAttribute("class", "match-score-fill match-score-toggle");
            }
            scoreContainer.appendChild(scoreFill);
            scoreContainer.appendChild(scoreOutline);
            this.bottomScoreRight.appendChild(scoreContainer);
        }
        // this.resultsManager.update();
        // this.checkWin();
    }

    dimButton(button) {
        button.style.color = "rgb(146, 146, 146)";
    }

    undimButton(button) {
        button.style.color = "white";
    }

    checkState(ipcState) {
        if (matchManager.currentState == ipcState) return;
        this.currentState = ipcState;

        // map has ended and its the next player's turn
        if (ipcState == 4) {
            // this.gameplayManager.hidePlayerData();
            this.markWin(this.gameplayManager.calculateResults());
            this.gameplayManager.showResults();
            this.chatbox.style.opacity = 1;
            this.stagebox.style.opacity = 0;
            // this.autoSceneChange(2);
            // setTimeout(function () {
            //     this.autoSceneChange(5);
            // }.bind(this), 30000);
        } else if (ipcState == 3) {
            // map has entered gameplay
            this.chatbox.style.opacity = 0;
            this.stagebox.style.opacity = 1;
            // this.autoSceneChange(4);
        } else if (ipcState == 1) {
            // gameplay has entered idle (the lobby)
            // this.gameplayManager.hideResults();
            this.gameplayManager.reset();
            this.chatbox.style.opacity = 1;
            this.stagebox.style.opacity = 0;
            // this.autoSceneChange(5);
        }
    }

    autoPick(beatmapId) {
        if (!this.autoPicker || !this.hasBanned) return;
        console.log("Auto picking...")
        if (beatmapsIds.includes(beatmapId)) {
            for (let beatmap of this.overviewBeatmaps) {
                if (beatmap.beatmapID == beatmapId) {
                    console.log("Found beatmap to auto pick:", beatmapId);
                    setTimeout(() => {
                        beatmap.clicker.click();
                    }, 100);
                }
            }
        }
    }

    markWin(leftWon) {
        let currentMapId = this.currentStats[0];
        if (beatmapsIds.includes(String(currentMapId))) {
            let winPick = this.overviewBeatmaps.find(beatmap => beatmap.beatmapID == currentMapId);
            if (!this.hasBanned || !winPick.isPick) return;
            winPick.isWin ? leftWon ? this.rightWins-- : this.leftWins-- : null;
            leftWon ? this.leftWins++ : this.rightWins++;
            winPick.toggleWin(leftWon);
            this.controllerPick.click();
            // this.checkWin();
        }
    }

    // autoSceneChange(index) {
    //     if (!this.autoScene || !this.hasBanned) return;

    //     if (index == 1 && this.currentMappoolScene == 1) {
    //         // change to upcoming map
    //         this.controllerMappool.click();
    //     } else if (index == 2 && this.currentMappoolScene == 2) {
    //         // change to pick queue
    //         this.controllerMappool.click();
    //     } else if (index == 3 && this.currentMappoolScene == 3) {
    //         // change to mappool overview
    //         this.controllerMappool.click();
    //     } else if (index == 4 && !this.currentMatchScene) {
    //         // change to match scene
    //         this.controllerMatch.click();
    //     } else if (index == 5 && this.currentMatchScene) {
    //         // change to mappool scene
    //         this.controllerMatch.click();
    //         setTimeout(function () {
    //             this.resultSwitchVar == true ? this.controllerResults.click() : null;
    //         }.bind(this), 10000);
    //         setTimeout(function () {
    //             this.autoSceneChange(3);
    //         }.bind(this), 25000);
    //     }
    // }

    updateChat(data) {
        if (this.chatLen == data.tourney.manager.chat.length) return;
        let tempClass;

        if (this.chatLen == 0 || (this.chatLen > 0 && this.chatLen > data.tourney.manager.chat.length)) {
            // Starts from bottom
            this.chats.innerHTML = "";
            this.chatsDebug.innerHTML = "";
            this.chatLen = 0;
        }

        // Add the chats
        for (var i = this.chatLen; i < data.tourney.manager.chat.length; i++) {
            tempClass = data.tourney.manager.chat[i].team;

            // Chat variables
            let chatParent = document.createElement('div');
            chatParent.setAttribute('class', 'chat');
            let chatParentDebug = document.createElement('div');
            chatParentDebug.setAttribute('class', 'chat');

            let chatTime = document.createElement('div');
            chatTime.setAttribute('class', 'chatTime');
            let chatTimeDebug = document.createElement('div');
            chatTimeDebug.setAttribute('class', 'chatTime');

            let chatName = document.createElement('div');
            chatName.setAttribute('class', 'chatName');
            let chatNameDebug = document.createElement('div');
            chatNameDebug.setAttribute('class', 'chatName');

            let chatText = document.createElement('div');
            chatText.setAttribute('class', 'chatText');
            let chatTextDebug = document.createElement('div');
            chatTextDebug.setAttribute('class', 'chatText');

            chatTime.innerText = data.tourney.manager.chat[i].time;
            chatName.innerText = data.tourney.manager.chat[i].name + ":\xa0";
            chatText.innerText = data.tourney.manager.chat[i].messageBody;
            chatTimeDebug.innerText = data.tourney.manager.chat[i].time;
            chatNameDebug.innerText = data.tourney.manager.chat[i].name + ":\xa0";
            chatTextDebug.innerText = data.tourney.manager.chat[i].messageBody;

            chatName.classList.add(tempClass);
            chatNameDebug.classList.add(tempClass);

            chatParent.append(chatTime);
            chatParent.append(chatName);
            chatParent.append(chatText);
            chatParentDebug.append(chatTimeDebug);
            chatParentDebug.append(chatNameDebug);
            chatParentDebug.append(chatTextDebug);
            this.chats.append(chatParent);
            this.chatsDebug.append(chatParentDebug);
        }

        // Update the Length of chat
        this.chatLen = data.tourney.manager.chat.length;

        // Update the scroll so it's sticks at the bottom by default
        this.chats.scrollTop = this.chats.scrollHeight;
        this.chatsDebug.scrollTop = this.chatsDebug.scrollHeight;
    }

    // checkWin() {
    //     if ((this.leftWins == this.bestOf || this.rightWins == this.bestOf) && (this.scoreOne == this.bestOf || this.scoreTwo == this.bestOf)) {
    //         this.undimButton(this.controllerResults);
    //         this.resultSwitchVar = true;
    //     } else {
    //         this.dimButton(this.controllerResults);
    //         this.resultSwitchVar = false;
    //     }
    // }

    async updatePlayerId(playerId) {
        this.leftPlayerData = seedData.find(seed => seed["Acronym"] == playerId[0]);
        this.rightPlayerData = seedData.find(seed => seed["Acronym"] == playerId[1]);
        const leftFlag = await getCountryFlag(seedData.find(seed => seed["Acronym"] == playerId[0])["Acronym"]);
        const rightFlag = await getCountryFlag(seedData.find(seed => seed["Acronym"] == playerId[1])["Acronym"]);
        // const leftRoster = await Promise.all(
        //     this.leftPlayerData.Players.map(async (player) => {
        //         const data = await getUserDataSet(player.id);
        //         return data.username;
        //     }));
        // const rightRoster = await Promise.all(
        //     this.rightPlayerData.Players.map(async (player) => {
        //         const data = await getUserDataSet(player.id);
        //         return data.username;
        //     }));

        this.bottomPlayerOnePfp.setAttribute("src", leftFlag);
        this.leftPlayerDataFlag = leftFlag;
        this.bottomPlayerTwoPfp.setAttribute("src", rightFlag);
        this.rightPlayerDataFlag = rightFlag;
        this.bottomPlayerOneName.innerHTML = this.leftPlayerData.FullName;
        await adjustFont(this.bottomPlayerOneName, 414, 48);
        this.bottomPlayerTwoName.innerHTML = this.rightPlayerData.FullName;
        await adjustFont(this.bottomPlayerTwoName, 414, 48);
        this.bottomPlayerOneSeed.innerHTML = `#${seedData.find(seed => seed["Acronym"] == playerId[0])["Seed"].match(/\d+/)[0]}`;
        this.bottomPlayerTwoSeed.innerHTML = `#${seedData.find(seed => seed["Acronym"] == playerId[1])["Seed"].match(/\d+/)[0]}`;

        // this.introPlayerOnePfp.setAttribute("src", leftFlag);
        // this.introPlayerTwoPfp.setAttribute("src", rightFlag);
        // this.introPlayerOneName.innerHTML = this.leftPlayerData.FullName;
        // this.introPlayerTwoName.innerHTML = this.rightPlayerData.FullName;
        // this.introPlayerOneSeed.innerHTML = `#${seedData.find(seed => seed["Acronym"] == playerId[0])["Seed"].match(/\d+/)[0]}`;
        // this.introPlayerTwoSeed.innerHTML = `#${seedData.find(seed => seed["Acronym"] == playerId[1])["Seed"].match(/\d+/)[0]}`;
        // this.introPlayerOneRoster.innerHTML = leftRoster.join(" · ");
        // this.introPlayerTwoRoster.innerHTML = rightRoster.join(" · ");

        // this.matchHistoryLeftPlayerSource.setAttribute("src", leftFlag);
        // this.matchHistoryRightPlayerSource.setAttribute("src", rightFlag);
        // this.matchHistoryLeftPlayerName.innerHTML = this.leftPlayerData.FullName;
        // this.matchHistoryLightPlayerName.innerHTML = this.rightPlayerData.FullName;
        // this.matchHistoryLeftPlayerSeed.innerHTML = `#${seedData.find(seed => seed["Acronym"] == playerId[0])["Seed"].match(/\d+/)[0]}`;
        // this.matchHistoryRightPlayerSeed.innerHTML = `#${seedData.find(seed => seed["Acronym"] == playerId[1])["Seed"].match(/\d+/)[0]}`;

        // this.resultsManager.playerLeft = this.leftPlayerData;
        // this.resultsManager.playerRight = this.rightPlayerData;
        // this.resultsManager.initialUpdate();
        preLoading.style.opacity = 0;
        // hasSetupPlayers = true;
        // this.historyManager = new HistoryManager(this.leftPlayerData, this.rightPlayerData);
        // this.historyManager.generate();
        setTimeout(function () {
            preLoading.style.display = "none";
        }.bind(this), 1000);
    }
}

class Beatmap {
    constructor(mods, beatmapID, layerName) {
        this.mods = mods;
        this.beatmapID = beatmapID;
        this.layerName = layerName;
        this.isBan = false;
        this.isPick = false;
        this.isWin = false;
        this.isWinPlayerOne;
        this.pickIndex;
        this.mapData;
        this.isPlayerOne;
    }

    generateOverview() {
        let mappoolContainer = document.getElementById(this.mods == "SV" ? "pool-ln" : `pool-${this.mods.toLowerCase()}`);

        this.clicker = document.createElement("div");
        this.clicker.id = `${this.layerName}-pick-playing`;
        this.clicker.setAttribute("class", "pick-playing");

        mappoolContainer.appendChild(this.clicker);
        let clickerObj = document.getElementById(this.clicker.id);

        // CREATE ELEMENTS
        this.container = document.createElement('div');
        this.indicator = document.createElement('img');
        this.winBlock = document.createElement('div');
        this.winImg = document.createElement('img');
        this.winText = document.createElement('div');
        this.pickBlock = document.createElement('div');
        this.pickImg = document.createElement('img');
        this.pickText = document.createElement('div');
        this.banBlock = document.createElement('div');
        this.banImg = document.createElement('img');
        this.banText = document.createElement('div');
        this.outline = document.createElement('div');
        this.metadata = document.createElement('div');
        this.titleWrap = document.createElement('div');
        this.titleOg = document.createElement('div');
        this.titleDelay = document.createElement('div');
        this.artistWrap = document.createElement('div');
        this.artistOg = document.createElement('div');
        this.artistDelay = document.createElement('div');
        this.metadataMap = document.createElement('div');
        this.difficulty = document.createElement('div');
        this.mapper = document.createElement('div');
        this.pickTop = document.createElement('div');
        this.pickBottom = document.createElement('div');
        this.metadataTextImg = document.createElement('img');
        this.bgOverlay = document.createElement('div');
        this.sourceImg = document.createElement('img');

        // CREATE IDS (none required in original snippet)
        this.container.id = `${this.layerName}-container`;
        this.indicator.id = `${this.layerName}-indicator`;
        this.winBlock.id = `${this.layerName}-win-block`;
        this.winImg.id = `${this.layerName}-win-img`;
        this.winText.id = `${this.layerName}-win-text`;
        this.pickBlock.id = `${this.layerName}-pick-block`;
        this.pickImg.id = `${this.layerName}-pick-img`;
        this.pickText.id = `${this.layerName}-pick-text`;
        this.banBlock.id = `${this.layerName}-ban-block`;
        this.banImg.id = `${this.layerName}-ban-img`;
        this.banText.id = `${this.layerName}-ban-text`;
        this.outline.id = `${this.layerName}-outline`;
        this.metadata.id = `${this.layerName}-metadata`;
        this.titleWrap.id = `${this.layerName}-title-wrap`;
        this.titleOg.id = `${this.layerName}-title-og`;
        this.titleDelay.id = `${this.layerName}-title-delay`;
        this.artistWrap.id = `${this.layerName}-artist-wrap`;
        this.artistOg.id = `${this.layerName}-artist-og`;
        this.artistDelay.id = `${this.layerName}-artist-delay`;
        this.metadataMap.id = `${this.layerName}-metadata-map`;
        this.difficulty.id = `${this.layerName}-difficulty`;
        this.mapper.id = `${this.layerName}-mapper`;
        this.pickTop.id = `${this.layerName}-pick-top`;
        this.pickBottom.id = `${this.layerName}-pick-bottom`;
        this.metadataTextImg.id = `${this.layerName}-metadata-text`;
        this.bgOverlay.id = `${this.layerName}-bg-overlay`;
        this.sourceImg.id = `${this.layerName}-source-img`;

        // CREATE CLASSES
        this.container.className = 'pick-playing-container';
        this.indicator.className = 'pick-playing-indicator';
        this.winBlock.className = 'pick-playing-win';
        this.winImg.className = 'pick-playing-win-image';
        this.winText.className = 'pick-playing-win-text';
        this.pickBlock.className = 'pick-playing-pick';
        this.pickImg.className = 'pick-playing-pick-image';
        this.pickText.className = 'pick-playing-pick-text';
        this.banBlock.className = 'pick-playing-ban';
        this.banImg.className = 'pick-playing-ban-image';
        this.banText.className = 'pick-playing-ban-text';
        this.outline.className = 'pick-playing-outline';
        this.metadata.className = 'pick-playing-metadata';
        this.titleWrap.className = 'pick-playing-title';
        this.titleOg.className = 'pick-playing-title-og';
        this.titleDelay.className = 'pick-playing-title-delay';
        this.artistWrap.className = 'pick-playing-artist';
        this.artistOg.className = 'pick-playing-artist-og';
        this.artistDelay.className = 'pick-playing-artist-delay';
        this.metadataMap.className = 'pick-playing-metadata-map';
        this.difficulty.className = 'pick-playing-difficulty';
        this.mapper.className = 'pick-playing-mapper';
        this.pickTop.className = 'pick-playing-pick-top';
        this.pickBottom.className = 'pick-playing-pick-bottom';
        this.metadataTextImg.className = 'pick-playing-metadata-text';
        this.bgOverlay.className = 'pick-playing-bg-overlay';
        this.sourceImg.className = 'pick-playing-source';

        // SET SRC / INNERHTML / TEXTCONTENT
        this.indicator.src = '../../_shared_assets/design/match_pick_indicator.png';
        this.winImg.src = 'https://lous.s-ul.eu/NoNVoJCf';
        this.winText.textContent = 'Win';
        this.pickImg.src = 'https://lous.s-ul.eu/NoNVoJCf';
        this.pickText.textContent = 'Pick';
        this.banImg.src = 'https://lous.s-ul.eu/NoNVoJCf';
        this.banText.textContent = 'Ban';
        this.titleOg.textContent = 'Very Long Song Name';
        this.artistOg.textContent = 'Very Long Artist Name';
        this.difficulty.textContent = 'Very Long Difficulty Name';
        this.mapper.textContent = 'Very Long Mapper Name';
        this.pickTop.textContent = this.mods;
        this.pickBottom.textContent = this.mods;
        this.metadataTextImg.src = '../../_shared_assets/design/match_pick_text.png';
        this.sourceImg.src = '../../_shared_assets/design/main_banner.png';
        const modColor = modColors.find(mc => mc.mod === this.mods);
        this.outline.style.borderColor = (modColor ? modColor.color : 'white');

        // APPEND TO DOM
        clickerObj.appendChild(this.container);

        this.container.appendChild(this.indicator);

        document.getElementById(this.container.id).appendChild(this.indicator);
        document.getElementById(this.container.id).appendChild(this.winBlock);
        document.getElementById(this.container.id).appendChild(this.pickBlock);
        document.getElementById(this.container.id).appendChild(this.banBlock);
        document.getElementById(this.container.id).appendChild(this.outline);
        document.getElementById(this.container.id).appendChild(this.metadata);
        document.getElementById(this.container.id).appendChild(this.pickTop);
        document.getElementById(this.container.id).appendChild(this.pickBottom);
        document.getElementById(this.container.id).appendChild(this.metadataTextImg);
        document.getElementById(this.container.id).appendChild(this.bgOverlay);
        document.getElementById(this.container.id).appendChild(this.sourceImg);

        document.getElementById(this.winBlock.id).appendChild(this.winImg);
        document.getElementById(this.winBlock.id).appendChild(this.winText);

        document.getElementById(this.pickBlock.id).appendChild(this.pickImg);
        document.getElementById(this.pickBlock.id).appendChild(this.pickText);

        document.getElementById(this.banBlock.id).appendChild(this.banImg);
        document.getElementById(this.banBlock.id).appendChild(this.banText);

        document.getElementById(this.metadata.id).appendChild(this.titleWrap);
        document.getElementById(this.metadata.id).appendChild(this.artistWrap);
        document.getElementById(this.metadata.id).appendChild(this.metadataMap);

        document.getElementById(this.titleWrap.id).appendChild(this.titleOg);
        document.getElementById(this.titleWrap.id).appendChild(this.titleDelay);

        document.getElementById(this.artistWrap.id).appendChild(this.artistOg);
        document.getElementById(this.artistWrap.id).appendChild(this.artistDelay);

        document.getElementById(this.metadataMap.id).appendChild(this.difficulty);
        document.getElementById(this.metadataMap.id).appendChild(this.mapper);
    }

    toggleBan(flag, isPlayerOne, pickIndex) {
        if (this.isPick || this.mods == "TB" || this.isBan) return;
        console.log(flag);
        this.isBan = true;
        this.pickIndex = pickIndex;
        this.banImg.setAttribute("src", flag);
        setTimeout(function () {
            this.banBlock.style.opacity = 1;
            this.banImg.style.animation = "fadeInOverviewBeatmap 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.banText.style.animation = "fadeInOverviewBeatmap 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        }.bind(this), 100);
    }

    togglePick(flag, isPlayerOne = true, pickIndex) {
        if (this.isBan || this.isPick) return;
        this.isPick = true;
        this.pickIndex = pickIndex;
        this.isPlayerOne = isPlayerOne;
        if (this.mods != "TB") {
            this.pickImg.setAttribute("src", flag);
            this.pickBlock.style.opacity = 1;
            this.pickBlock.style.animation = "fadeInOverviewBeatmap 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        }
        this.clicker.style.animation = "pick 2s infinite cubic-bezier(.61,.01,.45,1)";
        this.indicator.style.opacity = 1;
        this.indicator.style.animation = "fadeInPickIcon 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
    }

    toggleWin(flag, isPlayerOne = true) {
        if (this.isBan || !this.isPick) return;
        this.isWin = true;
        this.isWinPlayerOne = isPlayerOne;
        this.winImg.setAttribute("src", flag);
        setTimeout(function () {
            this.winBlock.style.opacity = 1;
            this.winBlock.style.animation = "fadeInOverviewBeatmap 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        }.bind(this), 100);
    }

    cancelOperation(pickIndex) {
        if (this.isPick && pickIndex == this.pickIndex) {
            this.pickBlock.style.opacity = 0;
            this.pickBlock.style.animation = "";
            this.winBlock.style.opacity = 0;
            this.winBlock.style.animation = "";
            this.pickIndex = null;
            this.isPick = false;
            this.isWin = false;
            this.isWinPlayerOne = null;
            this.isPlayerOne = null;
        } if (this.isBan && pickIndex == this.pickIndex) {
            this.banBlock.style.opacity = 0;
            this.banText.style.animation = "";
            this.banImg.style.animation = "";
            this.isBan = false;
        }
    }
}

class ScoreTracker {
    constructor() {
        this.currentState = 0;
        this.leftClients = [];
        this.rightClients = [];
    }
    addClient(client, isLeft) {
        if (isLeft) {
            this.leftClients.push(client);
        } else {
            this.rightClients.push(client);
        }
    }
    updateClients(data) {
        data.map(async (clientData, index) => {
            // console.log(index);
            const client = index < 3 ? this.leftClients[index] : this.rightClients[index - 3];
            if (client) {
                client.updateCombo(clientData.gameplay.combo.current);
            }
        })
    }
    updateClientsName(data) {
        data.map(async (clientData, index) => {
            // console.log(index);
            const client = index < 3 ? this.leftClients[index] : this.rightClients[index - 3];
            if (client) {
                client.updatePlayer(clientData.spectating.name);
            }
        })
    }
    getScores() {
        if (this.currentState != 3) return null, null;
        let left = 0;
        let right = 0;
        this.leftClients.map(async (client) => {
            left += client.score ?? 0;
        })
        this.rightClients.map(async (client) => {
            right += client.score ?? 0;
        })
        return [left, right];
    }
    updateState(state) {
        this.currentState = state;
    }
    reset() {
        this.leftClients.map(client => {
            client.reset();
        })
        this.rightClients.map(client => {
            client.reset();
        })
    }
    displayMvp() {
        let maxScore = ["", 0];
        for (let client of this.leftClients) {
            if (client.score < maxScore[1]) {
                maxScore = [client.clientMvp, client.score];
            }
        }
        for (let client of this.rightClients) {
            if (client.score < maxScore[1]) {
                maxScore = [client.clientMvp, client.score];
            }
        }
        console.log(maxScore);
        if (maxScore[1] > 0) {
            maxScore[0].style.opacity = 1;
        }
    }
}

class Client {
    constructor(clientNumber) {
        this.animationScore;
        this.clientNumber = clientNumber;
        this.combo;
        this.player;
        this.clientName = document.getElementById(`match-client-name-${this.clientNumber}`);
        this.clientMvp = document.getElementById(`match-client-mvp-${this.clientNumber}`);
    }
    grayedOut() {
        this.overlay.style.opacity = '1';
    }
    updateScore(score) {
        if (score == this.score) return;
        this.score = score;
    }
    updateCombo(combo) {
        if (combo == this.combo) return;
        if (this.combo > 29 && combo < this.combo) this.flashMiss();
        this.combo = combo;
    }
    flashMiss() {
        // let missFlash = document.getElementById(this.matchClientMissGlow.id);
        // missFlash.style.animation = "glow 1.5s ease-in-out";
        // setTimeout(function () {
        //     missFlash.style.animation = "none";
        // }.bind(this), 1500);
    }
    updatePlayer(name) {
        if (name == this.player) return;
        this.clientName.innerHTML = name;
        // adjustFont(element, 140, 24);
        this.player = name;
    }
    reset() {
        this.updateScore(0);
        this.updateCombo(0);
        this.clientMvp.style.opacity = 0;
    }
}

class GameplayManager {
    constructor() {
        this.scoreTracker = new ScoreTracker();
        // this.matchScoreBoard = document.getElementById("matchScoreBoard");
        // this.bottomMatch = document.getElementById("bottomMatch");
        // this.bottomMatchResults = document.getElementById("bottomMatchResults");
        // this.bottomMatchProgressBar = document.getElementById("bottomMatchProgressBar");
        this.bg = document.getElementById("bg");
        this.bg_match = document.getElementById("bg_match");
        this.matchClients = document.getElementById("match-middle");
        this.matchClientLeft = document.getElementById("match-middle-client-left");
        this.matchClientRight = document.getElementById("match-middle-client-right");

        this.matchOneScore = document.getElementById("match-middle-score-left-value");
        this.matchTwoScore = document.getElementById("match-middle-score-right-value");
        this.matchScoreDifference = document.getElementById("match-middle-score-difference-value");

        this.matchScoreRightContent = document.getElementById("match-middle-scorebar-right-content");
        this.matchScoreLeftContent = document.getElementById("match-middle-scorebar-left-content");
        this.matchScoreLeftContainer = document.getElementById("match-middle-scorebar-left");
        this.matchScoreRightContainer = document.getElementById("match-middle-scorebar-right");

        this.matchOneLead = document.getElementById("match-middle-score-left-lead");
        this.matchTwoLead = document.getElementById("match-middle-score-right-lead");
        this.matchOneScoreDifference = document.getElementById("match-middle-score-difference-left");
        this.matchTwoScoreDifference = document.getElementById("match-middle-score-difference-right");

        // this.bottomProgressBarContent = document.getElementById("bottomProgressBarContent");
        // this.bottomSongPercentage = document.getElementById("bottomSongPercentage");
        // this.bottomSongEnd = document.getElementById("bottomSongEnd");

        // this.bottomResultsTop = document.getElementById("bottomResultsTop");
        // this.bottomResultsBottom = document.getElementById("bottomResultsBottom");

        // this.matchWinningLeftContent = document.getElementById("matchWinningLeftContent");
        // this.matchWinningLeftWinText = document.getElementById("matchWinningLeftWinText");
        // this.matchWinningRightContent = document.getElementById("matchWinningRightContent");
        // this.matchWinningRightWinText = document.getElementById("matchWinningRightWinText");

        this.isGameplay = false;
        this.animationScore = {
            matchOneScore: new CountUp('match-middle-score-left-value', 0, 0, 0, .2, { useEasing: true, useGrouping: true, separator: ",", decimal: "." }),
            matchTwoScore: new CountUp('match-middle-score-right-value', 0, 0, 0, .2, { useEasing: true, useGrouping: true, separator: ",", decimal: "." }),
            matchScoreDifference: new CountUp('match-middle-score-difference-value', 0, 0, 0, .2, { useEasing: true, useGrouping: true, separator: ",", decimal: "." }),
        }
        this.scoreLeft;
        this.scoreRight;
        this.comboLeft;
        this.comboRight;
        this.barThreshold = 100000;
        this.songStart;
        this.currentTime;
        this.isDoubleTime = false;
        this.setupClients();
    }

    promptGameplay() {
        if (this.isGameplay) return;
        // this.matchScoreBoard.style.animation = "slideUpMatch 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        // this.bottomMatch.style.animation = "slideUpMatchBottom 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        // this.bottomMatch.style.transform = "translateY(0)";
        this.matchClients.style.animation = "mappoolSceneIn 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        this.matchClients.style.opacity = 1;
        // this.bg_match.play();
        // this.matchScoreBoard.style.opacity = 1;
        this.isGameplay = true;
        setTimeout(function () {
            this.bg.style.clipPath = "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)";
            // this.revealPlayerData();
            // this.bg.pause();
        }.bind(this), 1000);
    }

    hideGameplay() {
        if (!this.isGameplay) return;
        // this.matchScoreBoard.style.animation = "slideDownMatch 1s cubic-bezier(.45,0,1,.48)";
        // this.bottomMatch.style.animation = "slideDownMatchBottom 1s cubic-bezier(.45,0,1,.48)";
        // this.bottomMatch.style.transform = "translateY(148px)";
        this.matchClients.style.animation = "mappoolSceneOut 1s cubic-bezier(.45,0,1,.48)";
        this.matchClients.style.opacity = 0;
        this.bg.style.clipPath = "polygon(0 0, 100% 0, 100% 100%, 0% 100%)";
        // this.bg_match.pause();
        // this.hidePlayerData(true);
        // this.bg.play();
        // this.matchScoreBoard.style.opacity = 0;
        this.isGameplay = false;
    }

    // hidePlayerData(playerNameCheck) {
    //     if (!playerNameCheck) {
    //         this.scoreTracker.resultHide();
    //     } else {
    //         this.matchClientLeft.style.opacity = 0;
    //         this.matchClientRight.style.opacity = 0;
    //     }
    // }

    // revealPlayerData() {
    //     this.matchClientLeft.style.opacity = 1;
    //     this.matchClientRight.style.opacity = 1;
    // }

    showResults() {
        this.scoreTracker.displayMvp();
        // this.bottomMatchProgressBar.style.animation = "fadeOutLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        // this.bottomMatchProgressBar.style.opacity = 0;
        // this.bottomMatchResults.style.animation = "fadeInRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        // this.bottomMatchResults.style.opacity = 1;
    }

    hideResults() {
        // this.bottomMatchProgressBar.style.animation = "fadeInRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        // this.bottomMatchProgressBar.style.opacity = 1;
        // this.bottomMatchResults.style.animation = "fadeOutLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        // this.bottomMatchResults.style.opacity = 0;
    }

    async setupClients() {
        const clientNumber = 6
        for (let i = 0; i < clientNumber + 1; i++) {
            const client = new Client(i);
            this.scoreTracker.addClient(client, i < 3 ? true : false);
        }
    }

    updateClientName(data) {
        this.scoreTracker.updateClientsName(data.tourney.ipcClients);
    }

    updateClients(data, scoreVisible, ipcState) {
        if (!(scoreVisible && ipcState == 3)) return;
        // console.log(data);
        this.scoreLeft = data.tourney.manager.gameplay.score.left;
        this.scoreRight = data.tourney.manager.gameplay.score.right;
        this.animationScore.matchOneScore.update(this.scoreLeft);
        this.animationScore.matchTwoScore.update(this.scoreRight);
        this.scoreTracker.updateClients(data.tourney.ipcClients);
        let difference = Math.abs(this.scoreLeft - this.scoreRight);
        this.animationScore.matchScoreDifference.update(difference);

        if (this.scoreLeft > this.scoreRight) {
            this.matchScoreLeftContent.style.width = `${(difference / this.barThreshold > 1 ? 1 : difference / this.barThreshold) * 404}px`;
            this.matchScoreRightContent.style.width = "0px";
            this.toggleLead("left");
        } else if (this.scoreLeft < this.scoreRight) {
            this.matchScoreRightContent.style.width = `${(difference / this.barThreshold > 1 ? 1 : difference / this.barThreshold) * 404}px`;
            this.matchScoreLeftContent.style.width = "0px";
            this.toggleLead("right");
        } else {
            this.matchScoreLeftContent.style.width = "0px";
            this.matchScoreRightContent.style.width = "0px";
            this.toggleLead("center");
        }
    }

    flashMiss(id) {
        let missFlash = document.getElementById(id);
        missFlash.style.animation = "glow 1.5s ease-in-out";
        setTimeout(function () {
            missFlash.style.animation = "none";
        }.bind(this), 1500);
    }

    toggleLead(lead) {
        if (lead == "left") {
            this.matchOneLead.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchOneLead.style.opacity = 1;
            this.matchTwoLead.style.animation = "fadeOutRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchTwoLead.style.opacity = 0;
            this.matchOneScoreDifference.style.opacity = 1;
            this.matchTwoScoreDifference.style.opacity = 0;
            // this.matchScoreDifference.style.opacity = 1;
            // this.matchScoreRightText.style.opacity = 0;
        } else if (lead == "right") {
            this.matchTwoLead.style.animation = "fadeInRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchTwoLead.style.opacity = 1;
            this.matchOneLead.style.animation = "fadeOutLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchOneLead.style.opacity = 0;
            this.matchOneScoreDifference.style.opacity = 0;
            this.matchTwoScoreDifference.style.opacity = 1;
            // this.matchScoreDifference.style.opacity = 0;
            // this.matchScoreRightText.style.opacity = 1;
        } else if (lead == "center") {
            this.matchOneLead.style.animation = "fadeOutLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchOneLead.style.opacity = 0;
            this.matchTwoLead.style.animation = "fadeOutRight 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchTwoLead.style.opacity = 0;
            this.matchOneScoreDifference.style.opacity = 0;
            this.matchTwoScoreDifference.style.opacity = 0;
            // this.matchScoreDifference.style.opacity = 0;
            // this.matchScoreRightText.style.opacity = 0;

        }
    }

    reset() {
        this.scoreTracker.reset();
        this.animationScore.matchOneScore.update(0);
        this.animationScore.matchTwoScore.update(0);
        this.animationScore.matchScoreDifference.update(0);
        this.animationScore.matchScoreRightText.update(0);
        this.matchScoreLeftContent.style.width = "0px";
        this.matchScoreRightContent.style.width = "0px";
        this.matchScoreLeftContainer.style.alignItems = "end";
        this.matchScoreRightContainer.style.alignItems = "start";
        this.matchWinningLeftContent.style.animation = "";
        this.matchWinningLeftContent.style.width = "0%";
        this.matchWinningRightContent.style.animation = "";
        this.matchWinningRightContent.style.width = "0%";
        this.matchOneScore.style.color = "Black";
        this.matchTwoScore.style.color = "Black";
        this.matchOneScore.style.transform = "";
        this.matchTwoScore.style.transform = "";
        this.matchWinningLeftWinText.style.opacity = 0;
        this.matchWinningRightWinText.style.opacity = 0;
        this.toggleLead("center");
    }

    calculateResults() {
        let leftWon = this.scoreLeft > this.scoreRight;
        let isTie = this.scoreLeft == this.scoreRight;

        return leftWon
    }

    revealScore(leftWon) {
        if (leftWon) {
            this.matchWinningLeftContent.style.animation = "winBar 2s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchWinningLeftContent.style.width = "100%";
            this.matchWinningLeftContent.style.backgroundColor = "Black";
            this.matchWinningRightContent.style.animation = "loseBar 2s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchWinningRightContent.style.width = "100%";
            this.matchWinningRightContent.style.backgroundColor = "white";
            this.matchOneScore.style.color = "white";
            this.matchOneScore.style.transform = "TranslateX(480px)";
            this.matchTwoScore.style.transform = "TranslateX(-570px)";
            this.matchWinningLeftWinText.style.opacity = 1;
            this.matchWinningRightWinText.style.opacity = 0;
        } else {
            this.matchWinningRightContent.style.animation = "winBar 2s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchWinningRightContent.style.width = "100%";
            this.matchWinningRightContent.style.backgroundColor = "Black";
            this.matchWinningLeftContent.style.animation = "loseBar 2s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
            this.matchWinningLeftContent.style.width = "100%";
            this.matchWinningLeftContent.style.backgroundColor = "white";
            this.matchTwoScore.style.color = "white";
            this.matchOneScore.style.transform = "TranslateX(570px)";
            this.matchTwoScore.style.transform = "TranslateX(-480px)";
            this.matchWinningLeftWinText.style.opacity = 0;
            this.matchWinningRightWinText.style.opacity = 1;
        }
    }
}


// FUNCTIONS /////////////////////////////////////////////////////////////////
function nextStage() {
    if (currentStage < stages.length - 1) {
        currentStage++;
    } else {
        currentStage = 0;
    }
    updateStageDisplay();
}

function updateStageDisplay() {
    const stageInfo = stages[currentStage];
    console.log(stageInfo)
    document.getElementById('match-bottom-stage-front').innerHTML = stageInfo.stageName;
    document.getElementById('match-bottom-stage-back').innerHTML = stageInfo.stageAcronym;
    document.getElementById('nextStageButton').innerHTML = `Current Stage: ${stageInfo.stageAcronym}`;
}

async function getDataSet(beatmapID) {
    const { data } = await axios.get("/get_beatmaps", {
        baseURL: BASE,
        params: { b: beatmapID }
    });
    return data.length ? data[0] : null;
};

async function getUserDataSet(user_id) {
    const { data } = await axios.get("/get_user", {
        baseURL: BASE,
        params: { u: user_id, m: 0 }
    });
    return data.length ? data[0] : null;
}

const jsonUploadButton = document.getElementById('jsonUploadButton')
const jsonFileInput = document.getElementById('jsonFileInput')

jsonUploadButton.addEventListener('click', () => jsonFileInput.click())
jsonFileInput.addEventListener('change', handleJSONSelect)

function handleJSONSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => processJSON(evt.target.result)
    reader.readAsText(file)
}

function processJSON(jsonText) {
    let data
    try {
        data = JSON.parse(jsonText)
    } catch (err) {
        console.error('Invalid JSON', err)
        return
    }

    // --- beatmap list ---
    beatmapData = data.map(r => ({
        pick: r.pick || '',
        beatmapId: r.beatmapId,
        isOriginal: Boolean(r.isOriginal),
        isCustom: Boolean(r.isCustom),
        mappers: r.mappers || ''
    }))

    // populate beatmap IDs array for quick lookup
    beatmaps = beatmapData.map(item => item.beatmapId);

    console.log('beatmapData:', beatmapData);
    console.log('beatmaps:', beatmaps);
    beatmapSet = beatmapData;
    beatmapsIds = beatmaps;

    // initialize match manager
    matchManager = new MatchManager(beatmapData);
    matchManager.generateOverview();
}

async function makeScrollingText(title, titleDelay, rate, boundaryWidth, padding) {
    if (title.scrollWidth > boundaryWidth) {
        titleDelay.innerHTML = title.innerHTML;
        let ratio = (title.scrollWidth / boundaryWidth) * rate
        title.style.animation = `scrollText ${ratio}s linear infinite`;
        titleDelay.style.animation = `scrollText ${ratio}s linear infinite`;
        titleDelay.style.animationDelay = `${-ratio / 2}s`;
        titleDelay.style.paddingRight = `${padding}px`;
        title.style.paddingRight = `${padding}px`;
        titleDelay.style.display = "initial";
    } else {
        titleDelay.style.display = "none";
        title.style.animation = "none";
        titleDelay.style.animation = "none";
        titleDelay.style.paddingRight = "0px";
        titleDelay.style.marginTop = `0px`;
        title.style.paddingRight = "0px";
    }
}

async function getCountryFlag(acronym) {
    let imageUrl;
    // console.log(addFlags);
    // console.log(acronym);
    imageUrl = addFlags.find(flag => flag.flagname == acronym)["link"];
    // console.log(imageUrl);   
    return imageUrl;
}

async function adjustFont(title, boundaryWidth, originalFontSize) {
    if (title.scrollWidth > boundaryWidth) {
        let ratio = (title.scrollWidth / boundaryWidth);
        title.style.fontSize = `${originalFontSize / ratio}px`;
    } else {
        title.style.fontSize = `${originalFontSize}px`;
    }
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}

const parseTimeMs = ms => {
    const second = Math.floor(ms / 1000) % 60 + '';
    const minute = Math.floor(ms / 1000 / 60) + '';
    return `${'0'.repeat(2 - minute.length) + minute}:${'0'.repeat(2 - second.length) + second}`;
}

function turnControl() {
    matchManager.turn();
}

function hidePick() {
    matchManager.hidePick();
}

function undoControl() {
    matchManager.undo();
}

function promptGameplay() {
    matchManager.gameplay();
}