// Global Variables
VOICE_MIN_DECIBELS      = -45;
DELAY_BETWEEN_DIALOGS   = 1000;
DIALOG_MAX_LENGTH       = 60*1000;
MEDIA_RECORDER          = null;
IS_RECORDING            = false;
let RECORDING_TIME = 0;
let RECORDING_INTERVAL;

document.addEventListener("DOMContentLoaded", init);
function init() {  
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        MEDIA_RECORDER = new MediaRecorder(stream);
        MEDIA_RECORDER.start();
        MEDIA_RECORDER.stop();
    });
}

// Start Recording
function startRecording() {
    document.getElementById("mic-icon").classList.add("show");
    IS_RECORDING = true;
    record();
    console.log("Start Recording");
}

// Stop Recording
function stopRecording(){
    document.getElementById("mic-icon").classList.remove("show");
    IS_RECORDING = false;
    if(MEDIA_RECORDER !== null)
        MEDIA_RECORDER.stop();

    console.log("Stop Recording");
}

// Record
function record(){

    RECORDING_INTERVAL = setInterval(() => {
        RECORDING_TIME++;
    }, 1000);

    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        MEDIA_RECORDER = new MediaRecorder(stream);
        // MEDIA_RECORDER.stop();
        
        //start recording:
        MEDIA_RECORDER.start(1000);
        
        //save audio chunks:
        const audioChunks = [];
        MEDIA_RECORDER.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });
        
        //analisys:
        const audioContext      = new AudioContext();
        const audioStreamSource = audioContext.createMediaStreamSource(stream);
        const analyser          = audioContext.createAnalyser();
        analyser.minDecibels    = VOICE_MIN_DECIBELS;
        audioStreamSource.connect(analyser);
        const bufferLength      = analyser.frequencyBinCount;
        const domainData        = new Uint8Array(bufferLength);
        
        //loop:
        let time              = new Date();
        let startTime,
            lastDetectedTime    = time.getTime();
        let anySoundDetected    = false;
        const detectSound       = () => {
            
            //recording stoped by user:
            if(!IS_RECORDING)
                return;

            time = new Date();
            currentTime = time.getTime();
            
            //time out:
            if(currentTime > startTime + DIALOG_MAX_LENGTH){
                MEDIA_RECORDER.stop();
                return;
            }

            //a dialog detected:
            if( anySoundDetected === true &&
                currentTime > lastDetectedTime + DELAY_BETWEEN_DIALOGS
                ){
                MEDIA_RECORDER.stop();
                return;
            }
            
            //check for detection:
            analyser.getByteFrequencyData(domainData);
            for(let i = 0; i < bufferLength; i++)
                if(domainData[i] > 0){
                    anySoundDetected = true;
                    time = new Date();
                    lastDetectedTime = time.getTime();
                }
            
            //continue the loop:
            window.requestAnimationFrame(detectSound);
        };
        window.requestAnimationFrame(detectSound);

        //stop event:
        MEDIA_RECORDER.addEventListener('stop', () => {
            console.log("Stop Audio Recording");
            //stop all the tracks:
            setTimeout(() => {
                document.getElementById("mic-icon").classList.remove("show");
            }, 300);
            stream.getTracks().forEach(track => track.stop());
            // stream = null;
            const audioBlob = new Blob(audioChunks, {'type': 'audio/wav'});
            uploadAudioToServer(audioBlob);

            IS_RECORDING = false;
            RECORDING_TIME = 0;
            clearInterval(RECORDING_INTERVAL);
        });

    });
}


// Upload Recorded Audio to Server
let sendEnabled = true;
let uploading = false; // Variable de estado para evitar repeticiones

function uploadAudioToServer(audioBlob) {
    if (!sendEnabled) {
        console.log('SEND Disabled.');
        return;
    }

    // Evitar repeticiones
    if (uploading) {
        console.log('Ya se está cargando, evitando duplicados.');
        return;
    }

    console.log("Recording Duration: " + RECORDING_TIME + " seconds");
    if (RECORDING_TIME < 1) 
        return;

    console.log("Send Recording to Server");

    // Crear una Blob a partir de audioBlob si no está en el formato correcto
    const blob = audioBlob instanceof Blob ? audioBlob : new Blob([audioBlob], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    formData.append("clientId", localStorage.getItem("clientId"));

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload-audio', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            uploading = false; // Restablecer la variable de estado
            if (xhr.status === 200) {
                console.log('Éxito');
            } else {
                console.error('Error al enviar datos al servidor');
            }
        }
    };
    xhr.send(formData);

    // Cambiar el estado a "cargando" para evitar repeticiones
    uploading = true;

    sendEnabled = false;
    setTimeout(() => {
        sendEnabled = true;
        console.log('SEND Enabled');
    }, 5000);
}
