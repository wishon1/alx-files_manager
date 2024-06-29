import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';

const router = express.Router();

router.get('/status', AppController.getStatus); // wrong way to write a route ./status
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);

module.exports = router;
