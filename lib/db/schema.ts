// Drizzle schema — Postgres source of truth for sync. RLS policies live in the custom migration.
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// bytea column carrying Yjs binary updates/snapshots as Uint8Array on the app side.
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return new Uint8Array(value as Buffer);
  },
});

// Collaboration roles; Viewer is read-only and cannot push updates.
export const roleEnum = pgEnum("role", ["owner", "editor", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A document's content lives in the Yjs update log; this row holds metadata + compaction base.
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().default("Untitled"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Compacted Yjs state up to compactedSeq; bounds log growth over the document's lifetime.
  compactedState: bytea("compacted_state"),
  compactedSeq: bigint("compacted_seq", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-document RBAC; the (document, user) pair is unique.
export const documentMembers = pgTable(
  "document_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("document_members_doc_user_uq").on(t.documentId, t.userId)],
);

// Append-only log of Yjs updates; seq is the server's total order used as the sync cursor.
export const documentUpdates = pgTable(
  "document_updates",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    update: bytea("update").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_updates_doc_seq_idx").on(t.documentId, t.seq)],
);

// Named/auto checkpoints of full Yjs state for version history and safe restore.
export const documentSnapshots = pgTable(
  "document_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    label: text("label"),
    state: bytea("state").notNull(),
    uptoSeq: bigint("upto_seq", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_snapshots_doc_created_idx").on(t.documentId, t.createdAt)],
);

// Marker referenced by RLS policies; the request sets app.user_id via SET LOCAL.
export const CURRENT_USER = sql`current_setting('app.user_id', true)::uuid`;
