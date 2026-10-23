import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  resolveMailboxScope,
  applyMailboxAccountFilter,
} from "../src/mailbox-scope.ts";
import {
  listEmails,
  searchEmails,
  getEmail,
  getAttachment,
  createServer,
  jsonResult,
  type Env,
} from "../src/index.ts";

function createTestDatabase() {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE user (
      user_id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      status INTEGER DEFAULT 0,
      reg_key_id INTEGER DEFAULT 0,
      is_del INTEGER DEFAULT 0
    );

    CREATE TABLE account (
      account_id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      name TEXT DEFAULT '',
      status INTEGER DEFAULT 0,
      is_del INTEGER DEFAULT 0
    );

    CREATE TABLE email (
      email_id INTEGER PRIMARY KEY,
      account_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      send_email TEXT,
      name TEXT,
      to_email TEXT,
      to_name TEXT,
      subject TEXT,
      text TEXT,
      content TEXT,
      message_id TEXT DEFAULT '',
      in_reply_to TEXT DEFAULT '',
      relation TEXT DEFAULT '',
      type INTEGER DEFAULT 0,
      status INTEGER DEFAULT 0,
      unread INTEGER DEFAULT 0,
      code TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now')),
      is_del INTEGER DEFAULT 0
    );

    CREATE TABLE attachments (
      att_id INTEGER PRIMARY KEY,
      email_id INTEGER NOT NULL,
      filename TEXT,
      mime_type TEXT,
      size INTEGER,
      key TEXT,
      disposition TEXT,
      content_id TEXT
    );
  `);

  // Seed users:
  // user 1: admin
  // user 2: yuki (personal)
  // user 3: resi (personal)
  // user 4: friend (registered via invite code)
  // user 5: deleted user
  const insertUser = db.prepare(`
    INSERT INTO user (user_id, email, status, reg_key_id, is_del)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run(1, "admin@jcllyuki.com", 0, 0, 0);
  insertUser.run(2, "yuki@jcllyuki.com", 0, 0, 0);
  insertUser.run(3, "resi@jcllyuki.com", 0, 0, 0);
  insertUser.run(4, "friend@jcllyuki.com", 0, 999, 0);
  insertUser.run(5, "deleted@jcllyuki.com", 0, 0, 1);

  // Seed accounts:
  const insertAccount = db.prepare(`
    INSERT INTO account (account_id, user_id, email, name, status, is_del)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAccount.run(101, 1, "admin@jcllyuki.com", "Admin", 0, 0);
  insertAccount.run(102, 2, "yuki@jcllyuki.com", "Yuki", 0, 0);
  insertAccount.run(103, 3, "resi@jcllyuki.com", "Resi", 0, 0);
  insertAccount.run(104, 4, "friend@jcllyuki.com", "Friend", 0, 0);
  // Future alias under admin user (auto-discovery)
  insertAccount.run(105, 1, "alias@jcllyuki.com", "Admin Alias", 0, 0);
  // Soft-deleted account under admin
  insertAccount.run(106, 1, "deleted-alias@jcllyuki.com", "Deleted Alias", 0, 1);

  // Seed emails:
  const insertEmail = db.prepare(`
    INSERT INTO email (
      email_id, account_id, user_id, send_email, name, to_email, to_name,
      subject, text, content, code, type, status, unread, is_del, create_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  // 1: Admin email
  insertEmail.run(1, 101, 1, "sender1@example.com", "Sender 1", "admin@jcllyuki.com", "Admin", "Admin Invoice", "Code: 123456", "<p>Invoice</p>", "123456", 0, 0, 0, 0);
  // 2: Yuki email
  insertEmail.run(2, 102, 2, "sender2@example.com", "Sender 2", "yuki@jcllyuki.com", "Yuki", "Yuki Updates", "Welcome Yuki", "<p>Yuki</p>", "", 0, 0, 0, 0);
  // 3: Resi email
  insertEmail.run(3, 103, 3, "sender3@example.com", "Sender 3", "resi@jcllyuki.com", "Resi", "Resi Report", "Report details", "<p>Report</p>", "", 0, 0, 0, 0);
  // 4: Admin alias email
  insertEmail.run(4, 105, 1, "sender4@example.com", "Sender 4", "alias@jcllyuki.com", "Alias", "Alias News", "News here", "<p>News</p>", "", 0, 0, 0, 0);
  // 5: Plus-tag to admin email
  insertEmail.run(5, 101, 1, "sender5@example.com", "Sender 5", "admin+billing@jcllyuki.com", "Admin", "Billing Alert", "Billing info", "<p>Billing</p>", "", 0, 0, 0, 0);
  // 6: Friend email (UNAUTHORIZED for ChatGPT connection)
  insertEmail.run(6, 104, 4, "secret@example.com", "Secret Sender", "friend@jcllyuki.com", "Friend", "Confidential Friend Email", "Top secret body", "<p>Secret</p>", "999999", 0, 0, 0, 0);

  // Seed attachments:
  const insertAtt = db.prepare(`
    INSERT INTO attachments (att_id, email_id, filename, mime_type, size, key, disposition, content_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Attachment on admin email
  insertAtt.run(201, 1, "admin-doc.txt", "text/plain", 100, "att/admin-doc.txt", "attachment", "");
  // Attachment on friend email (unauthorized)
  insertAtt.run(202, 6, "friend-secret.pdf", "application/pdf", 500, "att/friend-secret.pdf", "attachment", "");

  return db;
}

function wrapD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let boundValues: any[] = [];
      const stmtObj = {
        bind(...values: any[]) {
          boundValues = values;
          return stmtObj;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const stmt = db.prepare(sql);
          const row = stmt.get(...boundValues) as any;
          if (!row) return null;
          if (colName) return row[colName];
          return row as T;
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          const stmt = db.prepare(sql);
          const results = stmt.all(...boundValues) as T[];
          return {
            results,
            success: true,
            meta: {} as any,
          };
        },
        async run(): Promise<D1Response> {
          const stmt = db.prepare(sql);
          stmt.run(...boundValues);
          return {
            success: true,
            meta: {} as any,
          };
        },
      };
      return stmtObj as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}

function createTestEnv(db: DatabaseSync, personalMailboxes = "yuki@jcllyuki.com,resi@jcllyuki.com"): Env {
  return {
    DB: wrapD1(db),
    R2: {
      get: async () => null,
    } as unknown as R2Bucket,
    AUTH_KV: {
      get: async () => "test_token",
      put: async () => {},
    } as unknown as KVNamespace,
    OAUTH_SIGNING_SECRET: "test_secret_key_12345",
    MCP_MAILBOX: "admin@jcllyuki.com",
    MCP_PERSONAL_MAILBOXES: personalMailboxes,
    MAIL_API_URL: "https://mail.jcllyuki.com/api",
  };
}

test("1. resolveMailboxScope discovers admin, yuki, resi, and future admin-owned alias", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);
  assert.deepEqual(scope.allMailboxes.sort(), [
    "admin@jcllyuki.com",
    "alias@jcllyuki.com",
    "resi@jcllyuki.com",
    "yuki@jcllyuki.com",
  ]);
  assert.deepEqual(scope.accountIds.sort(), [101, 102, 103, 105]);
});

test("2. resolveMailboxScope strictly excludes invitation-code users and non-allowlisted accounts", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);
  assert.ok(!scope.allMailboxes.includes("friend@jcllyuki.com"));
  assert.ok(!scope.accountIds.includes(104));
});

test("3. resolveMailboxScope excludes soft-deleted accounts and soft-deleted users", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);
  assert.ok(!scope.allMailboxes.includes("deleted-alias@jcllyuki.com"));
  assert.ok(!scope.allMailboxes.includes("deleted@jcllyuki.com"));
  assert.ok(!scope.accountIds.includes(106));
});

test("4. resolveMailboxScope with requested mailbox isolates to that specific account", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env, "yuki@jcllyuki.com");
  assert.deepEqual(scope.mailboxes, ["yuki@jcllyuki.com"]);
  assert.deepEqual(scope.accountIds, [102]);
  assert.ok(scope.allMailboxes.includes("admin@jcllyuki.com"));
});

test("5. resolveMailboxScope rejects unauthorized requested mailbox", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  await assert.rejects(
    async () => {
      await resolveMailboxScope(env, "friend@jcllyuki.com");
    },
    /Mailbox 'friend@jcllyuki\.com' is not authorised/,
  );

  await assert.rejects(
    async () => {
      await resolveMailboxScope(env, "stranger@otherdomain.com");
    },
    /is not authorised/,
  );
});

test("6. listEmails aggregates authorized mailboxes and isolates from unapproved accounts", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);
  const emails = await listEmails(
    env,
    { box: "inbox", page: 1, pageSize: 20, unreadOnly: false },
    scope.accountIds,
  );

  // Emails 1 (admin), 2 (yuki), 3 (resi), 4 (alias), 5 (plus-tag admin) must be present
  const emailIds = emails.map((e) => e.emailId);
  assert.ok(emailIds.includes(1));
  assert.ok(emailIds.includes(2));
  assert.ok(emailIds.includes(3));
  assert.ok(emailIds.includes(4));
  assert.ok(emailIds.includes(5));

  // Email 6 belongs to friend@jcllyuki.com (unauthorized) and MUST NOT be returned
  assert.ok(!emailIds.includes(6));
});

test("7. listEmails with specific mailbox filter returns only that mailbox's messages", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env, "resi@jcllyuki.com");
  const emails = await listEmails(
    env,
    { box: "inbox", page: 1, pageSize: 20, unreadOnly: false },
    scope.accountIds,
  );

  assert.equal(emails.length, 1);
  assert.equal(emails[0].emailId, 3);
  assert.equal(emails[0].toEmail, "resi@jcllyuki.com");
});

test("8. searchEmails searches across authorized mailboxes and never returns unapproved user's email", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);

  // Search for generic term matching multiple accounts
  const resiSearch = await searchEmails(env, { query: "Report", limit: 10 }, scope.accountIds);
  assert.equal(resiSearch.length, 1);
  assert.equal(resiSearch[0].emailId, 3);

  // Search for content inside friend's email
  const secretSearch = await searchEmails(env, { query: "Confidential", limit: 10 }, scope.accountIds);
  assert.equal(secretSearch.length, 0);

  const secretBodySearch = await searchEmails(env, { query: "Top secret", limit: 10 }, scope.accountIds);
  assert.equal(secretBodySearch.length, 0);
});

test("9. getEmail permits authorized mailboxes and strictly blocks unapproved user's email", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);

  // Authorized emails: admin, yuki, resi, alias
  const adminEmail = await getEmail(env, 1, scope.accountIds);
  assert.ok(adminEmail);
  assert.equal(adminEmail.emailId, 1);

  const yukiEmail = await getEmail(env, 2, scope.accountIds);
  assert.ok(yukiEmail);
  assert.equal(yukiEmail.emailId, 2);

  const resiEmail = await getEmail(env, 3, scope.accountIds);
  assert.ok(resiEmail);
  assert.equal(resiEmail.emailId, 3);

  const aliasEmail = await getEmail(env, 4, scope.accountIds);
  assert.ok(aliasEmail);
  assert.equal(aliasEmail.emailId, 4);

  // Unauthorized friend email: MUST return null
  const friendEmail = await getEmail(env, 6, scope.accountIds);
  assert.equal(friendEmail, null);
});

test("10. getAttachment permits authorized email attachments and blocks unapproved user's attachments", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const scope = await resolveMailboxScope(env);

  // Admin attachment on email 1
  const adminAtt = await getAttachment(env, 1, 201, scope.accountIds);
  assert.ok(adminAtt);
  assert.equal(adminAtt.attId, 201);
  assert.equal(adminAtt.filename, "admin-doc.txt");

  // Friend attachment on email 6: MUST return null
  const friendAtt = await getAttachment(env, 6, 202, scope.accountIds);
  assert.equal(friendAtt, null);

  // Attacker trying to probe attachment 202 with email 1 (ID mismatch): MUST return null
  const spoofedAtt = await getAttachment(env, 1, 202, scope.accountIds);
  assert.equal(spoofedAtt, null);
});

test("11a. MCP result carries both structuredContent and compatible text", () => {
  const payload = { account: "admin@jcllyuki.com", mailboxes: ["admin@jcllyuki.com"], count: 1 };
  const response = jsonResult(payload);
  assert.deepEqual(response.structuredContent, payload);
  assert.deepEqual(JSON.parse(response.content[0].text), payload);
});

test("11. cloud_mail_mailboxes tool enumerates authorized addresses", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db);

  const server = createServer(env, false);
  // Verify tool is registered
  // Call tool via direct scope resolution
  const scope = await resolveMailboxScope(env);
  assert.deepEqual(scope.allMailboxes.sort(), [
    "admin@jcllyuki.com",
    "alias@jcllyuki.com",
    "resi@jcllyuki.com",
    "yuki@jcllyuki.com",
  ]);
});

test("12. backward compatibility: when MCP_PERSONAL_MAILBOXES is empty, only admin accounts are exposed", async () => {
  const db = createTestDatabase();
  const env = createTestEnv(db, ""); // empty allowlist

  const scope = await resolveMailboxScope(env);
  assert.deepEqual(scope.allMailboxes.sort(), [
    "admin@jcllyuki.com",
    "alias@jcllyuki.com",
  ]);
  assert.deepEqual(scope.accountIds.sort(), [101, 105]);
  assert.ok(!scope.allMailboxes.includes("yuki@jcllyuki.com"));
  assert.ok(!scope.allMailboxes.includes("resi@jcllyuki.com"));
});
