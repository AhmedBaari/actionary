import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const dbName = "sastranet";

async function connect(): Promise<{ client: MongoClient; db: Db }> {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI environment variable is not set");
    }

    const client = new MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 5,
    });

    try {
        await client.connect();
        const db = client.db(dbName);

        // Verify connection
        await db.admin().ping();

        cachedClient = client;
        cachedDb = db;

        console.log(`✓ Connected to MongoDB (${dbName})`);
        return { client, db };
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        throw error;
    }
}

export async function getDb(): Promise<Db> {
    const { db } = await connect();
    return db;
}

export async function getClient(): Promise<MongoClient> {
    const { client } = await connect();
    return client;
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
        cachedDb = null;
        console.log("✓ Disconnected from MongoDB");
    }
}
