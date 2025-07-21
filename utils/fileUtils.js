const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileUtils {
  // 确保目录存在
  static ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // 验证文件类型
  static validateFileType(filename, allowedTypes) {
    const ext = path.extname(filename).toLowerCase();
    return allowedTypes.includes(ext);
  }

  // 生成唯一文件名
  static generateUniqueFilename(originalName, prefix = '') {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const uniqueName = prefix ? `${prefix}_${name}_${timestamp}_${random}${ext}` : `${name}_${timestamp}_${random}${ext}`;
    return uniqueName;
  }

  // 格式化文件大小
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 清理临时文件
  static cleanupTempFiles(tempFiles) {
    tempFiles.forEach(tempFile => {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          console.error(`清理临时文件失败: ${tempFile}`, err);
        }
      }
    });
  }

  // 获取文件信息
  static getFileInfo(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (err) {
      return {
        exists: false,
        error: err.message
      };
    }
  }

  // 安全删除文件
  static safeDeleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
      return { success: false, error: '文件不存在' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // 复制文件
  static copyFile(sourcePath, targetPath) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(targetPath);
      
      readStream.pipe(writeStream);
      
      writeStream.on('finish', () => resolve({ success: true }));
      writeStream.on('error', (err) => reject(err));
      readStream.on('error', (err) => reject(err));
    });
  }

  // 移动文件
  static moveFile(sourcePath, targetPath) {
    return new Promise((resolve, reject) => {
      try {
        fs.renameSync(sourcePath, targetPath);
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    });
  }

  // 获取目录中的所有文件
  static getFilesInDirectory(dirPath, options = {}) {
    try {
      const files = fs.readdirSync(dirPath);
      let result = files.map(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          sizeFormatted: this.formatFileSize(stats.size),
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          created: stats.birthtime,
          modified: stats.mtime
        };
      });

      // 过滤文件类型
      if (options.allowedTypes) {
        result = result.filter(file => 
          file.isFile && this.validateFileType(file.name, options.allowedTypes)
        );
      }

      // 只返回文件
      if (options.filesOnly) {
        result = result.filter(file => file.isFile);
      }

      // 只返回目录
      if (options.directoriesOnly) {
        result = result.filter(file => file.isDirectory);
      }

      // 排序
      if (options.sortBy) {
        result.sort((a, b) => {
          switch (options.sortBy) {
            case 'name':
              return a.name.localeCompare(b.name);
            case 'size':
              return b.size - a.size;
            case 'modified':
              return b.modified - a.modified;
            default:
              return 0;
          }
        });
      }

      return result;
    } catch (err) {
      console.error(`读取目录失败: ${dirPath}`, err);
      return [];
    }
  }

  // 计算文件哈希值
  static calculateFileHash(filePath, algorithm = 'md5') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  // 检查磁盘空间
  static checkDiskSpace(dirPath) {
    try {
      const stats = fs.statfsSync(dirPath);
      const totalSpace = stats.blocks * stats.bsize;
      const freeSpace = stats.bavail * stats.bsize;
      const usedSpace = totalSpace - freeSpace;
      
      return {
        total: totalSpace,
        free: freeSpace,
        used: usedSpace,
        totalFormatted: this.formatFileSize(totalSpace),
        freeFormatted: this.formatFileSize(freeSpace),
        usedFormatted: this.formatFileSize(usedSpace),
        usagePercent: ((usedSpace / totalSpace) * 100).toFixed(2)
      };
    } catch (err) {
      console.error('检查磁盘空间失败:', err);
      return null;
    }
  }
}

module.exports = FileUtils; 