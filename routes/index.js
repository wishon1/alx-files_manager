import express from 'express';
import AppController from '../controllers/AppController';

const router = express.Router();

router.get('/status', AppController.getStatus); // wrong way to write a route ./status
router.get('/stats', AppController.getStats);

module.exports =router
