const express = require("express");
const cors = require("cors");
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.raw({ limit: '50mb' }));

// 响应处理中间件
const responseHandler = (req, res, next) => {
    res.success = (data = null, message = "操作成功") => {
        res.json({
            code: 0,
            message,
            data
        });
    };

    res.error = (message = "操作失败", code = 1) => {
        res.json({
            code,
            message,
            data: null
        });
    };

    next();
};

app.use(responseHandler);

// 路由
app.use('/user', require('./routes/user'));
app.use('/menu', require('./routes/menu'));
app.use('/weather', require('./routes/weather'));
app.use('/work-hours', require('./routes/workHours'));

// 错误处理
app.use((err, req, res, next) => {
    console.error('错误:', err);
    res.error(err.message || "服务器内部错误");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器启动在端口 ${PORT}`);
});
