/* eslint-disable import/no-named-as-default */
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  // GET /connect should sign-in the user by generating a new authentication token:
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    // By using the header Authorization and the technique of the Basic auth (Base64 of the <email>:<password>), find the user associated with this email and with this password:
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Decode Base64 credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    // Hash the password using SHA1
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

    // Find the user in the database
    const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

    // If no user has been found, return an error Unauthorized with a status code 401:
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Otherwise: Generate a random string (using uuidv4) as token
    const token = uuidv4();

    // Create a key: auth_<token> and use this key for storing in Redis (by using the redisClient created previously) the user ID for 24 hours:
    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);

    // Return this token: { "token": "155342df-2399-41da-9e8c-458b6ac52a0c" } with a status code 200:
    return res.status(200).json({ token });
  }

  // GET /disconnect should sign-out the user based on the token:
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    // Retrieve the user based on the token:
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    // If not found, return an error Unauthorized with a status code 401:
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token in Redis
    await redisClient.del(`auth_${token}`);

    // Return nothing with a status code 204:
    return res.status(204).send();
  }
}

module.exports = AuthController;
