// src/routes/workHours.ts
const express=require('express') 
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// 所有路由都需要认证
router.use(authMiddleware)
// 工时打卡
router.post("/punch", async (req, res) => {
    const { workDate, hours, hourlyRate, workType } = req.body;
    const userId = req.auth.id;

    try {
        if (!workDate || !hours || !hourlyRate || !workType) {
            return res.error("所有字段都不能为空");
        }

        // 检查是否已存在该日期的打卡记录
        const [existingRecord] = await pool.query(
            "SELECT id FROM work_hours WHERE user_id = ? AND work_date = ?",
            [userId, workDate]
        );

        if (existingRecord.length > 0) {
            return res.error("该日期已存在打卡记录");
        }

        // 计算收入
        const income = hours * hourlyRate;

        const [result] = await pool.query(
            `INSERT INTO work_hours 
             (user_id, work_date, hours, hourly_rate, work_type, income) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, workDate, hours, hourlyRate, workType, income]
        );

        res.success({
            record: {
                id: result.insertId,
                workDate,
                hours,
                income
            }
        }, "打卡成功");
    } catch (err) {
        res.error("打卡失败");
    }
});

// 获取月度统计
router.get("/monthly-stats", async (req, res) => {
    const { year, month } = req.query;
    const userId = req.auth.id;

    try {
        if (!year || !month) {
            return res.error("年份和月份不能为空");
        }

        // 使用参数化查询
        const [records] = await pool.query(
            `SELECT 
                work_date,
                hours,
                income,
                work_type,
                hourly_rate
            FROM work_hours 
            WHERE user_id = ? 
            AND DATE_FORMAT(work_date, '%Y') = ?
            AND DATE_FORMAT(work_date, '%m') = ?
            ORDER BY work_date ASC`,
            [userId, year, month.padStart(2, '0')]
        );

        // 初始化统计数据
        const stats = {
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
            totalIncome: 0,
            regularIncome: 0,
            overtimeIncome: 0,
            avgHourlyRate: 0,
            workDays: records.length,
            dailyStats: {}
        };

        // 计算统计数据
        records.forEach(record => {
            // 工时统计
            stats.totalHours += parseFloat(record.hours) || 0;
            if (record.work_type === 'regular') {
                stats.regularHours += parseFloat(record.hours) || 0;
                stats.regularIncome += parseFloat(record.income) || 0;
            } else {
                stats.overtimeHours += parseFloat(record.hours) || 0;
                stats.overtimeIncome += parseFloat(record.income) || 0;
            }

            // 总收入
            stats.totalIncome += parseFloat(record.income) || 0;

            // 日统计数据
            stats.dailyStats[record.work_date] = {
                hours: parseFloat(record.hours) || 0,
                income: parseFloat(record.income) || 0,
                workType: record.work_type,
                hourlyRate: parseFloat(record.hourly_rate) || 0
            };
        });

        // 计算平均时薪
        stats.avgHourlyRate = stats.totalHours > 0 
            ? (stats.totalIncome / stats.totalHours) 
            : 0;

        // 格式化数字
        stats.totalHours = Number(stats.totalHours.toFixed(2));
        stats.regularHours = Number(stats.regularHours.toFixed(2));
        stats.overtimeHours = Number(stats.overtimeHours.toFixed(2));
        stats.totalIncome = Number(stats.totalIncome.toFixed(2));
        stats.regularIncome = Number(stats.regularIncome.toFixed(2));
        stats.overtimeIncome = Number(stats.overtimeIncome.toFixed(2));
        stats.avgHourlyRate = Number(stats.avgHourlyRate.toFixed(2));

        res.success({ 
            year: parseInt(year),
            month: parseInt(month),
            stats 
        }, "获取统计数据成功");

    } catch (err) {
        console.error('月度统计错误:', err);
        res.error("获取统计数据失败");
    }
});

// 获取工时配置
router.get("/config", async (req, res) => {
    const userId = req.auth.id;

    try {
        const [configs] = await pool.query(
            "SELECT * FROM work_hour_config WHERE user_id = ?",
            [userId]
        );

        if (configs.length === 0) {
            // 如果没有配置，创建默认配置
            const [result] = await pool.query(
                `INSERT INTO work_hour_config 
                 (user_id, default_hours, default_hourly_rate, overtime_rate) 
                 VALUES (?, ?, ?, ?)`,
                [userId, 8, 0, 1.5]
            );

            res.success({
                config: {
                    id: result.insertId,
                    defaultHours: 8,
                    defaultHourlyRate: 0,
                    overtimeRate: 1.5
                }
            }, "获取配置成功");
        } else {
            res.success({ config: configs[0] }, "获取配置成功");
        }
    } catch (err) {
        res.error("获取配置失败");
    }
});

// 更新工时配置
router.post("/config", async (req, res) => {
    const { defaultHours, defaultHourlyRate, overtimeRate } = req.body;
    const userId = req.auth.id;

    try {
        if (!defaultHours || !defaultHourlyRate || !overtimeRate) {
            return res.error("所有配置项都不能为空");
        }

        const [result] = await pool.query(
            `UPDATE work_hour_config 
             SET default_hours = ?, default_hourly_rate = ?, overtime_rate = ? 
             WHERE user_id = ?`,
            [defaultHours, defaultHourlyRate, overtimeRate, userId]
        );

        if (result.affectedRows === 0) {
            return res.error("更新配置失败");
        }

        res.success({
            config: {
                defaultHours,
                defaultHourlyRate,
                overtimeRate
            }
        }, "更新配置成功");
    } catch (err) {
        res.error("更新配置失败");
    }
});

// 删除工时记录
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const userId = req.auth.id;

    try {
        // 检查记录是否存在且属于当前用户
        const [records] = await pool.query(
            "SELECT id FROM work_hours WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        if (records.length === 0) {
            return res.error("记录不存在或无权删除");
        }

        const [result] = await pool.query(
            "DELETE FROM work_hours WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.error("删除失败");
        }

        res.success({}, "删除成功");
    } catch (err) {
        res.error("删除失败");
    }
});

// 获取统计数据
router.get('/statistics', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userId = req.auth.id;

        // 基础查询
        const baseQuery = `
            SELECT 
                COUNT(*) as totalDays,
                SUM(work_hours) as totalHours,
                SUM(hourly_rate * work_hours) as totalEarnings,
                AVG(work_hours) as avgHoursPerDay,
                AVG(hourly_rate) as avgHourlyRate
            FROM work_hours 
            WHERE user_id = ?
        `;

        // 参数数组
        const queryParams = [userId];

        // 如果有日期范围，添加日期条件
        let dateCondition = '';
        if (startDate && endDate) {
            dateCondition = ' AND work_date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        // 完整查询
        const [results] = await pool.query(
            baseQuery + dateCondition,
            queryParams
        );

        // 格式化结果
        const stats = {
            totalDays: parseInt(results[0].totalDays) || 0,
            totalHours: parseFloat(results[0].totalHours) || 0,
            totalEarnings: parseFloat(results[0].totalEarnings) || 0,
            avgHoursPerDay: parseFloat(results[0].avgHoursPerDay) || 0,
            avgHourlyRate: parseFloat(results[0].avgHourlyRate) || 0
        };

        res.success({
            statistics: stats
        }, '获取统计数据成功');

    } catch (err) {
        console.error('获取统计数据错误:', err);
        res.error('获取统计数据失败');
    }
});

module.exports = router;