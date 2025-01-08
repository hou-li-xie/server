const mysql = require('mysql2');
require('dotenv').config();

// 创建连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_NAME || 'demo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise(); // 使用 promise 包装

// 测试连接池
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('数据库连接池初始化成功！');
        connection.release();
    } catch (err) {
        console.error('数据库连接池初始化失败:', err);
    }
}

testConnection();

// 处理连接池错误
pool.on('error', (err) => {
    console.error('连接池错误:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('与数据库的连接丢失');
    }
});

module.exports = pool;