import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getDb } from "@/lib/db/client";

const lazyDb = new Proxy({} as Parameters<typeof mongodbAdapter>[0], {
  get(_target, property) {
    if (property === "collection") {
      return (name: string) =>
        new Proxy(
          {},
          {
            get(_collection, method) {
              if (method === "aggregate" || method === "find") {
                return (...args: unknown[]) =>
                  new Proxy(
                    {},
                    {
                      get(_cursor, cursorMethod) {
                        return (...cursorArgs: unknown[]) =>
                          getDb().then((db) => {
                            const collection = db.collection(name);
                            const cursor = (
                              collection[
                              method as keyof typeof collection
                              ] as (...args: unknown[]) => unknown
                            ).apply(collection, args);
                            const value =
                              (cursor as Record<PropertyKey, unknown>)[
                              cursorMethod
                              ];
                            return typeof value === "function"
                              ? (
                                value as (...args: unknown[]) => unknown
                              ).apply(cursor, cursorArgs)
                              : value;
                          });
                      },
                    }
                  );
              }

              return (...args: unknown[]) =>
                getDb().then((db) => {
                  const collection = db.collection(name);
                  const value = collection[method as keyof typeof collection];
                  return typeof value === "function"
                    ? (value as (...args: unknown[]) => unknown).apply(
                      collection,
                      args
                    )
                    : value;
                });
            },
          }
        );
    }

    return (...args: unknown[]) =>
      getDb().then((db) => {
        const value = db[property as keyof typeof db];
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).apply(db, args)
          : value;
      });
  },
});

export const auth = betterAuth({
  database: mongodbAdapter(lazyDb),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  hooks: {
    before: async (context: any) => {
      if (
        context.path !== "/sign-in/email" &&
        context.path !== "/sign-up/email"
      ) {
        return;
      }

      const body = context.body as { email?: string };
      const email = body?.email?.toLowerCase().trim();

      if (!email) {
        return {
          response: new Response(
            JSON.stringify({
              error: "Email is required",
              code: "EMAIL_REQUIRED",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
        };
      }

      const db = await getDb();
      const allowedUser = await db
        .collection("allowedUsers")
        .findOne({ email, active: true });

      if (!allowedUser) {
        return {
          response: new Response(
            JSON.stringify({
              error: "This account isn't part of the SastraNet workspace.",
              code: "NOT_ALLOWED",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ),
        };
      }
    },
    after: async (context: any) => {
      if (context.path !== "/sign-up/email") return {};

      try {
        const body = context.body as { email?: string };
        const email = body?.email?.toLowerCase().trim();
        if (!email) return {};

        const db = await getDb();
        const allowedUser = await db
          .collection("allowedUsers")
          .findOne({ email });

        if (allowedUser) {
          await db.collection("user").updateOne(
            { email },
            {
              $set: {
                role: allowedUser.role,
                podId: null,
                active: true,
              },
            }
          );
        }
      } catch (error) {
        console.error("[auth] Failed to assign role after signup:", error);
      }

      return {};
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.13:3000",
    "http://192.168.1.41:3000",
    "http://192.168.*:3000",
    "http://10.*:3000",
  ].filter((origin): origin is string => Boolean(origin)),
});

export type Auth = typeof auth;
