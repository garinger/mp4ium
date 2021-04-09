const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Number,
        required: true,
        default: Date.now
    }
})

module.exports = mongoose.model('Upload', uploadSchema);