import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import FilesController from '../controllers/FilesController'

const router = express.Router();

router.get('/status', AppController.getStatus); // wrong way to write a route ./status
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);
router.post('/files', FilesController.postUload);

module.exports = router;
