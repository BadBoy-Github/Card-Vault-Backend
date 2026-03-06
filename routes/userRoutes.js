const express = require('express');
const router = express.Router();
const {
    getUsers,
    updateUser,
    deleteUser,
    updateProfile,
    changePassword,
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(protect, admin, getUsers);

// Profile routes (for regular users to update their own profile)
router.route('/profile').put(protect, updateProfile);
router.route('/change-password').put(protect, changePassword);

router
    .route('/:id')
    .put(protect, admin, updateUser)
    .delete(protect, admin, deleteUser);

module.exports = router;
