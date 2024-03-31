const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.addMemo = async (req, res) => {
  const { userId, content } = req.body; // Ensure you have user authentication in place to get userId
  try {
    const memo = await prisma.memo.create({
      data: {
        content,
        userId
      },
    });
    res.json(memo);
  } catch (error) {
    res.status(400).send("Could not create memo.");
  }
};

exports.getMemos = async (req, res) => {
  const { userId } = req.query; // This should ideally come from session or token authentication
  try {
    const memos = await prisma.memo.findMany({
      where: { userId: parseInt(userId) },
    });
    res.json(memos);
  } catch (error) {
    res.status(400).send("Could not fetch memos.");
  }
};