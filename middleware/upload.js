import multer from 'multer';

// Configure multer for memory storage (files stored in buffer)
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
};

// Configure multer with file size limit
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 8 * 1024 * 1024, // 8MB limit
    }
});
