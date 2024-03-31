const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

const redis = require('redis');
const redisClient = redis.createClient({
  url: 'redis://localhost:6379' // This is the default Redis URL
});
redisClient.connect().catch(console.error);

const memoRoutes = require('./routes/memoRoutes'); // Import memoRoutes
const memoController = require('./controllers/memoController'); // Import memoController
app.use('/memos', memoRoutes);

app.use(bodyParser.urlencoded({ extended: true }));

// Serve the signup and login form
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../views/index.html'); 
});


app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  // Basic email format validation
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).send("Invalid email format.");
  }

  // Basic password complexity check: Minimum eight characters, at least one letter and one number
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
    return res.status(400).send("Password must be at least 8 characters long and include at least one letter and one number.");
  }

  const saltRounds = 10;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });
    res.send("Signup successful.");
  } catch (error) {
    res.status(400).send("Error creating user. It's possible the email is already in use.");
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.send('User not found. Please try again.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (isPasswordValid) {
    // Reset failed attempts on successful login
    await redisClient.del(`loginAttempts:${email}`);
    res.send('Login successful. Welcome back!');
  } else {
    // Increment failed login attempts
    const attemptsKey = `loginAttempts:${email}`;
    const currentAttempts = parseInt(await redisClient.get(attemptsKey)) || 0;
    const newAttempts = currentAttempts + 1;
    await redisClient.set(attemptsKey, newAttempts, {
      EX: 3600 // Expires in 1 hour
    });

    let attemptsLeft = 3 - newAttempts;
    if (attemptsLeft <= 0) {
      // Reset password logic
      const newPassword = Math.random().toString(36).slice(-8);
      await prisma.user.update({
        where: { email },
        data: {
          password: await bcrypt.hash(newPassword, 10),
        },
      });
      await redisClient.del(attemptsKey); // Reset attempts after action
      res.send(`기회를 모두 소진하여, 새로운 비밀번호는 ${newPassword}로 설정되었습니다.`);
    } else {
      res.send(`잘못된 비밀번호를 입력하였습니다. 이제 기회는 ${attemptsLeft}번 남았습니다.`);
    }
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
