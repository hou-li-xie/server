const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getMimeType, UPLOAD_CONFIG } = require('../config/upload');
const FileUtils = require('../utils/fileUtils');

// 工具函数：分目录
const getTargetDir = (fileType) => {
  if (fileType === 'video') return path.join(__dirname, '../videos');
  if (fileType === 'image') return path.join(__dirname, '../images');
  throw new Error('不支持的文件类型');
};
const getTempDir = (fileType) => {
  if (fileType === 'video') return path.join(__dirname, '../videos/temp');
  if (fileType === 'image') return path.join(__dirname, '../images/temp');
  throw new Error('不支持的文件类型');
};

// 自动分目录存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = '';
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff"].includes(ext)) {
      folder = path.join(__dirname, '../images');
    } else if ([".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".flv"].includes(ext)) {
      folder = path.join(__dirname, '../videos');
    } else {
      return cb(new Error('不支持的文件类型: ' + file.originalname));
    }
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const unique = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    cb(null, `${basename}_${unique}${ext}`);
  }
});
const upload = multer({ storage });

// 分片上传存储
const chunkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { fileType } = req.body;
    const tempDir = getTempDir(fileType);
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const { fileName, chunkIndex } = req.body;
    cb(null, `${fileName}.part${chunkIndex}`);
  }
});
const chunkUpload = multer({ storage: chunkStorage });

// 普通/批量上传（自动分目录）
router.post('/smart-upload', upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '没有选择文件' });
  }
  const uploaded = req.files.map(file => ({
    originalName: file.originalname,
    savedName: file.filename,
    size: file.size,
    sizeFormatted: (file.size / 1024).toFixed(2) + ' KB',
    path: file.path,
    mimeType: file.mimetype,
    uploadedAt: new Date()
  }));
  res.json({
    success: true,
    uploaded,
    errors: [],
    summary: {
      total: uploaded.length,
      success: uploaded.length,
      failed: 0,
      totalSize: uploaded.reduce((sum, f) => sum + f.size, 0),
      totalSizeFormatted: (uploaded.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2) + ' KB'
    }
  });
});

// 多选上传接口（指定类型）
router.post('/multiple-upload', upload.array('files', 50), (req, res) => {
  const fileType = req.body.fileType;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '没有选择文件' });
  }
  // 校验类型
  const allowedExts = fileType === 'video'
    ? [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".flv"]
    : [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff"];
  const uploaded = [];
  const errors = [];
  req.files.forEach(file => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      errors.push({ filename: file.originalname, error: '文件类型不匹配' });
      // 删除不合规文件
      fs.unlinkSync(file.path);
      return;
    }
    uploaded.push({
      originalName: file.originalname,
      savedName: file.filename,
      size: file.size,
      sizeFormatted: (file.size / 1024).toFixed(2) + ' KB',
      path: file.path,
      mimeType: file.mimetype,
      uploadedAt: new Date()
    });
  });
  res.json({
    success: errors.length === 0,
    uploaded,
    errors,
    summary: {
      total: req.files.length,
      success: uploaded.length,
      failed: errors.length,
      totalSize: uploaded.reduce((sum, f) => sum + f.size, 0),
      totalSizeFormatted: (uploaded.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2) + ' KB'
    }
  });
});

// 分片上传接口
router.post('/chunk-upload', chunkUpload.single('chunk'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有接收到分片文件' });
  }
  res.json({
    success: true,
    fileName: req.body.fileName,
    chunkIndex: req.body.chunkIndex,
    path: req.file.path
  });
});

// 合并分片接口
router.post('/merge-chunks', express.json(), async (req, res) => {
  const { fileType, fileName, totalChunks } = req.body;
  if (!fileType || !fileName || !totalChunks) {
    return res.status(400).json({ error: '缺少参数' });
  }
  const tempDir = getTempDir(fileType);
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const targetDir = getTargetDir(fileType);
  fs.mkdirSync(targetDir, { recursive: true });
  const unique = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  const finalName = `${base}_${unique}${ext}`;
  const finalPath = path.join(targetDir, finalName);

  const writeStream = fs.createWriteStream(finalPath);
  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `${fileName}.part${i}`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`缺少分片: ${chunkPath}`);
      }
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
      fs.unlinkSync(chunkPath);
    }
    writeStream.end();
    writeStream.on('finish', () => {
      res.json({
        success: true,
        fileName: finalName,
        path: finalPath
      });
    });
  } catch (err) {
    writeStream.end();
    res.status(500).json({ error: '合并分片失败', detail: err.message });
  }
});

// 获取上传配置接口
router.get('/config', (req, res) => {
  const config = {};
  Object.keys(UPLOAD_CONFIG).forEach(key => {
    if (key !== 'general') {
      config[key] = {
        allowedTypes: UPLOAD_CONFIG[key].allowedTypes,
        maxSize: UPLOAD_CONFIG[key].maxSize,
        maxSizeFormatted: FileUtils.formatFileSize(UPLOAD_CONFIG[key].maxSize),
        maxFiles: UPLOAD_CONFIG[key].maxFiles,
        chunkSize: UPLOAD_CONFIG[key].chunkSize,
        chunkSizeFormatted: FileUtils.formatFileSize(UPLOAD_CONFIG[key].chunkSize),
        folder: UPLOAD_CONFIG[key].folder
      };
    }
  });
  res.json(config);
});

// 获取磁盘空间信息
router.get('/disk-info', (req, res) => {
  try {
    const diskInfo = {};
    Object.keys(UPLOAD_CONFIG).forEach(key => {
      if (key !== 'general') {
        const folder = UPLOAD_CONFIG[key].folder;
        diskInfo[key] = FileUtils.checkDiskSpace(folder);
      }
    });
    res.json(diskInfo);
  } catch (err) {
    console.error('获取磁盘信息失败:', err);
    res.status(500).json({ error: '获取磁盘信息失败' });
  }
});

module.exports = router; 