require("dotenv").config();
const express = require("express");
const app = express();
const https = require("https");
const http = require("http");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

app.use((req, res, next) => {
  if (req.secure) {
    // Request was via https
    next();
  } else {
    // Request was via http, so redirect
    res.redirect("https://" + req.headers.host + req.url);
  }
});

// Static files
app.use("/", express.static(__dirname + "/public"));

// Remove uploads older than 24 hours
function checkUploadDate(next) {
  fs.readdir("./public/uploads", (err, files) => {
    files.forEach((file) => {
      if (
        fs.statSync(`./public/uploads/${file}`).birthtimeMs <=
        Date.now() - 86400000
      ) {
        // 24 hours in milliseconds
        fs.unlink(`./public/uploads/${file}`, (err) => {
          console.log(`${file} removed`);
          if (err) console.error(err);
        });
      }
    });
  });
}

// Multer middleware for upload dest & file checking
const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (req, file, callback) => {
    callback(null, Date.now() + path.extname(file.originalname));
  },
});

const videoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 1073741825, // 1 Gig
  },
  fileFilter: async (req, file, cb) => {
    if (file.mimetype == "video/mp4") {
      cb(null, true);
    } else {
      console.log(file.mimetype);
      cb(new Error("Wrong mimetype!"), false);
    }
  },
});

// EJS
app.set("view engine", "ejs");

// -------- ROUTES --------

// Homepage
app.get("", (req, res) => {
  res.sendFile("/index.html", { root: __dirname });
});

// Upload files
app.post("/upload", videoUpload.single("video-upload"), async (req, res) => {
  checkUploadDate(); // Remove old uploads

  let uploadId = JSON.stringify(req.file.filename);
  uploadId = uploadId.slice(1, uploadId.length - 5);

  res.redirect(`/watch/${uploadId}`);
});

// Render watch page with upload data
app.get("/watch/:id", (req, res) => {
  res.render("watch", { data: { id: req.params.id } });
});

// Stream upload
app.get("/stream/:id", (req, res) => {
  res.sendFile(`/public/uploads/${req.params.id}.mp4`, { root: __dirname });
});

// 404
app.use("*", (req, res) => {
  res.sendFile("/public/404.html", { root: __dirname });
});

// -------- SERVERS & SSL --------

const port = process.env.PORT || 80;

const httpsOptions = {
  cert: fs.readFileSync(path.join(__dirname, "ssl", "cert.pem")),
  key: fs.readFileSync(path.join(__dirname, "ssl", "private.pem")),
};

// Secure server
https.createServer(httpsOptions, app).listen(port, () => {
  console.log(`https server started on port ${port} 🚀`);
});

// To catch non-https connections
http
  .createServer((req, res) => {
    res.writeHead(301, {
      Location: "https://" + req.headers["host"] + req.url,
    });
    res.end();
  })
  .listen(80, () => {
    console.log("http server started on port 80 ✅");
  });
