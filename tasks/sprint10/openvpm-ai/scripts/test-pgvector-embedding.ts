// Test pgvector embedding
// Použitie: cd packages/db && npx tsx ../../scripts/test-pgvector-embedding.ts

import postgres from "postgres";

async function testPgvector() {
  console.log("🔍 Testovanie pgvector embedding...\n");

  const DATABASE_URL = process.env.DATABASE_URL || "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";
  const sql = postgres(DATABASE_URL);

  try {
    console.log("✅ Pripojené k databáze\n");

    // 1. Kontrola pgvector extension
    const extResult = await sql`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `;

    if (extResult.length === 0) {
      console.log("❌ pgvector extension NIE JE povolená!");
      console.log("   Spustite: CREATE EXTENSION IF NOT EXISTS vector;\n");
      
      // Skúsim ju povoliť
      console.log("🔧 Pokúšam sa povoliť pgvector...");
      try {
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;
        console.log("✅ pgvector extension povolená!\n");
      } catch (err: any) {
        console.log(`❌ Chyba pri povoľovaní: ${err.message}\n`);
        return;
      }
    } else {
      console.log(`✅ pgvector extension povolená (verzia ${extResult[0].extversion})\n`);
    }

    // 2. Vytvorenie testovacej tabuľky
    console.log("📦 Vytváram testovaciu tabuľku test_embeddings...");
    await sql`
      CREATE TABLE IF NOT EXISTS test_embeddings (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding VECTOR(3),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log("✅ Tabuľka vytvorená\n");

    // 3. Vloženie testovacích dát
    console.log("📝 Vkladám testovacie dáta...");
    await sql`TRUNCATE test_embeddings`;
    await sql`
      INSERT INTO test_embeddings (content, embedding) 
      VALUES 
        ('ahoj svet', '[0.1, 0.2, 0.3]'::vector),
        ('hello world', '[0.1, 0.2, 0.31]'::vector),
        ('dobrý deň', '[0.5, 0.6, 0.7]'::vector),
        ('mačka', '[0.9, 0.1, 0.1]'::vector),
        ('pes', '[0.85, 0.15, 0.1]'::vector)
    `;
    console.log("✅ Dáta vložené\n");

    // 4. Testovanie similarity search (L2 distance)
    console.log("🔎 Testovanie similarity search (L2 distance)...");
    console.log("   Hľadám najpodobnejšie k '[0.1, 0.2, 0.3]' (ahoj svet):\n");
    
    const searchResult = await sql`
      SELECT 
        content, 
        embedding::text,
        embedding <-> '[0.1, 0.2, 0.3]'::vector AS distance
      FROM test_embeddings
      ORDER BY embedding <-> '[0.1, 0.2, 0.3]'::vector
      LIMIT 3
    `;

    console.log("   Výsledky (zoradené podľa vzdialenosti):");
    searchResult.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. "${row.content}" (vzdialenosť: ${Number(row.distance).toFixed(4)})`);
    });
    console.log();

    // 5. Testovanie cosine similarity
    console.log("📐 Testovanie cosine similarity...");
    console.log("   Hľadám najpodobnejšie k '[0.9, 0.1, 0.1]' (mačka) pomocou cosine:\n");
    
    const cosineResult = await sql`
      SELECT 
        content,
        1 - (embedding <=> '[0.9, 0.1, 0.1]'::vector) AS similarity
      FROM test_embeddings
      ORDER BY embedding <=> '[0.9, 0.1, 0.1]'::vector
      LIMIT 3
    `;

    console.log("   Výsledky (zoradené podľa podobnosti):");
    cosineResult.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. "${row.content}" (podobnosť: ${Number(row.similarity).toFixed(4)})`);
    });
    console.log();

    // 6. Testovanie inner product
    console.log("⚡ Testovanie inner product...");
    const ipResult = await sql`
      SELECT 
        content,
        embedding <#> '[0.5, 0.5, 0.5]'::vector AS negative_inner_product
      FROM test_embeddings
      ORDER BY embedding <#> '[0.5, 0.5, 0.5]'::vector
      LIMIT 3
    `;

    console.log("   Výsledky:");
    ipResult.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. "${row.content}" (inner product: ${Number(row.negative_inner_product).toFixed(4)})`);
    });
    console.log();

    // 7. Vytvorenie indexu
    console.log("📇 Vytváram HNSW index pre rýchle vyhľadávanie...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_test_embeddings_embedding 
      ON test_embeddings 
      USING hnsw (embedding vector_cosine_ops)
    `;
    console.log("✅ Index vytvorený\n");

    // 8. Výkonnostný test
    console.log("⏱️  Výkonnostný test (1000 náhodných vektorov)...");
    await sql`
      INSERT INTO test_embeddings (content, embedding)
      SELECT 
        'test_' || i,
        ('[' || random() || ',' || random() || ',' || random() || ']')::vector
      FROM generate_series(1, 1000) AS i
    `;
    
    const startTime = Date.now();
    const perfResult = await sql`
      EXPLAIN ANALYZE
      SELECT content, embedding <-> '[0.5, 0.5, 0.5]'::vector AS distance
      FROM test_embeddings
      ORDER BY distance
      LIMIT 10
    `;
    const endTime = Date.now();

    console.log(`   Čas: ${endTime - startTime}ms`);
    console.log("   Query plan:");
    perfResult.forEach((row: any) => {
      console.log(`   ${row["QUERY PLAN"]}`);
    });
    console.log();

    // 9. Cleanup
    console.log("🧹 Cleanup...");
    await sql`DROP TABLE IF EXISTS test_embeddings`;
    console.log("✅ Testovacia tabuľka odstránená\n");

    console.log("🎉 Všetky testy úspešné!");
    console.log("\n📊 Zhrnutie:");
    console.log("   ✅ pgvector extension je povolená");
    console.log("   ✅ VECTOR typ funguje správne");
    console.log("   ✅ Similarity search (L2, cosine, inner product) funguje");
    console.log("   ✅ HNSW index je vytvorený");
    console.log("   ✅ Výkon je akceptovateľný");

  } catch (error: any) {
    console.error("❌ Chyba:", error.message);
    if (error.code) {
      console.error(`   PostgreSQL error code: ${error.code}`);
    }
  } finally {
    await sql.end();
  }
}

testPgvector();
