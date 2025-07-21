const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');

// 终端命令执行接口（高危，仅限开发环境！）
router.post('/run-cmd', express.json(), (req, res) => {
  const { cmd } = req.body;
  if (!cmd || typeof cmd !== 'string') {
    return res.status(400).json({ error: '缺少cmd参数或类型错误' });
  }
  // 拆分命令和参数
  const parts = cmd.match(/(?:"[^"]*"|[^\s"])+/g);
  if (!parts || parts.length === 0) {
    return res.status(400).json({ error: '命令解析失败' });
  }
  const command = parts[0];
  const args = parts.slice(1);

  const child = spawn(command, args, { shell: true, encoding: 'utf-8' });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });
  child.on('close', (code) => {
    res.json({ stdout, stderr, code });
  });
  child.on('error', (err) => {
    res.status(500).json({ error: err.message, stderr });
  });
});

module.exports = router; 