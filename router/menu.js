const express = require("express");
const router = express.Router();

const menuRoutes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "1.svg",
    title: "仪表盘",
  },
  {
    path: "/sys",
    name: "sys",
    icon: "2.svg",
    title: "系统管理",
    children: [
      {
        path: "/user",
        name: "user",
        icon: "3.svg",
        title: "用户管理",
      }
    ],
  },
  {
    path: "/material",
    name: "material",
    icon: "2.svg",
    title: "素材管理",
    children: [
      {
        path: "/show",
        name: "show",
        icon: "3.svg",
        title: "素材展示",
      },
      {
        path: "/upload",
        name: "upload",
        icon: "3.svg",
        title: "素材上传",
      }
    ],
  },
  {
    path: "/tools",
    name: "tools",
    icon: "2.svg",
    title: "便捷工具",
    children: [
      {
        path: "/convert",
        name: "convert",
        icon: "3.svg",
        title: "m3u8转mp4",
      }
    ],
  },
];

router.get("/", async (req, res) => {
  res.json({ code: 0, msg: "获取菜单成功", data: menuRoutes });
});

module.exports = router;
