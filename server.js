const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const uploads = path.join(__dirname, "uploads");
const outputs = path.join(__dirname, "outputs");

if (!fs.existsSync(uploads)) fs.mkdirSync(uploads);
if (!fs.existsSync(outputs)) fs.mkdirSync(outputs);

const upload = multer({
    dest: uploads
});

app.get("/", (req, res) => {
    res.json({
        status: "online",
        app: "PREGA.CUT Backend"
    });
});

app.post("/api/upload", upload.single("video"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: "Nenhum vídeo enviado."
        });
    }

    res.json({
        success: true,
        message: "Vídeo recebido.",
        file: req.file.filename,
        originalName: req.file.originalname
    });
});

app.post("/api/test", (req, res) => {

    res.json({
        success: true,
        message: "Backend PREGA.CUT funcionando."
    });

});

app.listen(PORT, () => {
    console.log(`PREGA.CUT Backend rodando na porta ${PORT}`);
});
