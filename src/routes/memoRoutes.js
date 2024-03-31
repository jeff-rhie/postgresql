const express = require('express');
const { addMemo, getMemos } = require('../controllers/memoController');

const router = express.Router();

router.post('/', addMemo);
router.get('/', getMemos);

module.exports = router;
