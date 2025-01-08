const express = require('express');
const router = express.Router();

const menuRoutes = [
    {
        path: "/dashboard",
        name: "Dashboard",
        icon: "1.svg",
        title: "仪表盘",
    },
    {
        path: "/HourTreasure",
        name: "HourTreasure",
        icon: "2.svg",
        title: "工时宝",
        children: [
            {
                path: "/man-hour",
                name: "man-hour",
                icon: "3.svg",
                title: "工时",
            },
            {
                path: "/hourly-wages",
                name: "hourly-wages",
                icon: "4.svg",
                title: "时薪",
            },
        ],
    },
];

router.get("/", async (req, res) => {
    try {
        res.success(menuRoutes, "获取菜单成功");
    } catch (err) {
        res.error("获取菜单失败");
    }
});

module.exports = router; 