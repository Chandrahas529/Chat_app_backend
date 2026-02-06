const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists
const dir = './uploads';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Temp folder
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({ storage: storage }).single('profile_image');

module.exports = upload;
