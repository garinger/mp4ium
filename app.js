require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const uploadModel = require('./models/uploadModel.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Static files
app.use('/public', express.static(__dirname + "/public"))

// Database
mongoose.connect(process.env.DATABASE_URL, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;
db.on('error', (error) => console.error(error));
db.once('open', () => console.log('Connected to database'));

// Remove uploads older than 24 hours
function checkUploadDate (next) {
    fs.readdir('./public/uploads', (err, files) => {
        files.forEach(file => {
            if (fs.statSync(`./public/uploads/${file}`).birthtimeMs <= Date.now() - 86400000) { // 24 hours in milliseconds
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
    destination: 'public/uploads',
    filename: (req, file, callback) => {
        callback(null, Date.now() + path.extname(file.originalname));
    }
});

const videoUpload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1073741825 // Gig?
    },
    fileFilter: async (req, file, cb) => {
        if (file.mimetype == 'video/mp4') {
            cb(null, true);
        } else {
            console.log(file.mimetype);
            cb(new Error('Wrong mimetype!'), false);
        }
    }  
});

// EJS
app.set('view engine', 'ejs');

// -------- ROUTES --------

// Homepage
app.get('', (req, res) => {
    
    res.sendFile('/index.html', {root: __dirname});
});

// Upload files
app.post('/upload', videoUpload.single('video-upload'), async (req, res) => {    

    checkUploadDate(); // Remove old uploads

    // Set database inputs
    const uploadData = new uploadModel({
        fileName: req.file.originalname,
    });

    try{
        const newUpload = await uploadData.save(); // Saving to database
    } catch (err) {
        res.status(400).json({ message: err.message });
    }

    let uploadId = JSON.stringify(req.file.filename);
    uploadId = uploadId.slice(1, uploadId.length - 5);

    res.redirect(`/watch/${uploadId}`);
});

// Render watch page with upload data
app.get('/watch/:id', (req, res) => {

    res.render('watch', {data: {id: req.params.id}});
});

// Stream upload
app.get('/stream/:id', (req, res) => {

    res.sendFile(`/public/uploads/${req.params.id}.mp4`, {root: __dirname});

});

// 404
app.use("*", (req, res) => {
    res.sendFile('/404.html', {root: __dirname});
});

// PORT
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port: ${port}.`));