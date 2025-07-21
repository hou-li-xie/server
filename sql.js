const mysql = require("mysql2");

// 创建数据库连接
const connection = mysql.createConnection({
  host: "localhost", // 主机地址
  user: "root", // 用户名
  password: "123456", // 密码
  port: 3306, // 端口号，默认为 3306
  database: "demo", // 数据库名称
  charset: "UTF8_GENERAL_CI", // 连接字符集，默认为 UTF8_GENERAL_CI
  connectTimeout: 10000, // 连接超时时间，单位为毫秒
  multipleStatements: false // 是否允许一个 query 中有多个 MySQL 语句，默认为 false
});

// 连接到数据库
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to database");
});

// 连接关闭和错误事件监听
connection.on("end", () => {
  console.log("Database connection closed");
});

connection.on("error", (err) => {
  console.error("Database error:", err);
});

module.exports = connection;
