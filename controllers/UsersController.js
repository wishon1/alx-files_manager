import { sha1 } from 'sha1';

const dbClient = require('../utils/db');

class UsersController {
  static async postUser(request, response) {
    const { email, password } = request.body;

    try {
      if (!email) {
        return response.status(400).json({error: 'Missing email'});
      }
      if (!password) {
        return response.status(400).json({error: 'Missing password'});
      }
      // check if email already exist in our database
      const users = dbClient.collection('user');
      const user = await users.findOne({ email });
      if (user) {
        return response.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);
      const newUser = await users.insertOne({ email, password: hashedPassword });

      const createdUser = {
        id: newUser.insertedId,
        email,
      };

      return response.status(201).json(createdUser);
    } catch (error) {
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
