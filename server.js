const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:8000',  // Live Server typical port
    'http://127.0.0.1:5500', 
    'http://localhost:3000',
    'https://your-production-domain.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
  
};
app.use(cors(corsOptions));

// File size and type validation
const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 
  'image/png', 
  'image/gif', 
  'image/webp',
  'video/mp4', 
  'video/mpeg', 
  'video/quicktime'
];

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const fileType = file.mimetype.split('/')[0]; // 'image' or 'video'
    const fileExtension = path.extname(file.originalname);
    const uniqueSuffix = `${fileType}_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${fileExtension}`);
  }
});

// File filter for upload validation
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: FILE_SIZE_LIMIT 
  },
  fileFilter: fileFilter
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Prevent directory listing
    res.set('X-Content-Type-Options', 'nosniff');
  }
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Handle file uploads with enhanced error handling
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was uploaded or file type is not allowed'
      });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: `http://localhost:${port}/uploads/${req.file.filename}`,
      type: req.file.mimetype.split('/')[0] // 'image' or 'video'
    };
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    error: err.message
  });
});

// Periodic cleanup of old uploads
const UPLOAD_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(() => {
  const uploadsDir = path.join(__dirname, 'uploads');
  const now = Date.now();

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('Error reading uploads directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('Error getting file stats:', err);
          return;
        }

        // Delete files older than 24 hours
        if (now - stats.birthtimeMs > UPLOAD_CLEANUP_INTERVAL) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error('Error deleting old file:', err);
            } else {
              console.log(`Deleted old file: ${file}`);
            }
          });
        }
      });
    });
  });
}, UPLOAD_CLEANUP_INTERVAL);

// Start server
app.listen(port, () => {
  console.log(`Local upload server running at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});