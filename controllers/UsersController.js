import redisClient from '../utils/redis';

const sha1 = require('sha1');
const dbClient = require('../utils/db');
import { ObjectId } from 'mongodb';

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;

    try {
      if (!email) {
        return response.status(400).json({ error: 'Missing email' });
      }
      if (!password) {
        return response.status(400).json({ error: 'Missing password' });
      }

      // Ensure dbClient is initialized and connected
      const db = dbClient.client.db();
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Check if email already exists in our database
      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ email });
      if (user) {
        return response.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);
      const newUser = await usersCollection.insertOne({ email, password: hashedPassword });

      const createdUser = {
        id: newUser.insertedId,
        email,
      };

      return response.status(201).json(createdUser);
    } catch (error) {
      return response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];

    // Retrieve the user based on the token:
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);

      // If not found, return an error Unauthorized with a status code 401:
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Retrieve the user from the database
      const user = await dbClient.db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { email: 1 } },
      );

      // If user is not found in the database (though this should be rare if the token is valid):
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Return the user object (email and id only)
      return res.status(200).json({ id: userId, email: user.email });
    } catch (error) {
      console.error('Error retrieving user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
