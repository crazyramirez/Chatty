//API to handle audio recording
document.addEventListener("DOMContentLoaded", init);

function init() {  
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
    });
}

const recordAudio = () =>
  new Promise(async resolve => {
    let isRecording = false;
    let silenceTimeout;
    const silenceThreshold = 2; // Ajusta este umbral según tus necesidades
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    // Calcula el nivel de amplitud promedio del audio
    const audioBlob = new Blob(audioChunks);
    const audioBuffer = await audioBlob.arrayBuffer();
    const audioData = new Float32Array(audioBuffer);
    const amplitude =
    audioData.reduce((acc, val) => acc + Math.abs(val), 0) / audioData.length;

    if (amplitude < silenceThreshold) {
        // Si el nivel de amplitud es menor que el umbral, considera que hay silencio
        if (isRecording) {
            // Si ya se está grabando, detén la grabación
            await stopRecording();
        }
    } else {
        // Si el nivel de amplitud es mayor que el umbral, considera que hay sonido
        if (!isRecording) {
            // Si no se está grabando, inicia la grabación
            mediaRecorder.start();
            isRecording = true;
            console.log("Start Audio Recording");
        }
    }

    // Reinicia el temporizador de silencio
    clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(async () => {
        // Si se detecta silencio durante un período de tiempo, detén la grabación
        if (isRecording) {
            await stopRecording();
        }
    }, 4000); // Ajusta el tiempo de detección de silencio

    const stopRecording = async () => {
        mediaRecorder.stop();
        isRecording = false;
        console.log("Stop Audio Recording");
        new Promise(resolve => {
            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks);
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.play();
                console.log("Play Audio Recording");
                resolve({ audioBlob, audioUrl });
            });
        });
        // resolve({ audioBlob, audioUrl, play });
    };
  });
