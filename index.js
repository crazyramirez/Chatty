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
    var filepath = path.join(__dirname, "/public/recordings/" + clientId + '_response.wav');
    console.log("textToSave: " + textToSave);
    gtts.save(filepath, textToSave, function () {
        console.log("Saved");
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
        console.log(transcription.text);
        io.to(clientId).emit("text-send", {text: transcription.text});

        // Delete recorded File
        fs.unlink("public/recordings/" + clientId + '_recording.wav', (err) => {
            if (err) {
                console.error('Error al eliminar el archivo:', err);
            } else {
                console.log('Archivo eliminado con éxito');
            }
        });

        // OpenAI Chat Generation
        // const chatCompletion = await openai.chat.completions.create({
        //     model: "gpt-3.5-turbo",
        //     messages: [{"role": "user", "content": transcription.text}],
        // });
        // console.log(chatCompletion.choices[0].message);  

        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{"role": "user", "content": transcription.text}],
            max_tokens: 100,
            n: 1,
            stop: null,
            temperature: 1,
        });
        
        // OpenAI Chat Generation Received Text
        io.to(clientId).emit("text-received", {text: chatCompletion.choices[0].message});

    } catch (error) {
        console.error('Error al procesar la transcripción:', error);
        res.status(500).json({ error: 'Error al procesar la transcripción' });
    }
});