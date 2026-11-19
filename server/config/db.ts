import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.ts';

let memoryServer: MongoMemoryServer | null = null;
let isConnected = false;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  let uri = env.mongodbUri.trim();

  if (!uri) {
    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'stagepass',
        },
      });
    }
    uri = memoryServer.getUri();
    console.log(`[db] Started embedded MongoDB instance at ${uri}`);
  } else {
    console.log('[db] Connecting to configured MONGODB_URI');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });

  isConnected = true;
  console.log('[db] Mongoose connected and indexes synced');
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  isConnected = false;
}
