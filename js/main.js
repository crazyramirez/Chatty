document.addEventListener("DOMContentLoaded", init);

let robotImg = document.getElementById("robot-img");
var messageContainer = document.getElementById('message-container');
let interval;
let video;
let cameraStream = null;
let lastExpression = null;
let detectInterval;

// Generate UniqueID
function generateUniqueId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

// Get or Create UniqueID from localStorage
function getOrCreateClientId() {
    const localStorageKey = 'clientId';
    let clientId = localStorage.getItem(localStorageKey);
    if (!clientId || clientId === "undefined" || clientId === "" || clientId ===  null || clientId === "null") {
      clientId = generateUniqueId();
      localStorage.setItem(localStorageKey, clientId);
    }
    return clientId;
}

const uniqueId = getOrCreateClientId();

// SOCKET IO FOR PRODUCTION !!!!
var socket = io({
    // transports: ['polling'],
    // transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 5000,
    query: {
        clientId: uniqueId
    }
});

// Socket.io onConnected emit from index.ts
socket.on('onConnected', function(args) {
    console.log("SocketID Connected: " + args.id);
    localStorage.setItem("id", args.id);
});

socket.on('disconnect', function(args) {
    console.log("SocketID Disconnect");
    socket.emit("disconnectClient", localStorage.getItem("id", args.id));
});


function init() {  
    // setupCamera();
    robotAnim("idle", 1, 500);
    setTimeout(() => {
        document.getElementById("loadingText").innerText = "TAP TO ENTER";
        document.getElementById("loadingDiv").onclick = enableSpeech;
    }, 1000);

    robotImg.onclick = tapRobot; 
}


function enableSpeech() {  
    var audio = document.getElementById('audio');
    audio.volume = 1;
    var audioSrc = "../public/audio/ding.mp3"; // Agrega un parámetro de tiempo único
    audio.src = audioSrc;
    audio.play();
    activarPantallaCompleta();
    document.getElementById("loadingDiv").style.display = "none";
}

let lastSalute = 1;
async function tapRobot() {  
    var audio = document.getElementById('audio');

    if (!audio.paused)
    {
        audio.pause();
        audio.currentTime = 0;
        robotAnim("idle", 1, 500);
        return;
    }

    if (MEDIA_RECORDER && IS_RECORDING)
    {
        MEDIA_RECORDER.stop();
        return;
    }

    let rndInt1 = Math.floor(Math.random() * 10) + 1;
    while (lastSalute === rndInt1) {
         rndInt1 = Math.floor(Math.random() * 10) + 1;
    }
    lastSalute = rndInt1;

    setTimeout(() => {
        robotAnim("idle", 1, 500); 
        var audio = document.getElementById('audio');
        audio.volume = 1;
        var audioSrc = "../public/audio/start.mp3"; // Agrega un parámetro de tiempo único
        audio.src = audioSrc;
        audio.play(); 
    }, 100);
    setTimeout(() => {
        document.getElementById("mic-icon").style.visibility = "visible";
        startRecording();

        // lastExpression = "Neutral";
        // detectInterval = setInterval(() => {
        //     detectFace();
        // }, 1000);
    }, 200);
}

function robotAnim(type, subtype, time) {
    let currentImageIndex = 0;
    let images = [
    "./public/images/robot_" + type + "_" + subtype + "_1.webp",
    "./public/images/robot_" + type + "_" + subtype + "_2.webp",
    ];

    clearInterval(interval);
    interval = setInterval(() => {
        robotImg.src = images[currentImageIndex];
        currentImageIndex++;
        if (currentImageIndex >= images.length) {
            currentImageIndex = 0;
        }
    }, time);
}

function robotSpeech(textMsg) {  
    const data = {
        textMsg: textMsg,
        clientId: localStorage.getItem("clientId"),
    };
    fetch('/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        // Manejar la respuesta del servidor

        robotAnim("talk", 2, 100);

        var audio = document.getElementById('audio');
        audio.volume = 1;
        var audioSrc = "../public/recordings/" + localStorage.getItem("clientId") + "_response.wav?timestamp=" + new Date().getTime(); // Agrega un parámetro de tiempo único
        audio.src = audioSrc;
        audio.play(); 

        document.getElementById("audio").addEventListener("ended", function () {  
            robotAnim("idle", 1, 500);
        }, false);

    })
    .catch(error => {
        console.error('Error:', error);
    });  
}

function createParagraph(textMsg, type) { 
    messageContainer.style.display = "flex";
    var newParagraph = document.createElement('p');
    newParagraph.className = type;
    newParagraph.innerText = textMsg;
    messageContainer.appendChild(newParagraph);
    setTimeout(() => {
        newParagraph.classList.add('show');
        messageContainer.scrollTo({ top: newParagraph.offsetTop, behavior: 'smooth' });
    }, 100);
}

function convertirATextoPlano(texto) {
    // return texto.toString().replace(/[\n\r]+/g, ' ').replace(/<[^>]*>?/gm, '');
    return texto.replace(/<[^>]*>?/gm, '');
}

socket.on('text-received', function(args) {
    console.log(args.text);
    let plainText = convertirATextoPlano(args.text.content)
    robotSpeech(plainText);
    createParagraph(plainText, "response")
});

socket.on('text-send', function(args) {
    console.log(args.text);
    let plainText = convertirATextoPlano(args.text)
    createParagraph(plainText, "message")
});