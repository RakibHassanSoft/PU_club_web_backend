const express = require('express');
const router = express.Router();
const authController = require('./authController');
const protect = require('./authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

router.get('/codeforces/stats', authController.getAllUsersCodeforcesStats);
router.get('/top/cf', authController.getTopCodeforcesSolvers);
router.get('/user/:email', authController.getUserByEmail);
router.get('/users', authController.getAllUsers);
router.get('/codeforces/:email', authController.getCodeforcesData);
// router.get('/codeforcesSingle/:handle', authController.getCodeforcesSingleStats);

// router.get('/user/approve/:email', authController.approveUser);
// router.get('/user/delete/:email', authController.deleteUserAccount);
router.patch('/update/:email', authController.updateUserByEmail);
// protected route example
router.get('/me', protect, (req, res) => {
  res.json({ message: `Hello user ${req.userId}` });
});
router.get('/', (req, res) => {
  res.json({ message: `Server is running` });
});

module.exports = router;
