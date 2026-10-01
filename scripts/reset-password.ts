import { MongoClient, ObjectId } from "mongodb";
import * as dotenv from "dotenv";
import { hashPassword } from "better-auth/crypto";

dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI. Provide it in .env or .env.local.");
  process.exit(1);
}

const targetEmail = process.argv[2]?.toLowerCase().trim();
const newPassword = process.argv[3];
const role = process.argv[4] || "ADMIN";

if (!targetEmail || !newPassword) {
  console.error(
    "Usage: npm run reset-password -- <email> <new-password> [role]"
  );
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db("sastranet");

  console.log("Connecting to MongoDB...");

  // 1. Ensure user in allowedUsers
  await db.collection("allowedUsers").updateOne(
    { email: targetEmail },
    {
      $set: {
        email: targetEmail,
        role: role,
        active: true,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        createdBy: "cli-reset",
      },
    },
    { upsert: true }
  );

  // 2. Ensure user in user / users collections
  let user = await db.collection("user").findOne({ email: targetEmail });
  if (!user) {
    const userId = new ObjectId();
    user = {
      _id: userId,
      name: targetEmail.split("@")[0],
      email: targetEmail,
      role: role,
      podId: null,
      avatarUrl: null,
      active: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("user").insertOne(user);
    await db.collection("users").insertOne(user);
    console.log(`Created new user with id: ${userId.toString()}`);
  } else {
    await db.collection("user").updateOne(
      { _id: user._id },
      { $set: { role: role, active: true, updatedAt: new Date() } }
    );
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { role: role, active: true, updatedAt: new Date() } }
    );
    console.log(`Found existing user with id: ${user._id.toString()}`);
  }

  // 3. Hash password and update account collection
  const hashedPassword = await hashPassword(newPassword);

  const existingAccount = await db.collection("account").findOne({
    userId: user._id,
    providerId: "credential",
  });

  if (existingAccount) {
    await db.collection("account").updateOne(
      { _id: existingAccount._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      }
    );
    console.log(`✓ Password updated for existing account.`);
  } else {
    await db.collection("account").insertOne({
      userId: user._id,
      accountId: user._id.toString(),
      providerId: "credential",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created new credential account entry with hashed password.`);
  }

  console.log(`Account ready to sign in with the assigned ${role} role.`);

  await client.close();
}

main().catch((err) => {
  console.error("Error setting password:", err);
  process.exit(1);
});
