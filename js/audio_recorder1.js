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
        MEDIA_RECORDER.start(1000);
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

let sendEnabled = true;
let audioChunks = [];

// Record
function record(){

    RECORDING_INTERVAL = setInterval(() => {
        RECORDING_TIME++;
    }, 1000);

    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        MEDIA_RECORDER = new MediaRecorder(stream);
        MEDIA_RECORDER.stop();
        
        //start recording:
        MEDIA_RECORDER.start(1000);
        
        //save audio chunks:
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

            if (!sendEnabled) {
                console.log('SEND Disabled.');
                return;
            }

            // Stop all the tracks:
            setTimeout(() => {
                document.getElementById("mic-icon").classList.remove("show");
            }, 300);
            stream.getTracks().forEach(track => track.stop());

            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                uploadAudioToServer(audioBlob);
                audioChunks = []; // Clear audioChunks after sending
                IS_RECORDING = false;
                RECORDING_TIME = 0;
                clearInterval(RECORDING_INTERVAL);
                MEDIA_RECORDER = null;
            }

        });

    });
}


// Upload Recorded Audio to Server
function uploadAudioToServer(audioBlob) {
    console.log("Recording Duration: " + RECORDING_TIME + " seconds");
    if (RECORDING_TIME < 2) 
        return;

    console.log("Send Recording to Server");

    // Create a Blob from audioBlob if it's not already in the correct format
    // const blob = audioBlob instanceof Blob ? audioBlob : new Blob([audioBlob], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append("clientId", localStorage.getItem("clientId"));

    fetch('/upload-audio', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                console.error('Error al enviar el audio al servidor.');
                throw new Error('Error al enviar el audio al servidor.');
            }
        })
        .then(data => {
            console.log('Audio enviado exitosamente al servidor.');
        })
        .catch(error => {
            console.error('Error en la solicitud fetch:', error);
        });

    sendEnabled = false;
    setTimeout(() => {
        sendEnabled = true;
        console.log('SEND Enabled');
    }, 5000);
}
