const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();

// Настройка CORS
app.use(cors({
  origin: ['https://react-lime-delta.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Установка заголовков COOP и COEP
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  console.log(`Запрос: ${req.method} ${req.url} от ${req.headers.origin}`);
  next();
});

// Обработка предварительных запросов OPTIONS
app.options('*', cors());

app.use(express.json());

// Подключение к базе PostgreSQL
const pool = new Pool({
  user: 'urqarbpjuehu9fk5eal7',
  host: 'bdongtjfve7uhskj8hbz-postgresql.services.clever-cloud.com',
  database: 'bdongtjfve7uhskj8hbz',
  password: '5l36CuO5sO7tjbN0EeA1uptsd5JPNA',
  port: 50013,
});

// Инициализация таблицы users
async function initializeTable() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL
      )
    `);
    console.log('Таблица users создана или уже существует');
    client.release();
  } catch (error) {
    console.error('Ошибка инициализации таблицы:', error.message);
    process.exit(1);
  }
}

initializeTable();

// Эндпоинт для Google-авторизации
app.post('/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'Токен не предоставлен' });
    }
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    const userInfo = response.data;
    console.log('Google userInfo:', userInfo);
    res.json(userInfo);
  } catch (error) {
    console.error('Ошибка проверки Google токена:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Ошибка авторизации через Google' });
  }
});

// Эндпоинт для регистрации
app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );
    const token = Buffer.from(email).toString('base64');
    const userInfo = result.rows[0];
    console.log('Пользователь зарегистрирован:', userInfo);
    res.json({ token, ...userInfo });
  } catch (error) {
    console.error('Ошибка регистрации:', error.message);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// Эндпоинт для входа
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }
    const token = Buffer.from(email).toString('base64');
    const userInfo = { email: user.email, name: user.name };
    console.log('Пользователь вошел:', userInfo);
    res.json({ token, ...userInfo });
  } catch (error) {
    console.error('Ошибка входа:', error.message);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// Обработка ошибок маршрутов
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.message, err.stack);
  if (err.message.includes('path-to-regexp')) {
    res.status(500).json({ error: 'Ошибка в маршруте. Проверьте конфигурацию путей.' });
  } else {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  // Логирование всех маршрутов для отладки
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`Маршрут: ${middleware.route.path} (${Object.keys(middleware.route.methods).join(', ')})`);
    }
  });
});
