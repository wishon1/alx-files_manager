import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}/${database}`;

    this.client = new MongoClient(url, {
      useNewUrlParser: true,
      useUnifieldTopology: true
    });

    // connect the mongo database
    this.client.connect((err) => {
      if (err) {
        console.log('MongoDB connection error: ', err);
      } else {
        this.db = this.client.db(`${database}`);
        console.log('MongoDB connected');
      }
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const users = this.db.collection('users');
    const usersNumber = await users.countDocuments();
    return usersNumber;
  }

  async nbFiles() {
    const files = this.db.collection('files');
    const filesNumber = await files.countDocuments();
    return filesNumber;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
