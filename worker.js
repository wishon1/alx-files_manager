import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Bull('fileQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: new ObjectId(fileId),
    userId: new ObjectId(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }
  const sizes = [500, 250, 100];
  const thumbnails = await Promise.all(sizes.map(async (size) => {
    const options = { width: size };
    const thumbnail = await imageThumbnail(file.localPath, options);
    const thumbnailPath = `${file.localPath}_${size}`;
    await fs.writeFile(thumbnailPath, thumbnail);
    return thumbnailPath;
  }));
  return thumbnails;
});
