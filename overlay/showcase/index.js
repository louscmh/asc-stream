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

// BEATMAP DATA /////////////////////////////////////////////////////////////////
let beatmapData = [];
let tempBG;
let generated = false;
let showcaseManager;
let beatmaps = [];

// STAGES DATA STRUCTURE ///////////////////////////////////////////////////////
// Each entry is a tuple of stageName and stageAcronym
const stages = [
    { stageName: "Qualifiers",     stageAcronym: "QL"   },
    { stageName: "Round of 32",    stageAcronym: "RO32" },
    { stageName: "Round of 16",    stageAcronym: "RO16" },
    { stageName: "Quarterfinals",  stageAcronym: "QF"   },
    { stageName: "Semifinals",     stageAcronym: "SF"   },
    { stageName: "Finals",         stageAcronym: "F"    },
    { stageName: "Grand Finals",   stageAcronym: "GF"   }
]
let currentStage = 0;

const jsonUploadButton = document.getElementById('jsonUploadButton')
const jsonFileInput   = document.getElementById('jsonFileInput')

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
        pick:              r.pick || '',
        beatmapId:         r.beatmapId,
        isOriginal:        Boolean(r.isOriginal),
        isCustom:          Boolean(r.isCustom),
        mappers:           r.mappers || ''
    }))

    // populate beatmap IDs array for quick lookup
    beatmaps = beatmapData.map(item => item.beatmapId);

    console.log('beatmapData:', beatmapData);
    console.log('beatmaps:', beatmaps);
    showcaseManager = new ShowcaseManager(beatmapData);
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

function previousStage() {
    if (currentStage > 0) {
        currentStage--;
    } else {
        currentStage = stages.length - 1;
    }
    updateStageDisplay();
}

function updateStageDisplay() {
    const stageInfo = stages[currentStage];
    console.log(stageInfo)
    document.getElementById('showcase-text-front').innerHTML = stageInfo.stageName;
    document.getElementById('showcase-text-back').innerHTML = stageInfo.stageAcronym;
}

