const express = require("express");
const userRouter = require("./router/user");
const menuRouter = require("./router/menu");
const app = express();
const PORT =3000;
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const uploadRouter = require('./router/upload');
const toolsRouter = require('./router/tools');

// 使用绝对路径确保稳定性
const VIDEO_FOLDER = path.resolve(__dirname, "videos");
const IMAGE_FOLDER = path.resolve(__dirname, "images");

// 启用 CORS 支持
app.use(cors());

// 设置请求超时时间（10分钟）
app.use((req, res, next) => {
  req.setTimeout(600000); // 10分钟
  res.setTimeout(600000); // 10分钟
  next();
});

// 增加请求体大小限制
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 视频流接口
app.get("/api/video/:filename", (req, res) => {
  try {
    // 解码文件名（处理特殊字符）
    const filename = decodeURIComponent(req.params.filename);

    // 安全处理：防止路径遍历攻击
    const safeFilename = filename.replace(/\.\.\//g, "").replace(/\//g, "");

    const videoPath = path.join(VIDEO_FOLDER, safeFilename);

    console.log(`请求视频: ${videoPath}`);

    // 验证文件是否存在
    if (!fs.existsSync(videoPath)) {
      console.error(`文件不存在: ${videoPath}`);
      return res.status(404).json({ error: "视频未找到" });
    }

    // 验证是否是文件
    const stats = fs.statSync(videoPath);
    if (!stats.isFile()) {
      console.error(`路径不是文件: ${videoPath}`);
      return res.status(400).json({ error: "请求的不是有效视频文件" });
    }

    // 获取文件大小
    const fileSize = stats.size;
    const range = req.headers.range;

    // 设置响应头
    const headers = {
      "Content-Type": getContentType(videoPath),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000", // 1年缓存
      Connection: "keep-alive",
    };

    // 处理范围请求（支持视频跳转）
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunkSize = end - start + 1;

      headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
      headers["Content-Length"] = chunkSize;

      res.writeHead(206, headers);
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      headers["Content-Length"] = fileSize;
      res.writeHead(200, headers);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err) {
    console.error("视频流错误:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// 获取视频列表接口
app.get("/api/videos", (req, res) => {
  try {
    const files = fs
      .readdirSync(VIDEO_FOLDER)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".mp4", ".webm", ".ogg", ".mov", ".avi"].includes(ext);
      })
      .map((file) => ({
        name: file,
        url: `/api/video/${encodeURIComponent(file)}`,
        size: fs.statSync(path.join(VIDEO_FOLDER, file)).size,
      }));

    res.json(files);
  } catch (err) {
    console.error("获取视频列表错误:", err);
    res.status(500).json({ error: "无法读取视频目录" });
  }
});

// 图片流接口
app.get("/api/image/:filename", (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const safeFilename = filename.replace(/\.\.\/|\//g, "");
    const imagePath = path.join(IMAGE_FOLDER, safeFilename);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: "图片未找到" });
    }
    const stats = fs.statSync(imagePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: "请求的不是有效图片文件" });
    }
    const fileSize = stats.size;
    const range = req.headers.range;
    const headers = {
      "Content-Type": getImageContentType(imagePath),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000",
      Connection: "keep-alive",
    };
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
      headers["Content-Length"] = chunkSize;
      res.writeHead(206, headers);
      fs.createReadStream(imagePath, { start, end }).pipe(res);
    } else {
      headers["Content-Length"] = fileSize;
      res.writeHead(200, headers);
      fs.createReadStream(imagePath).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: "服务器内部错误" });
  }
});
// 获取图片列表接口
app.get("/api/images", (req, res) => {
  try {
    const files = fs
      .readdirSync(IMAGE_FOLDER)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [
          ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"
        ].includes(ext);
      })
      .map((file) => ({
        name: file,
        url: `/api/image/${encodeURIComponent(file)}`,
        size: fs.statSync(path.join(IMAGE_FOLDER, file)).size,
      }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "无法读取图片目录" });
  }
});
// 获取视频内容类型
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
  };
  return types[ext] || "application/octet-stream";
}
// 获取图片内容类型
function getImageContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return types[ext] || "application/octet-stream";
}

app.use("/", userRouter);
app.use("/menu", menuRouter);
app.use('/api', uploadRouter);
app.use('/tools', toolsRouter);

// 设置服务器超时时间
const server = app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);

  // 确保视频目录存在
  if (!fs.existsSync(VIDEO_FOLDER)) {
    fs.mkdirSync(VIDEO_FOLDER, { recursive: true });
    console.log(`已创建视频目录: ${VIDEO_FOLDER}`);
  }

  // 确保图片目录存在
  if (!fs.existsSync(IMAGE_FOLDER)) {
    fs.mkdirSync(IMAGE_FOLDER, { recursive: true });
    console.log(`已创建图片目录: ${IMAGE_FOLDER}`);
  }

  console.log(`视频目录: ${VIDEO_FOLDER}`);
  console.log(`图片目录: ${IMAGE_FOLDER}`);
  console.log(`视频流接口: http://localhost:${PORT}/api/video/{filename}`);
  console.log(`视频列表接口: http://localhost:${PORT}/api/videos`);
  console.log(`图片流接口: http://localhost:${PORT}/api/image/{filename}`);
});

// 设置服务器超时时间
server.timeout = 600000; // 10分钟
server.keepAliveTimeout = 65000; // 65秒
server.headersTimeout = 66000; // 66秒
