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

let timerDisplay = document.getElementById('timer');
let timerBackDisplay = document.getElementById('timer-back');
let fillBar = document.getElementById('fill');

let defaultDuration = 300; // 5:00 in seconds
let duration = defaultDuration;
let countdownInterval;

function formatTime(seconds) {
  let min = Math.floor(seconds / 60);
  let sec = seconds % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function updateDisplay() {
  timerDisplay.textContent = formatTime(duration);
  timerBackDisplay.textContent = formatTime(duration);
}

function startCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (duration > 0) {
      duration--;
      updateDisplay();
    }
  }, 1000);
}

function increaseTime() {
  duration += 60;
  updateDisplay();
}

function decreaseTime() {
  if (duration >= 60) {
    duration -= 60;
    updateDisplay();
  } else {
    duration = 0;
    updateDisplay();
  }
}

function resetTimer() {
  duration = defaultDuration;
  updateDisplay();
}

function hideNP() {
  let npElement = document.getElementById('now-playing');
  if (npElement.style.display === 'none') {
    npElement.style.display = 'initial';
  } else {
    npElement.style.display = 'none';
  }
}

updateDisplay();
startCountdown();

socket.onmessage = async event => {
    let data = JSON.parse(event.data);
    document.getElementById('now-playing').innerHTML = data.menu.bm.metadata.title || "No Song";
}