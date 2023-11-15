document.addEventListener("DOMContentLoaded", init);

function init() {  
    setupCamera();
}

// Setup Video Stream
function setupCamera() {  

    video = document.getElementById("video");
    if (cameraStream && cameraStream != null)
        return;
    let constraint = {
        video:{
            width:{ideal:1024},
            height:{ideal:768},
            facingMode:"user"
        },
        audio:false
    }
    navigator.mediaDevices.getUserMedia(constraint).then((stream)=>{
      video.setAttribute("playsinline", "true");
      cameraStream = stream;
      video.srcObject = cameraStream;
      video.onloadedmetadata = ()=>{
        video.play();
        setTimeout(() => {
            setupFaceAPI(video);
        }, 1000);

      }}).catch((e)=>{
          console.log(e);
          alert(e)
    })
}

async function setupFaceAPI() {  
    await faceapi.nets.ssdMobilenetv1.loadFromUri('./faceapi_models', { minConfidence: 0.8 });
    await faceapi.loadFaceExpressionModel('./faceapi_models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/faceapi_models');

    detectInterval = setInterval(() => {
        detectFace();
    }, 1000);
    setTimeout(() => {
        document.getElementById("loadingText").innerText = "TAP TO ENTER";
        document.getElementById("loadingDiv").onclick = enableSpeech;
    }, 1000);
}

let surpriseTimer = null;
let threshold = 5;

async function detectFace() {
    var detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceExpressions();
    if (detection) {
        console.log("FACE DETECTED");

        const landmarks = detection.landmarks;

        // Ejemplo: verificar si los ojos están a un nivel similar y si la nariz está centrada
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();

        const isFacingForward = (
            Math.abs(leftEye[1].y - rightEye[1].y) < threshold && // ojos aproximadamente al mismo nivel
            nose[0].x > leftEye[0].x && nose[0].x < rightEye[0].x // la nariz está entre los ojos
        );

        if (!isFacingForward) {
            return;
        }

        // Expressions
        var expressions = detection.expressions;
        var dominantExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);

        var expressionMapping = {
            'neutral': 'Neutral',
            'happy': 'Happy',
            'sad': 'Sad',
            'angry': 'Angry',
            'fearful': 'Fearful',
            'disgusted': 'Disgusted',
            'surprised': 'Surprised'
        };

        console.log("Expression: " + expressionMapping[dominantExpression]);

        if (expressionMapping[dominantExpression] === 'Happy') {
            if (lastExpression !== 'Happy') {
                clearTimeout(surpriseTimer);
                surpriseTimer = setTimeout(() => {
                    listening();
                    clearInterval(detectInterval)
                }, 2000);
            }
        } else {
            clearTimeout(surpriseTimer);
        }
        lastExpression = expressionMapping[dominantExpression];

    } else {
        console.log("_NOT_DETECTED_");
    }
}

