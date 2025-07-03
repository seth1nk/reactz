const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors({ origin: 'https://react-lime-delta.vercel.app' }));
app.use(express.json());

// Подключение к базе apt
const pool = new Pool({
  user: 'urqarbpjuehu9fk5eal7',
  host: 'bdongtjfve7uhskj8hbz-postgresql.services.clever-cloud.com',
  database: 'bdongtjfve7uhskj8hbz',
  password: '5l36CuO5sO7tjbN0EeA1uptsd5JPNA',
  port: 50013,
});

// Создание таблицы users при запуске
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
    console.log('Table users created or already exists');
    client.release();
  } catch (error) {
    console.error('Error initializing table:', error.message);
    process.exit(1); // Завершаем процесс, если не удалось создать таблицу
  }
}

// Вызываем инициализацию таблицы при старте сервера
initializeTable();

// Эндпоинт для авторизации через Google
app.post('/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    const userInfo = response.data;
    res.json(userInfo);
  } catch (error) {
    console.error('Error verifying token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

// Эндпоинт для регистрации
app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Проверка, что все поля заполнены
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Проверка, существует ли пользователь
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Хэширование пароля
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Сохранение пользователя в базе данных
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    // Создание простого токена (заглушка, можно заменить на JWT)
    const token = Buffer.from(email).toString('base64');
    const userInfo = result.rows[0];

    res.json({ token, ...userInfo });
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Эндпоинт для входа
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверка, что все поля заполнены
    if (!email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Поиск пользователя в базе данных
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Создание простого токена (заглушка, можно заменить на JWT)
    const token = Buffer.from(email).toString('base64');
    const userInfo = { email: user.email, name: user.name };

    res.json({ token, ...userInfo });
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
