const jwt = require('jsonwebtoken')
const pool = require('../db')

// JWT密钥，实际项目中应该放在环境变量中
const JWT_SECRET =  process.env.JWT_SECRET

const authMiddleware = async (req, res, next) => {
    try {
        // 从请求头获取token
        const authHeader = req.headers.authorization
        // console.log(authHeader);
        
        if (!authHeader) {
            return res.json({
                code: 401,
                message: '未登录',
                data: null
            })
        }

        const token = authHeader.split(' ')[1] // Bearer token
        // console.log(token);
        
        if (!token) {
            return res.json({
                code: 401,
                message: '无效的token',
                data: null
            })
        }

        try {
            // 验证token
            const decoded = jwt.verify(token, JWT_SECRET)
            // console.log(decoded);
            // 从数据库验证用户是否存在
            const [users] = await pool.query(
                'SELECT id, username FROM users WHERE id = ?',
                [decoded.userId]
            )
            console.log(users);
            
            if (users.length === 0) {
                return res.json({
                    code: 401,
                    message: '用户不存在',
                    data: null
                })
            }

            // 将用户信息添加到请求对象中
            req.auth = {
                id: users[0].id,
                username: users[0].username
            }

            next()
        } catch (err) {
            // token验证失败
            return res.json({
                code: 401,
                message: '登录已过期，请重新登录',
                data: null
            })
        }
    } catch (err) {
        console.error('Auth middleware error:', err)
        return res.json({
            code: 500,
            message: '服务器内部错误',
            data: null
        })
    }
}

// 生成token的工具函数
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: '7d' } // token有效期为7天
    )
}

module.exports = {
    authMiddleware,
    generateToken
}