require("dotenv/config");

const path = require("path")
const cors = require('cors');
const http = require('http');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
var gtts = require('node-gtts');
const multer = require('multer');
const OpenAI=require("openai")
const socketIO = require('socket.io');

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
    const clientId = socket.handshake.query.clientId; // Obtener el ID único desde la consulta de conexión
    console.log('Un cliente se ha conectado con el ID: ' + clientId);

    socket.join(clientId)

    console.log("Socket Connected: " + clientId);
    socket.emit("onConnected", { id: clientId });
    // socket.join(clientId);   

    socket.on('disconnect', () => {
        console.log('disconnectClient: ' + clientId);
        socket.leave(clientId);
    });

    socket.on("ping", function (args) {  
        if (args.id)
        console.log("Ping Received from ID: " + args.id)
    });
});


// OpenAI
const openai= new OpenAI({
    apiKey: process.env.OPENAI_API
}) 

// Speech
app.post('/speech', function(req, res) {
    // res.set({'Content-Type': 'audio/wav'});
    // gtts.stream("Hola pepe").pipe(res);
    const textToSave = req.body.textMsg;
    const clientId = req.body.clientId;

    var filepath = path.join(__dirname, "/public/recordings/" + clientId + '_response.wav');

    console.log("textToSave: " + textToSave);
    gtts.save(filepath, textToSave, function () {
        console.log("Saved");
        res.send({file: 'test.wav'});
    });

    // res.send();
});


// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload Audio File
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
    const clientId = req.body.clientId;
    fs.writeFileSync("public/recordings/" + clientId + '_recording.wav', req.file.buffer);
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream("public/recordings/" + clientId + '_recording.wav'),
            model: "whisper-1",
            language: "es"
        });
        console.log(transcription.text);
        io.to(clientId).emit("text-send", {text: transcription.text});

        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{"role": "user", "content": transcription.text}],
        });
        console.log(chatCompletion.choices[0].message);        
        io.to(clientId).emit("text-received", {text: chatCompletion.choices[0].message});

        // res.json({ transcription: transcription.text });
    } catch (error) {
        console.error('Error al procesar la transcripción:', error);
        res.status(500).json({ error: 'Error al procesar la transcripción' });
    }
});
