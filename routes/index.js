import express from 'express';
import AppController from '../controllers/AppController';

import FilesController from '../controllers/FilesController'

import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';


const router = express.Router();

router.get('/status', AppController.getStatus); // wrong way to write a route ./status
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);
router.post('/files', FilesController.postUpload);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);


module.exports = router;
