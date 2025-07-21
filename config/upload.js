const path = require('path');

// 上传配置
const UPLOAD_CONFIG = {
  // 视频配置
  video: {
    folder: path.join(__dirname, '../videos'),
    allowedTypes: ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv'],
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    maxFiles: 10, // 单次最多上传10个文件
    chunkSize: 2 * 1024 * 1024, // 2MB 分片大小
    enableChunking: true, // 启用分片上传
    chunkRetryTimes: 3, // 分片上传重试次数
    chunkTimeout: 30000 // 分片上传超时时间(ms)
  },
  
  // 图片配置
  image: {
    folder: path.join(__dirname, '../images'),
    allowedTypes: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 20, // 单次最多上传20个文件
    chunkSize: 512 * 1024, // 512KB 分片大小
    enableChunking: false, // 图片通常不需要分片
    chunkRetryTimes: 3,
    chunkTimeout: 15000
  },
  
  // 通用配置
  general: {
    tempFolder: path.join(__dirname, '../temp'),
    enableCompression: true,
    compressionLevel: 6,
    enableResize: false, // 是否启用图片压缩
    resizeOptions: {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8
    },
    // 分片上传配置
    chunking: {
      defaultChunkSize: 1024 * 1024, // 1MB 默认分片大小
      maxConcurrentChunks: 3, // 最大并发分片数
      chunkExpireTime: 24 * 60 * 60 * 1000, // 分片过期时间(24小时)
      enableResume: true, // 启用断点续传
      enableVerification: true // 启用分片校验
    }
  }
};

// 文件类型映射
const MIME_TYPES = {
  // 视频类型
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.flv': 'video/x-flv',
  
  // 图片类型
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff'
};

// 验证配置
const validateConfig = () => {
  const errors = [];
  
  // 检查必要的目录
  Object.keys(UPLOAD_CONFIG).forEach(key => {
    if (key !== 'general') {
      const config = UPLOAD_CONFIG[key];
      if (!config.folder) {
        errors.push(`${key} 配置缺少 folder 属性`);
      }
      if (!config.allowedTypes || !Array.isArray(config.allowedTypes)) {
        errors.push(`${key} 配置缺少 allowedTypes 数组`);
      }
      if (!config.maxSize || config.maxSize <= 0) {
        errors.push(`${key} 配置缺少有效的 maxSize`);
      }
      if (!config.chunkSize || config.chunkSize <= 0) {
        errors.push(`${key} 配置缺少有效的 chunkSize`);
      }
    }
  });
  
  if (errors.length > 0) {
    throw new Error('上传配置验证失败: ' + errors.join(', '));
  }
};

// 获取文件类型配置
const getFileTypeConfig = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  for (const [type, config] of Object.entries(UPLOAD_CONFIG)) {
    if (type !== 'general' && config.allowedTypes.includes(ext)) {
      return { type, config, mimeType: MIME_TYPES[ext] };
    }
  }
  
  return null;
};

// 获取MIME类型
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
};

// 计算分片数量
const calculateChunks = (fileSize, chunkSize) => {
  return Math.ceil(fileSize / chunkSize);
};

// 获取推荐的分片大小
const getRecommendedChunkSize = (fileSize, fileType) => {
  const config = UPLOAD_CONFIG[fileType];
  if (!config) return UPLOAD_CONFIG.general.chunking.defaultChunkSize;
  
  // 根据文件大小动态调整分片大小
  if (fileSize > 1024 * 1024 * 1024) { // 大于1GB
    return 5 * 1024 * 1024; // 5MB
  } else if (fileSize > 100 * 1024 * 1024) { // 大于100MB
    return 2 * 1024 * 1024; // 2MB
  } else if (fileSize > 10 * 1024 * 1024) { // 大于10MB
    return 1024 * 1024; // 1MB
  } else {
    return config.chunkSize;
  }
};

// 检查是否需要分片上传
const needsChunking = (fileSize, fileType) => {
  const config = UPLOAD_CONFIG[fileType];
  if (!config || !config.enableChunking) return false;
  
  // 如果文件大小超过分片大小的2倍，建议使用分片上传
  return fileSize > config.chunkSize * 2;
};

module.exports = {
  UPLOAD_CONFIG,
  MIME_TYPES,
  validateConfig,
  getFileTypeConfig,
  getMimeType,
  calculateChunks,
  getRecommendedChunkSize,
  needsChunking
}; 