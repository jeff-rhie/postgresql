const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// Serve the signup and login form
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html'); // Adjust the path according to your file structure
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
    return res.send('User not found. Please try again.'); // Direct response
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (isPasswordValid) {
    // Successful login
    await prisma.user.update({
      where: { email },
      data: { loginAttempts: 0 },
    });
    res.send('Login successful. Welcome back!'); // Direct response
  } else {
    // Failed login
    let attemptsLeft = 2 - user.loginAttempts;
    if (attemptsLeft <= 0) {
      // Reset password after 3 failed attempts
      const newPassword = Math.random().toString(36).slice(-8);
      await prisma.user.update({
        where: { email },
        data: {
          password: await bcrypt.hash(newPassword, 10),
          loginAttempts: 0,
        },
      });
      res.send(`기회를 모두 소진하여, 새로운 비밀번호는 ${newPassword}로 설정되었습니다.`);
    } else {
      // Increment failed login attempt
      await prisma.user.update({
        where: { email },
        data: { loginAttempts: { increment: 1 } },
      });
      res.send(`잘못된 비밀번호를 입력하였습니다. 이제 기회는 ${attemptsLeft}번 남았습니다.`);
    }
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
