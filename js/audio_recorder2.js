VOICE_MIN_DECIBELS      = -40;
DELAY_BETWEEN_DIALOGS   = 1000;
DIALOG_MAX_LENGTH       = 60*1000;
MEDIA_RECORDER          = null;
IS_RECORDING            = false;

//API to handle audio recording
document.addEventListener("DOMContentLoaded", init);

function init() {  
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        MEDIA_RECORDER = new MediaRecorder(stream);
        MEDIA_RECORDER.start();
        MEDIA_RECORDER.stop();
    });
}

//startRecording:
function startRecording(){
  

    document.getElementById("mic-icon").classList.add("show");
    IS_RECORDING = true;
    record();
    console.log("Start Recording");
}

//stopRecording:
function stopRecording(){
    document.getElementById("mic-icon").classList.remove("show");
    IS_RECORDING = false;
    if(MEDIA_RECORDER !== null)
        MEDIA_RECORDER.stop();

    console.log("Stop Recording");
}

//record:
function record(){

    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        MEDIA_RECORDER = new MediaRecorder(stream);
        // MEDIA_RECORDER.stop();
        
        //start recording:
        MEDIA_RECORDER.start();
        
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
            document.getElementById("mic-icon").classList.remove("show");
            stream.getTracks().forEach(track => track.stop());
            // stream = null;
            IS_RECORDING = false;

            // if(!anySoundDetected) return;
            //send to server:
            const audioBlob = new Blob(audioChunks, {'type': 'audio/mpeg'});
            doWhateverWithAudio(audioBlob);
            // MEDIA_RECORDER = null;
        });

    });
}


function doWhateverWithAudio(audioBlob) {
    // return;
    console.log("Send Recording to Server");

    // Create a Blob from audioBlob if it's not already in the correct format
    const blob = audioBlob instanceof Blob ? audioBlob : new Blob([audioBlob], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    formData.append("clientId", localStorage.getItem("clientId"));

    fetch('/upload-audio', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (response.ok) {
                return response.json(); // Parsear la respuesta como JSON
            } else {
                console.error('Error al enviar el audio al servidor.');
                throw new Error('Error al enviar el audio al servidor.');
            }
        })
        .then(data => {
            console.log('Audio enviado exitosamente al servidor.');
            // var audio = document.getElementById('audio');
            // audio.volume = 1;
            // var audioSrc = "../public/recordings/" + localStorage.getItem("clientId") + "_recording.wav?timestamp=" + new Date().getTime();
            // audio.src = audioSrc;
            // audio.play();
            // console.log(data.transcription); // Acceder a la transcripción desde la respuesta JSON
        })
        .catch(error => {
            console.error('Error en la solicitud fetch:', error);
        });

    // const audio = document.createElement("audio");
    // audio.src = window.URL.createObjectURL(blob);
    // document.body.appendChild(audio); // Use document.body to append to the body element
    // audio.load();
    // audio.play();
}
