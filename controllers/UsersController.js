const sha1 = require('sha1');
const dbClient = require('../utils/db');

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
}

module.exports = UsersController;
