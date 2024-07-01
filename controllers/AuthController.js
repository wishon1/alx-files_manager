/* eslint-disable import/no-named-as-default */
import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    const hashedPassword = sha1(password);

    const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    const hoursForExpiration = 24;
    await redisClient.set(key, user._id.toString(), hoursForExpiration * 3600);

    return res.status(200).json({ token });
  }

  // GET /disconnect should sign-out the user based on the token:
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    // Retrieve the user based on the token:
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token in Redis
    await redisClient.del(`auth_${token}`);

    // Return nothing with a status code 204:
    return res.status(204).send();
  }
}

module.exports = AuthController;
