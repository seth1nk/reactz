const express = require('express');
const cors = require('cors');
const axios = require('axios');
const qs = require('querystring');

const app = express();

// Настройка CORS
app.use(
  cors({
    origin: ['https://react-lime-delta.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Логирование запросов
app.use((req, res, next) => {
  console.log(`Запрос: ${req.method} ${req.url} от ${req.headers.origin}`);
  next();
});

// Эндпоинт для обмена кода на токен
app.get('/auth/vkid', async (req, res) => {
  const CLIENT_ID = '53544787';
  const CLIENT_SECRET = 'N89x726zF1SUKY5nWwC9'; // Убедитесь, что это правильный секрет
  const REDIRECT_URI = 'https://react-lime-delta.vercel.app';
  try {
    const { code, device_id, code_verifier } = req.query;
    if (!code || !device_id) {
      console.error('VKID: Код или device_id не предоставлены:', { code, device_id });
      return res.status(400).json({ error: 'Код или device_id не предоставлены' });
    }
    console.log('VKID: Получен код и device_id:', { code, device_id, code_verifier });

    const params = {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    };

    // Добавляем code_verifier, если он передан (для PKCE)
    if (code_verifier) {
      params.code_verifier = code_verifier;
    }

    const response = await axios.post(
      'https://id.vk.com/oauth2/auth',
      qs.stringify(params),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('VKID: Полный ответ от VK API:', JSON.stringify(response.data, null, 2));

    const { access_token, refresh_token, expires_in, user_id, id_token, scope } = response.data;
    if (!access_token) {
      console.error('VKID: access_token не получен:', response.data);
      throw new Error('access_token не получен от VK API');
    }

    console.log('VKID: Успешно получен access_token:', access_token);
    res.json({ access_token, refresh_token, expires_in, user_id, id_token, scope });
  } catch (error) {
    console.error('VKID: Ошибка обмена кода:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    res.status(500).json({ error: 'Ошибка обмена кода', details: error.response ? error.response.data : error.message });
  }
});

// Запуск сервера
app.listen(process.env.PORT || 3000, () => {
  console.log('Сервер запущен на порту', process.env.PORT || 3000);
});
