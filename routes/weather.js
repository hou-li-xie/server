const express = require('express');
const router = express.Router();
const axios = require('axios');

// 高德地图 API 密钥
const AMAP_KEY = process.env.AMAP_KEY;

// 获取天气信息
router.get('/', async (req, res) => {
    try {
        // 1. 从请求中获取经纬度
        const { longitude, latitude } = req.query;
        
        if (!longitude || !latitude) {
            return res.error('缺少经纬度参数');
        }

        // 2. 通过经纬度获取城市编码
        const locationResponse = await axios.get(
            `https://restapi.amap.com/v3/geocode/regeo`,
            {
                params: {
                    key: AMAP_KEY,
                    location: `${longitude},${latitude}`,
                    extensions: 'base',
                    output: 'JSON'
                }
            }
        );

        if (locationResponse.data.status !== '1') {
            return res.error('获取城市信息失败');
        }

        const adcode = locationResponse.data.regeocode.addressComponent.adcode;

        // 3. 通过城市编码获取天气信息
        const weatherResponse = await axios.get(
            `https://restapi.amap.com/v3/weather/weatherInfo`,
            {
                params: {
                    key: AMAP_KEY,
                    city: adcode,
                    extensions: 'all',  // 获取预报天气
                    output: 'JSON'
                }
            }
        );

        if (weatherResponse.data.status !== '1') {
            return res.error('获取天气信息失败');
        }

        // 4. 整理并返回天气数据
        const weatherData = {
            city: locationResponse.data.regeocode.addressComponent.city || 
                  locationResponse.data.regeocode.addressComponent.province,
            forecasts: weatherResponse.data.forecasts[0].casts.map(cast => ({
                date: cast.date,
                dayWeather: cast.dayweather,
                nightWeather: cast.nightweather,
                dayTemp: cast.daytemp,
                nightTemp: cast.nighttemp,
                dayWind: cast.daywind,
                nightWind: cast.nightwind,
                dayPower: cast.daypower,
                nightPower: cast.nightpower
            }))
        };

        res.success(weatherData, '获取天气信息成功');

    } catch (err) {
        console.error('获取天气信息错误:', err);
        res.error('获取天气信息失败');
    }
});

module.exports = router; 