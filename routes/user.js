const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

// 用户名和密码的验证规则
const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
};

const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/;
    return passwordRegex.test(password);
};

// Promise 包装的 bcrypt 函数
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

// 注册接口
router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    console.log("注册请求:", username);

    try {
        if (!username || !password) {
            return res.error("用户名和密码不能为空");
        }

        // if (!validateUsername(username)) {
        //     return res.error("用户名只能包含字母、数字和下划线，长度3-20位");
        // }

        if (!validatePassword(password)) {
            return res.error("密码必须包含字母和数字，长度6-20位");
        }

        const [existingUsers] = await pool.query(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );

        if (existingUsers.length > 0) {
            return res.error("用户名已存在");
        }

        const hashedPassword = await hashPassword(password);
        const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;

        const [result] = await pool.query(
            "INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)",
            [username, hashedPassword, avatar]
        );

        res.success({
            user: {
                id: result.insertId,
                username: username,
                avatar: avatar,
            }
        }, "注册成功");
    } catch (err) {
        res.error("注册失败");
    }
});

// 登录接口
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    console.log("登录请求:", username);

    try {
        if (!username || !password) {
            return res.error("用户名和密码不能为空");
        }

        const [users] = await pool.query(
            "SELECT * FROM users WHERE username = ?",
            [username]
        );

        if (users.length === 0 || !(await bcrypt.compare(password, users[0].password))) {
            return res.error("用户名或密码错误");
        }

        const token = jwt.sign(
            {
                username: username,
                userId: users[0].id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.success({
            token,
            user: {
                id: users[0].id,
                username: users[0].username,
                avatar: users[0].avatar
            }
        }, "登录成功");
    } catch (err) {
        res.error("登录失败");
    }
});

// 获取用户信息
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, username, avatar, created_at FROM users WHERE id = ?',
            [req.auth.id]
        );

        if (users.length === 0) {
            return res.error("用户不存在");
        }

        res.success({
            user: {
                id: users[0].id,
                username: users[0].username,
                avatar: users[0].avatar,
                created_at: users[0].created_at
            }
        }, "获取用户信息成功");
    } catch (err) {
        console.error(err);
        res.error("获取用户信息失败");
    }
});

// 更新头像
router.put('/avatar', authMiddleware, async (req, res) => {
    const { avatar } = req.body;
    const userId = req.auth.id;

    try {
        if (!avatar || !avatar.startsWith('data:image/')) {
            return res.error('无效的图片格式');
        }

        const [result] = await pool.query(
            'UPDATE users SET avatar = ? WHERE id = ?',
            [avatar, userId]
        );

        if (result.affectedRows === 0) {
            return res.error('用户不存在');
        }

        const [users] = await pool.query(
            'SELECT id, username, avatar FROM users WHERE id = ?',
            [userId]
        );

        res.success({
            user: users[0]
        }, '头像更新成功');
    } catch (err) {
        res.error('更新头像失败');
    }
});

module.exports = router; 