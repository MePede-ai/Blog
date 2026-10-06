/**
 * Valida o conteúdo do blog e gera o blog.json que o site lê.
 *
 *   npm install --no-save --no-package-lock yaml@2
 *   node scripts/gerar.cjs            -> valida e escreve dist/blog.json
 *   node scripts/gerar.cjs --checar   -> só valida
 *
 * Se algo estiver fora das regras, sai com erro e o site continua com a
 * última versão boa (o GitHub Actions só publica quando passa).
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..");
const ONLY_CHECK = process.argv.includes("--checar");
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const erros = [];
const erro = (arquivo, msg) => erros.push(`${arquivo}: ${msg}`);

// 1) Só conteúdo entra aqui. Qualquer arquivo fora desta lista reprova.
const PERMITIDOS = [
  /^README\.md$/,
  /^\.gitignore$/,
  /^scripts\/gerar\.cjs$/,
  /^\.github\/workflows\/publicar\.yml$/,
  /^posts\/[a-z0-9-]+\.mdoc$/,
  /^categories\/[a-z0-9-]+\.json$/,
  /^authors\/[a-z0-9-]+\.json$/,
  /^materials\/([a-z0-9-]+\.json|\.gitkeep)$/,
  /^imagens\/[a-z0-9\/._-]+\.(webp|jpe?g|png|avif)$/,
  /^materiais\/[a-z0-9\/._-]+\.(pdf|xlsx|xls|csv|docx)$/,
];

const arquivos = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

for (const f of arquivos) {
  if (!PERMITIDOS.some((re) => re.test(f))) {
    erro(f, "arquivo não permitido neste repositório (só posts, cadastros e imagens)");
    continue;
  }
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue; // removido no working tree
  const size = fs.statSync(full).size;
  if (f.startsWith("imagens/") && size > MAX_IMAGE_BYTES)
    erro(f, `imagem com ${(size / 1048576).toFixed(1)} MB (máximo 1,5 MB)`);
  if (size > MAX_FILE_BYTES) erro(f, "arquivo grande demais (máximo 15 MB)");
}

// 2) Cadastros
const lerJson = (dir) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter((n) => n.endsWith(".json"))
    .map((n) => {
      const slug = n.replace(/\.json$/, "");
      try {
        return { slug, ...JSON.parse(fs.readFileSync(path.join(ROOT, dir, n), "utf8")) };
      } catch (e) {
        erro(`${dir}/${n}`, `JSON inválido (${e.message})`);
        return null;
      }
    })
    .filter(Boolean);

const categories = lerJson("categories").map((c) => ({
  slug: c.slug,
  name: String(c.name ?? ""),
  description: String(c.description ?? ""),
  order: Number.isFinite(c.order) ? c.order : 99,
}));
const authors = lerJson("authors").map((a) => ({
  slug: a.slug,
  name: String(a.name ?? ""),
  role: String(a.role ?? ""),
  bio: String(a.bio ?? ""),
  avatar: a.avatar ?? null,
  linkedin: a.linkedin ?? null,
  instagram: a.instagram ?? null,
}));
const materials = lerJson("materials").map((m) => ({
  slug: m.slug,
  title: String(m.title ?? ""),
  kind: m.kind ?? "planilha",
  format: String(m.format ?? ""),
  description: String(m.description ?? ""),
  tone: m.tone ?? "soft",
  includes: Array.isArray(m.includes) ? m.includes.map(String) : [],
  file: m.file ?? null,
}));
for (const c of categories) if (!c.name) erro(`categories/${c.slug}.json`, "falta o nome");
for (const a of authors) if (!a.name) erro(`authors/${a.slug}.json`, "falta o nome");

const existe = (rel) => rel && fs.existsSync(path.join(ROOT, rel));
for (const a of authors)
  if (a.avatar && !existe(a.avatar)) erro(`authors/${a.slug}.json`, `foto não encontrada: ${a.avatar}`);
for (const m of materials)
  if (m.file && !existe(m.file)) erro(`materials/${m.slug}.json`, `arquivo não encontrado: ${m.file}`);

// 3) Posts (.mdoc = frontmatter YAML + corpo Markdoc)
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const posts = [];
for (const n of fs.readdirSync(path.join(ROOT, "posts")).filter((x) => x.endsWith(".mdoc"))) {
  const arq = `posts/${n}`;
  const slug = n.replace(/\.mdoc$/, "");
  const raw = fs.readFileSync(path.join(ROOT, arq), "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    erro(arq, "sem cabeçalho (frontmatter) entre linhas ---");
    continue;
  }
  let fm;
  try {
    fm = YAML.parse(m[1]) ?? {};
  } catch (e) {
    erro(arq, `cabeçalho YAML inválido (${e.message})`);
    continue;
  }
  const body = m[2].trim();
  const str = (v) => (v == null ? "" : String(v));
  const publishedAt = str(fm.publishedAt);

  if (str(fm.title).length < 10) erro(arq, "título ausente ou curto demais");
  if (str(fm.title).length > 90) erro(arq, "título com mais de 90 caracteres");
  if (str(fm.excerpt).length < 40) erro(arq, "resumo (excerpt) ausente ou curto demais");
  if (!categories.some((c) => c.slug === fm.category)) erro(arq, `categoria inexistente: ${fm.category}`);
  if (!authors.some((a) => a.slug === fm.author)) erro(arq, `autor inexistente: ${fm.author}`);
  if (!DATA.test(publishedAt)) erro(arq, `data inválida (use AAAA-MM-DD): ${publishedAt}`);
  if (!fm.cover) erro(arq, "falta a imagem de capa");
  else if (!existe(fm.cover)) erro(arq, `capa não encontrada: ${fm.cover}`);
  if (str(fm.coverAlt).length < 5) erro(arq, "falta o texto alternativo da capa");
  if (body.length < 200) erro(arq, "corpo do post vazio ou curto demais");
  if (/<script|<iframe|javascript:/i.test(body)) erro(arq, "o corpo não pode ter script, iframe ou javascript:");

  posts.push({
    slug,
    title: str(fm.title),
    excerpt: str(fm.excerpt),
    category: str(fm.category),
    author: str(fm.author),
    publishedAt,
    draft: fm.draft === true,
    cover: str(fm.cover),
    coverAlt: str(fm.coverAlt),
    summary: Array.isArray(fm.summary) ? fm.summary.map(str) : [],
    sources: Array.isArray(fm.sources)
      ? fm.sources.map((s) => ({ name: str(s?.name), date: str(s?.date), url: s?.url ? str(s.url) : null }))
      : [],
    tags: Array.isArray(fm.tags) ? fm.tags.map(str) : [],
    seoTitle: str(fm.seoTitle),
    seoDescription: str(fm.seoDescription),
    body,
  });
}

// 4) Resultado
if (erros.length) {
  console.error(`\n✗ ${erros.length} problema(s) encontrado(s):\n`);
  for (const e of erros) console.error(`  - ${e}`);
  console.error("\nNada foi publicado. O site continua com a última versão boa.\n");
  process.exit(1);
}

posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
const publicados = posts.filter((p) => !p.draft).length;
console.log(`✓ ${posts.length} post(s) (${publicados} publicados), ${categories.length} categorias, ${authors.length} autor(es).`);

if (!ONLY_CHECK) {
  const out = path.join(ROOT, "dist", "blog.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), categories, authors, materials, posts }),
  );
  console.log(`✓ gerado ${path.relative(ROOT, out)}`);
}