// // CLASS ////////////////////////////////////////////////////////////////////////
class ShowcaseManager {
    constructor(beatmapSet) {
        this.mapBg = document.getElementById("map-bg");
        this.mapTitleOrig = document.getElementById("map-title-orig");
        this.mapTitleDelay = document.getElementById("map-title-delay");
        this.mapArtistOrig = document.getElementById("map-artist-orig");
        this.mapArtistDelay = document.getElementById("map-artist-delay");
        this.mapDifficultyOrig = document.getElementById("map-difficulty-orig");
        this.mapDifficultyDelay = document.getElementById("map-difficulty-delay");
        this.mapMapperOrig = document.getElementById("map-mapper-orig");
        this.mapMapperDelay = document.getElementById("map-mapper-delay");
        this.mapSr = document.getElementById("map-sr");
        this.mapOd = document.getElementById("map-od");
        this.mapBpm = document.getElementById("map-bpm");
        this.mapLength = document.getElementById("map-length");
        this.queueContent = document.getElementById("queue-content");
        this.originalTag = document.getElementById("original-tag");
        this.customTag = document.getElementById("custom-tag");
        this.transition = document.getElementById("transition-stinger");

        this.stats = [];
        this.beatmapSet = beatmapSet;
        this.currentPick;
        this.generate();
    }
    async generate() {
        for (let i = 0; i < this.beatmapSet.length; i++) {
            let beatmap = this.beatmapSet[i];
            // console.log(beatmap);
            let pick = document.createElement("div");
            pick.id = `pick-${beatmap.pick.toLowerCase()}`;
            if (i == 0) {
                pick.setAttribute("class", "pick first-pick");
            } else {
                pick.setAttribute("class", "pick");
            }
            pick.innerHTML = beatmap.pick
            this.queueContent.appendChild(pick);
        }
        this.currentPick = 0;
        generated = true;
        console.log("Completed Setup!");
    }
    move(currentIndex) {
        this.beatmapSet.map((beatmap, index) => {
            let pick = document.getElementById(`pick-${beatmap.pick.toLowerCase()}`);
            if (index == currentIndex) {
                pick.setAttribute("class", "pick first-pick");
            } else {
                pick.setAttribute("class", "pick");
            }
        })
    }
    hideall() {
        this.beatmapSet.map((beatmap, index) => {
            let pick = document.getElementById(`pick-${beatmap.pick.toLowerCase()}`);
            pick.setAttribute("class", "pick");
        })
    }
    updateDetails(data) {
        this.transition.play();
        let id = String(data.menu.bm.id);
        let { memoryOD, fullSR, BPM: { min, max } } = data.menu.bm.stats;
        let { full } = data.menu.bm.time;
        let { difficulty, mapper, artist, title } = data.menu.bm.metadata;
        difficulty = difficulty.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        title = title.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        let file = data.menu.bm.path.file;
        let index;
        let customMapper = ""
        let beatmapSet = this.beatmapSet;
        let isPick = false;
    
        // CHECKER FOR MAPPICK
        if (beatmaps.includes(id)) {
            console.log("Found ID match!");
            isPick = true;
            index = beatmapSet.findIndex(beatmap => beatmap["beatmapId"] === id);
            customMapper = beatmapSet[index]["mappers"];
            this.move(index);
        } else if (beatmaps.includes(file)) {
            console.log("Found FILE match!");
            isPick = true;
            index = beatmapSet.findIndex(beatmap => beatmap["beatmapId"] === file);
            customMapper = beatmapSet[index]["mappers"];
            this.move(index);
        } else {
            isPick = false;
            this.hideall();
        }

        setTimeout(function() {
            // this.pickAsset.innerHTML = pick == undefined ? "N.A" : pick;
            this.mapTitleOrig.innerHTML = title;
            this.mapArtistOrig.innerHTML = artist;
            this.mapMapperOrig.innerHTML = customMapper != "" ? customMapper:mapper;
            this.mapDifficultyOrig.innerHTML = difficulty;
            this.mapOd.innerHTML = Number(memoryOD).toFixed(1);
            this.mapSr.innerHTML = `${fullSR}*`;
            this.mapBpm.innerHTML = min === max ? min : `${min} - ${max}`;
            this.mapLength.innerHTML = parseTime(full);
            this.originalTag.style.opacity = isPick ? beatmapSet[index]["isOriginal"] ? 1 : 0 : 0;
            this.customTag.style.opacity = isPick ? beatmapSet[index]["isCustom"] ? 1 : 0 : 0;
        
            // BG
            try {
                if(tempBG !== data.menu.bm.path.full){
                    tempBG = data.menu.bm.path.full;
                    data.menu.bm.path.full = data.menu.bm.path.full.replace(/#/g,'%23').replace(/%/g,'%25');
                    this.mapBg.setAttribute('src',`http://127.0.0.1:24050/Songs/${data.menu.bm.path.full}?a=${Math.random(10000)}`);
                }
            } catch (e) {
                this.mapBg.setAttribute('src',"../../_shared_assets/design/main_banner.png");
            }
    
            // this.adjustFont(this.songTitleAsset,500,36);

            this.makeScrollingText(this.mapTitleOrig, this.mapTitleDelay,20,480,20);
            this.makeScrollingText(this.mapArtistOrig, this.mapArtistDelay,20,480,30);
            this.makeScrollingText(this.mapDifficultyOrig, this.mapDifficultyDelay,20,480,30);
            this.makeScrollingText(this.mapMapperOrig, this.mapMapperDelay,20,480,30);
        }.bind(this),500)
    }
    adjustFont(title, boundaryWidth, originalFontSize) {
        if (title.scrollWidth > boundaryWidth) {
            let ratio = (title.scrollWidth/boundaryWidth);
            title.style.fontSize = `${originalFontSize/ratio}px`;
        } else {
            title.style.fontSize = `${originalFontSize}px`;
        }
    }
    makeScrollingText(title, titleDelay, rate, boundaryWidth, padding) {
        console.log(title.scrollWidth, boundaryWidth);
        if (title.scrollWidth > boundaryWidth) {
            titleDelay.innerHTML = title.innerHTML;
            let ratio = (title.scrollWidth/boundaryWidth)*rate
            title.style.animation = `scrollText ${ratio}s linear infinite`;
            titleDelay.style.animation = `scrollText ${ratio}s linear infinite`;
            titleDelay.style.animationDelay = `${-ratio/2}s`;
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
    updateReplayer(name) {
        if (`Replay By ${name}` == this.replayer.innerHTML) return;
        if (name == undefined || name == "") {
            this.replayer.innerHTML = ``;
        } else {
            this.replayer.innerHTML = `Replay By ${name}`;
        }
    }
    fadeOut() {
        this.clientAsset.style.animation = "fadeOutRight 1s cubic-bezier(.45,0,1,.48)";
        this.beatmapDetailsAsset.style.animation = "fadeOutRight 1s cubic-bezier(.45,0,1,.48)";
        this.pickMaskAsset.style.animation = "fadeOutRight 1s cubic-bezier(.45,0,1,.48)";
        this.fgAsset.style.animation = "fadeOutRight 1s cubic-bezier(.45,0,1,.48)";
        this.clientAsset.style.opacity = 0;
        this.beatmapDetailsAsset.style.opacity = 0;
        this.pickMaskAsset.style.opacity = 0;
        this.fgAsset.style.opacity = 0;
    }
    fadeIn() {
        this.clientAsset.style.opacity = 1;
        this.beatmapDetailsAsset.style.opacity = 1;
        this.pickMaskAsset.style.opacity = 1;
        this.fgAsset.style.opacity = 1;
        this.clientAsset.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        this.beatmapDetailsAsset.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        this.pickMaskAsset.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
        this.fgAsset.style.animation = "fadeInLeft 1s cubic-bezier(0.000, 0.125, 0.000, 1.005)";
    }
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }
    updateStats(metadata,stats) {
        this.metadata = metadata;
        this.stats = stats;
    }
}

socket.onmessage = async event => {
    if (!generated) {return};
    let data = JSON.parse(event.data);
    
    if (generated) {
        let tempStats = [data.menu.bm.stats.OD, data.menu.bm.stats.fullSR];
        if (showcaseManager.metadata != data.menu.bm.path.file && !showcaseManager.arraysEqual(showcaseManager.stats,tempStats)) {
            showcaseManager.updateStats(data.menu.bm.path.file, tempStats);
            showcaseManager.updateDetails(data);
        };
    }
}

const parseTime = ms => {
	const second = Math.floor(ms / 1000) % 60 + '';
	const minute = Math.floor(ms / 1000 / 60) + '';
	return `${'0'.repeat(2 - minute.length) + minute}:${'0'.repeat(2 - second.length) + second}`;
}

async function makeScrollingText(title, titleDelay, rate, boundaryWidth, padding) {
    if (title.scrollWidth > boundaryWidth) {
        titleDelay.innerHTML = title.innerHTML;
		let ratio = (title.scrollWidth/boundaryWidth)*rate
		title.style.animation = `scrollText ${ratio}s linear infinite`;
		titleDelay.style.animation = `scrollText ${ratio}s linear infinite`;
		titleDelay.style.animationDelay = `${-ratio/2}s`;
		titleDelay.style.paddingRight = `${padding}px`;
		title.style.paddingRight = `${padding}px`;
        titleDelay.style.marginTop = `-${title.offsetHeight}px`;
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

// class Beatmap {
//     constructor(mods, beatmapID, layerName) {
//         this.mods = mods;
//         this.beatmapID = beatmapID;
//         this.layerName = layerName;
//         this.isBan = false;
//     }
//     generate() {
//         let mappoolContainer = document.getElementById(`${this.mods}`);

//         this.clicker = document.createElement("div");
//         this.clicker.id = `${this.layerName}Clicker`;
//         this.clicker.setAttribute("class", "clicker");

//         mappoolContainer.appendChild(this.clicker);
//         let clickerObj = document.getElementById(this.clicker.id);

//         this.mapDetails = document.createElement("div");
//         this.mapTitleContainer = document.createElement("div");
//         this.mapTitle = document.createElement("div");
//         this.mapArtistContainer = document.createElement("div");
//         this.mapArtist = document.createElement("div");
//         this.mapBottom = document.createElement("div");
//         this.mapMapperContainer = document.createElement("div");
//         this.mapMapperTitle = document.createElement("div");
//         this.mapMapper = document.createElement("div");
//         this.mapDifficultyContainer = document.createElement("div");
//         this.mapDifficultyTitle = document.createElement("div");
//         this.mapDifficulty = document.createElement("div");
//         this.mapModpool = document.createElement("div");
//         this.mapOverlay = document.createElement("div");
//         this.mapSource = document.createElement("img");

//         this.mapDetails.id = `${this.layerName}mapDetails`;
//         this.mapTitleContainer.id = `${this.layerName}mapTitleContainer`;
//         this.mapTitle.id = `${this.layerName}mapTitle`;
//         this.mapArtistContainer.id = `${this.layerName}mapArtistContainer`;
//         this.mapArtist.id = `${this.layerName}mapArtist`;
//         this.mapBottom.id = `${this.layerName}mapBottom`;
//         this.mapMapperContainer.id = `${this.layerName}mapMapperContainer`;
//         this.mapMapperTitle.id = `${this.layerName}mapMapperTitle`;
//         this.mapMapper.id = `${this.layerName}mapMapper`;
//         this.mapDifficultyContainer.id = `${this.layerName}mapDifficultyContainer`;
//         this.mapDifficultyTitle.id = `${this.layerName}mapDifficultyTitle`;
//         this.mapDifficulty.id = `${this.layerName}mapDifficulty`;
//         this.mapModpool.id = `${this.layerName}mapModpool`;
//         this.mapOverlay.id = `${this.layerName}mapOverlay`;
//         this.mapSource.id = `${this.layerName}mapSource`;

//         this.mapDetails.setAttribute("class", "mapDetails");
//         this.mapTitleContainer.setAttribute("class", "mapTitleContainer");
//         this.mapTitle.setAttribute("class", "mapTitle");
//         this.mapArtistContainer.setAttribute("class", "mapArtistContainer");
//         this.mapArtist.setAttribute("class", "mapArtist");
//         this.mapBottom.setAttribute("class", "mapBottom");
//         this.mapMapperContainer.setAttribute("class", "mapMapperContainer");
//         this.mapMapperTitle.setAttribute("class", "mapMapperTitle");
//         this.mapMapper.setAttribute("class", "mapMapper");
//         this.mapDifficultyContainer.setAttribute("class", "mapDifficultyContainer");
//         this.mapDifficultyTitle.setAttribute("class", "mapDifficultyTitle");
//         this.mapDifficulty.setAttribute("class", "mapDifficulty");
//         this.mapModpool.setAttribute("class", "mapModpool");
//         this.mapOverlay.setAttribute("class", "mapOverlay");
//         this.mapSource.setAttribute("class", "mapSource");

//         this.mapModpool.innerHTML = this.mods;
//         this.mapMapperTitle.innerHTML = "MAPPED BY";
//         this.mapDifficultyTitle.innerHTML = "DIFFICULTY";
//         this.mapSource.setAttribute('src',"../../../_shared_assets/design/main_banner.png");
        
//         clickerObj.appendChild(this.mapDetails);
//         clickerObj.appendChild(this.mapModpool);
//         clickerObj.appendChild(this.mapOverlay);
//         clickerObj.appendChild(this.mapSource);

//         document.getElementById(this.mapDetails.id).appendChild(this.mapTitleContainer);
//         document.getElementById(this.mapDetails.id).appendChild(this.mapArtistContainer);
//         document.getElementById(this.mapDetails.id).appendChild(this.mapBottom);

//         document.getElementById(this.mapTitleContainer.id).appendChild(this.mapTitle);
//         document.getElementById(this.mapArtistContainer.id).appendChild(this.mapArtist);

//         document.getElementById(this.mapBottom.id).appendChild(this.mapMapperContainer);
//         document.getElementById(this.mapBottom.id).appendChild(this.mapDifficultyContainer);
//         document.getElementById(this.mapMapperContainer.id).appendChild(this.mapMapperTitle);
//         document.getElementById(this.mapMapperContainer.id).appendChild(this.mapMapper);
//         document.getElementById(this.mapDifficultyContainer.id).appendChild(this.mapDifficultyTitle);
//         document.getElementById(this.mapDifficultyContainer.id).appendChild(this.mapDifficulty);
//     }
// }