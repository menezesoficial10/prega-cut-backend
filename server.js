const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "outputs");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.use("/outputs", express.static(OUTPUT_DIR));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },

    filename: function (req, file, cb) {
        const extension =
            path.extname(file.originalname) || ".mp4";

        const filename =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 9) +
            extension;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {
        const allowed = [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-msvideo",
            "video/x-matroska"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Formato de vídeo não permitido."
                )
            );
        }
    }
});


/* =========================
   TESTE
========================= */

app.get("/", function (req, res) {
    res.json({
        status: "online",
        service: "PREGA.CUT Backend",
        version: "1.0.0"
    });
});


/* =========================
   PROCESSAMENTO
========================= */

app.post(
    "/api/process",
    upload.single("video"),
    function (req, res) {

        if (!req.file) {
            return res.status(400).json({
                error: "Nenhum vídeo foi enviado."
            });
        }

        const input = req.file.path;

        const title =
            req.body.title ||
            "Minha Pregação";

        const instagram =
            req.body.instagram ||
            "";

        const max90 =
            req.body.max90 !== "false";

        const removePauses =
            req.body.removePauses === "true";

        const faceTracking =
            req.body.faceTracking === "true";

        const captions =
            req.body.captions === "true";

        console.log("Vídeo recebido:");
        console.log(req.file.originalname);

        console.log("Configurações:");
        console.log({
            title,
            instagram,
            max90,
            removePauses,
            faceTracking,
            captions
        });


        /*
         * PRIMEIRA VERSÃO
         *
         * Vamos gerar 3 cortes reais.
         *
         * Depois substituímos essa lógica
         * pela análise inteligente da pregação.
         */

        const clips = [
            {
                number: 1,
                start: 0,
                duration: 30
            },
            {
                number: 2,
                start: 30,
                duration: 30
            },
            {
                number: 3,
                start: 60,
                duration: 30
            }
        ];


        const jobId =
            Date.now().toString();

        const jobDir =
            path.join(
                OUTPUT_DIR,
                jobId
            );

        fs.mkdirSync(jobDir, {
            recursive: true
        });


        processClips(
            input,
            clips,
            jobDir,
            instagram,
            function (error, results) {

                /*
                 * Remove vídeo original
                 * depois do processamento.
                 */

                fs.unlink(
                    input,
                    function () {}
                );


                if (error) {

                    console.error(error);

                    return res.status(500).json({
                        error:
                            "Erro ao processar o vídeo."
                    });
                }


                const baseUrl =
                    `${req.protocol}://${req.get("host")}`;


                const responseClips =
                    results.map(function (clip) {

                        return {
                            number:
                                clip.number,

                            duration:
                                clip.duration,

                            url:
                                `${baseUrl}/outputs/${jobId}/${clip.file}`
                        };

                    });


                res.json({

                    success: true,

                    jobId,

                    clips:
                        responseClips

                });

            }
        );

    }
);


/* =========================
   PROCESSAR CORTES
========================= */

function processClips(
    input,
    clips,
    outputDir,
    instagram,
    callback
) {

    const results = [];

    let index = 0;


    function next() {

        if (index >= clips.length) {

            return callback(
                null,
                results
            );

        }


        const clip =
            clips[index];

        const filename =
            `corte-${clip.number}.mp4`;

        const output =
            path.join(
                outputDir,
                filename
            );


        /*
         * Filtro vertical 9:16
         *
         * Mantém o centro do vídeo.
         */

        let videoFilter =
            "scale=1080:1920:force_original_aspect_ratio=increase," +
            "crop=1080:1920";


        /*
         * Instagram
         */

        if (instagram) {

            const safeInstagram =
                instagram
                    .replace(/'/g, "")
                    .replace(/:/g, "\\:");

            videoFilter +=
                `,drawtext=text='${safeInstagram}'` +
                ":fontcolor=white" +
                ":fontsize=42" +
                ":x=(w-text_w)/2" +
                ":y=h-120" +
                ":box=1" +
                ":boxcolor=black@0.55" +
                ":boxborderw=12";

        }


        const args = [

            "-y",

            "-ss",
            String(clip.start),

            "-i",
            input,

            "-t",
            String(clip.duration),

            "-vf",
            videoFilter,

            "-c:v",
            "libx264",

            "-preset",
            "veryfast",

            "-crf",
            "23",

            "-c:a",
            "aac",

            "-b:a",
            "128k",

            "-movflags",
            "+faststart",

            output

        ];


        console.log(
            `Processando corte ${clip.number}...`
        );


        execFile(
            "ffmpeg",
            args,
            function (error, stdout, stderr) {

                if (error) {

                    console.error(
                        stderr
                    );

                    return callback(
                        error
                    );

                }


                results.push({

                    number:
                        clip.number,

                    duration:
                        clip.duration,

                    file:
                        filename

                });


                index++;

                next();

            }
        );

    }


    next();

}


/* =========================
   ERROS
========================= */

app.use(function (
    error,
    req,
    res,
    next
) {

    console.error(error);

    res.status(500).json({

        error:
            error.message ||
            "Erro interno."

    });

});


/* =========================
   SERVER
========================= */

app.listen(
    PORT,
    function () {

        console.log(
            `PREGA.CUT Backend rodando na porta ${PORT}`
        );

    }
);
