require("dotenv/config");

const path = require("path")
const cors = require('cors');
const http = require('http');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const socketIO = require('socket.io');
const multer = require('multer');
const OpenAI=require("openai")
let gtts = require('node-gtts')('es');
const { exec } = require('child_process');

// Init Express
const app = express();
const router = express.Router();

// Middleware
app.use(express.static("./"));
app.use(express.static('public'));
app.use('/images', express.static('public/images'));
app.use('/recordings', express.static('public/recordings'));
app.use('/', router);
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));
app.use(cors());

// API Routes
app.get('/', (req, res) => {
    // debugger
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

// Server HTTPS Localhost -- HTTP Production
var server;
if (process.env.NODE_ENV === "development")
{
    // Certificate HTTPS Localhost
    const privateKey = fs.readFileSync('key.pem', 'utf8');
    const certificate = fs.readFileSync('cert.pem', 'utf8');
    const credentials = {key: privateKey, cert: certificate};
    server = https.createServer(credentials, app);
} else {
    server = http.createServer(app);
}
server.timeout = 60000;

// Server Listen
server.listen(3000, () => {
    console.log(`Servidor Socket.IO iniciado en el puerto 3000`);
    console.log("---- ---- APP Started ---- ----");
});

// Socket.io Configuration
const io = socketIO(server, {
    cors: {
        origin: 'https://visenidev.com',
        methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS']
    }
});

// SocketIO Connection
io.on("connection", (socket) => {
    const clientId = socket.handshake.query.clientId;
    console.log('Un cliente se ha conectado con el ID: ' + clientId);
    socket.join(clientId)
    socket.emit("onConnected", { id: clientId });
    socket.on('disconnect', () => {
        console.log('disconnectClient: ' + clientId);
        socket.leave(clientId);
    });
});

// OpenAI
const openai= new OpenAI({
    apiKey: process.env.OPENAI_API
});

// POST Speech
app.post('/speech', function(req, res) {
    const textToSave = req.body.textMsg;
    const clientId = req.body.clientId;
    io.to(clientId).emit("gpt-thinking");
    var filepath = path.join(__dirname, "/public/recordings/" + clientId + '_response.wav');
    console.log("Speech TEXT: " + textToSave);
    gtts.save(filepath, textToSave, function () {
        console.log("Speech SAVED");
        io.to(clientId).emit("play-audio");
    });
});


// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST Upload Audio File
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
    const clientId = req.body.clientId;
    fs.writeFileSync("public/recordings/" + clientId + '_recording.wav', req.file.buffer);
    try {
        // OpenAI Audio Transcription
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream("public/recordings/" + clientId + '_recording.wav'),
            model: "whisper-1",
            language: "es"
        });
        console.log("Transcription: " + transcription.text);

        if (transcription.text.includes("Amara.org") || transcription.text.includes("Subtítulos realizados"))
            return;

        // Delete recorded File
        // fs.unlink("public/recordings/" + clientId + '_recording.wav', (err) => {
        //     if (err) {
        //         console.error('Error al eliminar el archivo:', err);
        //     } else {
        //         console.log('Archivo eliminado con éxito');
        //     }
        // });

        io.to(clientId).emit("text-send", {text: transcription.text});
        io.to(clientId).emit("gpt-thinking");

        await sendMessageToOpenAI(clientId, transcription.text);
        // OpenAI Chat Generation Received Text

    } catch (error) {
        console.error('Error al procesar la transcripción:', error);
        res.status(500).json({ error: 'Error al procesar la transcripción' });
    }
});

const messageHistories = {};
// Función para enviar un mensaje a OpenAI
async function sendMessageToOpenAI(clientId, message) {
    try {
        // Obtiene el historial de mensajes del cliente o inicializa uno si es nuevo
        const messageHistory = messageHistories[clientId] || [];

        if (messageHistory.length >= 5) {
            messageHistory.shift();
        }
        
        // Agrega el nuevo mensaje al historial
        messageHistory.push({ role: 'user', content: message });

        // Realiza una consulta a OpenAI con el historial completo
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messageHistory,
            max_tokens: 100,
        });

        // Agrega la respuesta de OpenAI al historial
        messageHistory.push({ role: 'assistant', content: response.choices[0].message.content });

        // Actualiza el historial del cliente
        messageHistories[clientId] = messageHistory;

        console.log("Response: " + response.choices[0].message.content);

        // Socket Emit
        io.to(clientId).emit("text-received", {text: response.choices[0].message.content});

    } catch (error) {
        console.error('Error al enviar mensaje a OpenAI:', error);
        return 'Ocurrió un error al procesar la solicitud';
    }
}
