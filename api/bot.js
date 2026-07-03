const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('سلام! برای گرفتن وضعیت آب‌وهوا، دستور زیر را بفرست:\n\n /weather tehran'));

// دستور گرفتن آب‌وهوا
bot.command('weather', async (ctx) => {
    // گرفتن نام شهر از پیام کاربر
    const messageText = ctx.message.text;
    const cityName = messageText.split(' ')[1]; // بخش دوم پیام بعد از فاصله

    if (!cityName) {
        return ctx.reply('لطفاً نام شهر را به انگلیسی وارد کنید. مثلاً:\n /weather tehran');
    }

    try {
        // ارسال درخواست به یک API رایگان آب‌وهوا
        const response = await axios.get(`https://wttr.in/${cityName}?format=j1`);
        
        // استخراج اطلاعات دما و وضعیت
        const currentCondition = response.data.current_condition[0];
        const temp = currentCondition.temp_C;
        const weatherDesc = currentCondition.weatherDesc[0].value;
        const humidity = currentCondition.humidity;

        const report = `🌤 وضعیت آب و هوای شهر *${cityName.toUpperCase()}*:\n\n` +
                       `🌡 دما: ${temp}°C\n` +
                       `💧 رطوبت: ${humidity}%\n` +
                       `📝 وضعیت: ${weatherDesc}`;

        ctx.replyWithMarkdown(report);

    } catch (error) {
        console.error(error);
        ctx.reply('خطایی در دریافت اطلاعات رخ داد. مطمئن شو که نام شهر را درست و به انگلیسی وارد کردی.');
    }
});

// این بخش برای هماهنگی با وب‌هووک ورسل است
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        } else {
            res.status(200).send('Bot is running...');
        }
    } catch (error) {
        console.error('Error handling update:', error);
        res.status(500).send('Internal Server Error');
    }
};
