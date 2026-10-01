import { ObjectId, type Document, type Filter } from "mongodb";

/**
 * MongoDB data created by the early prototype uses ObjectIds, while Better Auth
 * uses string ids. Queries must accept both during the migration period.
 */
export function idCandidates(id: string): Array<string | ObjectId> {
  return ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];
}

export function toDatabaseId(id: string): string | ObjectId {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

export function idFilter(id: string): Filter<Document> {
  return { _id: { $in: idCandidates(id) } } as Filter<Document>;
}
