const express = require('express');
const app = express();
const path = require('path');
const { createClient } = require('redis');

const cors = require('cors');
app.use(cors());

// Create a Redis client
const redisClient = createClient({ 
  url: 'redis://localhost:6379'
});

// Connect to Redis
redisClient.connect().catch(console.error);

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/user/:userId', async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'user.html'));
});

app.get('/user/:userId/memos', async (req, res) => {
  const { userId } = req.params;

  try {
    const memos = await prisma.memo.findMany({
      where: { userId: parseInt(userId) },
    });
    res.json(memos);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching memos.");
  }
});

app.post('/user/:userId/memos', async (req, res) => {
  const { userId } = req.params;
  const { content } = req.body;

  // Make sure to parse userId to an integer if it's not already
  const parsedUserId = parseInt(userId, 10);
  // Check if parsedUserId is NaN (Not a Number)
  if (isNaN(parsedUserId)) {
    return res.status(400).json({ message: "Invalid user ID." });
  }

  const userExists = await prisma.user.findUnique({
    where: { id: parsedUserId },
  });
  
  if (!userExists) {
    return res.status(404).json({ message: "User not found." });
  }

  try {
    const memo = await prisma.memo.create({
      data: {
        content,
        userId: parsedUserId,
      },
    });
    res.json(memo); // Return the created memo
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving memo." });
  }
});



app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  // Basic email format validation
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Basic password complexity check: Minimum eight characters, at least one letter and one number
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
    return res.status(400).json({ message: "Password must be at least 8 characters long and include at least one letter and one number." });
  }

  try {
    // Directly create the user without a separate createUser function for clarity
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10), // Assuming bcrypt is being used for password hashing
      },
    });
    res.json({ message: "Signup successful.", userId: user.id }); // Respond with JSON
  } catch (error) {
    console.error(error);

    // Check if the error is due to a unique constraint violation (e.g., email already exists)
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "Error creating user. The email is already in use." });
    }

    // Handle other unexpected errors
    res.status(500).json({ message: "An unexpected error occurred." });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const attemptsKey = `loginAttempts:${email}`;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // If the user doesn't exist, respond with a generic error message.
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      await redisClient.del(attemptsKey); // Clear failed attempts on successful login.
      return res.json({ message: "Login successful", userId: user.id });
    } else {
      // Handle incorrect password.
      const failedAttempts = parseInt(await redisClient.incr(attemptsKey)) || 1;
      await redisClient.expire(attemptsKey, 3600); // Set expiration for failed attempts.

      if (failedAttempts >= 3) {
        // Reset the password after 3 failed attempts.
        const newPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
          where: { email },
          data: { password: hashedPassword },
        });
        await redisClient.del(attemptsKey); // Clear the failed attempts after resetting the password.

        // Consider securely notifying the user of their new password.
        // Directly returning the new password in the response might not be secure.
        return res.status(401).json({ message: `Too many failed login attempts. Your password has been reset as ${newPassword}` });
      } else {
        // Notify the user of the remaining attempts.
        return res.status(401).json({ message: `Invalid email or password. You have ${3 - failedAttempts} attempt(s) left.` });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred during the login process." });
  }
});


async function createUser(email, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });
}

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
