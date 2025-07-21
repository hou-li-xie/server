const express = require("express");
const connection = require("../sql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = "your_jwt_secret_key"; // 建议放到环境变量

// 注册接口

// Promise 包装的 bcrypt 函数
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 1, msg: "用户名和密码不能为空" });
  }
  const hashedPassword = await hashPassword(password);
  const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
  const created_at = new Date().toLocaleString();
  // 检查用户名是否已存在
  connection.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) {
        return res.status(500).json({ code: 2, msg: "数据库错误", error: err });
      }
      if (results.length > 0) {
        return res.status(409).json({ code: 3, msg: "用户名已存在" });
      }

      // 插入新用户
      connection.query(
        "INSERT INTO users (username, password,avatar,created_at) VALUES (?, ?,?,?)",
        [username, hashedPassword, avatar, created_at],
        (err, result) => {
          if (err) {
            return res
              .status(500)
              .json({ code: 4, msg: "注册失败", error: err });
          }
          res.json({ code: 0, msg: "注册成功", userId: result.insertId });
        }
      );
    }
  );
});

// 登录接口
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 1, msg: "用户名和密码不能为空" });
  }
  connection.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) {
        return res.status(500).json({ code: 2, msg: "数据库错误", error: err });
      }
      if (results.length === 0) {
        return res.status(404).json({ code: 3, msg: "用户不存在" });
      }
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ code: 4, msg: "密码错误" });
      }
      // 生成token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({ code: 0, msg: "登录成功", token, user: { id: user.id, username: user.username, avatar: user.avatar } });
    }
  );
});

// 获取用户信息接口
router.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ code: 1, msg: '用户ID不能为空' });
  }
  const menus=['user']
  connection.query(
    'SELECT id, username, avatar, created_at FROM users WHERE id = ?',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ code: 2, msg: '数据库错误', error: err });
      }
      if (results.length === 0) {
        return res.status(404).json({ code: 3, msg: '用户不存在' });
      }
      res.json({ code: 0, msg: '获取成功', data: results[0],roles:{menus} });
    }
  );
});

// 获取所有用户接口
router.get('/users', (req, res) => {
  connection.query(
    'SELECT id, username, avatar, created_at FROM users ORDER BY created_at DESC',
    (err, results) => {
      if (err) {
        return res.status(500).json({ code: 1, msg: '数据库错误', error: err });
      }
      res.json({ code: 0, msg: '获取成功', data: results });
    }
  );
});

// 编辑用户接口
router.put('/user/:id', async (req, res) => {
  const userId = req.params.id;
  const { username, password, avatar } = req.body;
  
  if (!userId) {
    return res.status(400).json({ code: 1, msg: '用户ID不能为空' });
  }
  
  // 检查用户是否存在
  connection.query(
    'SELECT * FROM users WHERE id = ?',
    [userId],
    async (err, results) => {
      if (err) {
        return res.status(500).json({ code: 2, msg: '数据库错误', error: err });
      }
      if (results.length === 0) {
        return res.status(404).json({ code: 3, msg: '用户不存在' });
      }
      
      const user = results[0];
      let updateFields = [];
      let updateValues = [];
      
      // 构建更新字段
      if (username && username !== user.username) {
        // 检查新用户名是否已被其他用户使用
        connection.query(
          'SELECT * FROM users WHERE username = ? AND id != ?',
          [username, userId],
          async (err, usernameResults) => {
            if (err) {
              return res.status(500).json({ code: 4, msg: '数据库错误', error: err });
            }
            if (usernameResults.length > 0) {
              return res.status(409).json({ code: 5, msg: '用户名已被其他用户使用' });
            }
            
            // 继续更新逻辑
            await performUpdate();
          }
        );
        return;
      }
      
      // 如果没有用户名冲突，直接执行更新
      await performUpdate();
      
      async function performUpdate() {
        if (username) {
          updateFields.push('username = ?');
          updateValues.push(username);
        }
        
        if (password) {
          const hashedPassword = await hashPassword(password);
          updateFields.push('password = ?');
          updateValues.push(hashedPassword);
        }
        
        if (avatar) {
          updateFields.push('avatar = ?');
          updateValues.push(avatar);
        }
        
        // 自动更新时间字段
        const now = new Date();
        const pad = n => n < 10 ? '0' + n : n;
        const formattedTime = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        updateFields.push('created_at = ?');
        updateValues.push(formattedTime);
        
        if (updateFields.length === 0) {
          return res.status(400).json({ code: 6, msg: '没有提供要更新的字段' });
        }
        
        updateValues.push(userId);
        
        const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        
        connection.query(updateQuery, updateValues, (err, result) => {
          if (err) {
            return res.status(500).json({ code: 7, msg: '更新失败', error: err });
          }
          res.json({ code: 0, msg: '更新成功' });
        });
      }
    }
  );
});

// 删除用户接口
router.delete('/user/:id', (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ code: 1, msg: '用户ID不能为空' });
  }
  // 先查找用户信息
  connection.query(
    'SELECT username FROM users WHERE id = ?',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ code: 2, msg: '数据库错误', error: err });
      }
      if (results.length === 0) {
        return res.status(404).json({ code: 3, msg: '用户不存在' });
      }
      if (results[0].username === '超级管理员') {
        return res.status(403).json({ code: 4, msg: '超级管理员账号不可删除' });
      }
      // 可以删除
      connection.query(
        'DELETE FROM users WHERE id = ?',
        [userId],
        (err, result) => {
          if (err) {
            return res.status(500).json({ code: 5, msg: '数据库错误', error: err });
          }
          res.json({ code: 0, msg: '删除成功' });
        }
      );
    }
  );
});

module.exports = router;
