// Recharge · la base des comptes, sans rien à créer à la main.
// Si une base D1 est branchée (liaison DB), elle est utilisée. Sinon, les mêmes tables vivent dans un
// petit stockage Cloudflare (Durable Object avec SQLite), créé automatiquement à la mise en ligne.
// Les deux s'utilisent de la même façon : prepare(sql).bind(...).first() / .run() / .all(), et batch([...]).
import { DurableObject } from "cloudflare:workers";
import m1 from "../migrations/0001_comptes.sql";
import m2 from "../migrations/0002_abonnement.sql";
import m3 from "../migrations/0003_mesure.sql";
import m4 from "../migrations/0004_parrainage.sql";
import m5 from "../migrations/0005_offres.sql";
import m6 from "../migrations/0006_playbook.sql";
import m7 from "../migrations/0007_rappel_essai.sql";
import m8 from "../migrations/0008_back_office.sql";

const MIGRATIONS = [m1, m2, m3, m4, m5, m6, m7, m8];
const statements = sql => sql.split("\n").map(l => l.replace(/--.*$/, "")).join("\n").split(";").map(x => x.trim()).filter(Boolean);

export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      sql.exec("CREATE TABLE IF NOT EXISTS _migrations (n INTEGER PRIMARY KEY)");
      const done = new Set(sql.exec("SELECT n FROM _migrations").toArray().map(r => r.n));
      MIGRATIONS.forEach((m, i) => {
        if (done.has(i + 1)) return;
        ctx.storage.transactionSync(() => { for (const st of statements(m)) sql.exec(st); sql.exec("INSERT INTO _migrations (n) VALUES (?)", i + 1); });
      });
    });
  }
  run1(q, params, mode) {
    const cur = this.ctx.storage.sql.exec(q, ...params);
    if (mode === "run") { cur.toArray(); return { meta: { changes: cur.rowsWritten } }; }
    const rows = cur.toArray().map(r => ({ ...r }));
    return mode === "first" ? rows[0] || null : { results: rows };
  }
  async q(q, params, mode) { return this.run1(q, params, mode); }
  async batch(list) { return this.ctx.storage.transactionSync(() => list.map(([q, p]) => this.run1(q, p, "run"))); }
}

/* La même interface que D1, branchée sur le stockage ci-dessus */
export function storeDb(env) {
  const stub = env.STORE.get(env.STORE.idFromName("recharge"));
  const make = (sql, params = []) => ({
    _sql: sql, _p: params,
    bind: (...p) => make(sql, p),
    first: () => stub.q(sql, params, "first"),
    run: () => stub.q(sql, params, "run"),
    all: () => stub.q(sql, params, "all")
  });
  return { prepare: sql => make(sql), batch: list => stub.batch(list.map(s => [s._sql, s._p])) };
}
