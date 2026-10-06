# Blog do mepede.ai: conteúdo

Este repositório guarda **só o conteúdo** do blog (mepede.ai/blog): posts, categorias, autores e imagens.
Aqui não tem código do site, deploy nem senha. O site (repositório `landingpage`, que lê de `MePede-ai/Blog`) só lê o que for publicado daqui.

## Como funciona

1. Um post novo (ou uma correção) entra na branch `main`.
2. O GitHub Actions confere tudo (`scripts/gerar.cjs`): campos obrigatórios, categoria e autor válidos, capa existente, tamanho das imagens e se **não tem nenhum arquivo fora das regras**.
3. Se passar, ele publica o resultado na branch `publicado`. O site lê dessa branch e se atualiza sozinho em poucos minutos.
4. Se falhar, nada é publicado e o site continua com a última versão boa. O erro aparece na aba Actions.

Para tirar um post do ar: marque `draft: true` no arquivo, ou apague o arquivo. Para desfazer qualquer mudança: reverta o commit.

## Estrutura

```
posts/<slug>.mdoc                 Post (cabeçalho YAML + texto em Markdoc/Markdown)
categories/<slug>.json            Categorias (nome, descrição, ordem nas abas)
authors/<slug>.json               Autores (posts automáticos: "redacao-mepede-ai")
materials/<slug>.json             Materiais gratuitos
imagens/posts/<slug>/cover.webp   Capa de cada post (webp, ~1264 px de largura, até 1,5 MB)
imagens/banco/<categoria>-NN.webp Banco de imagens originais por categoria
materiais/                        Arquivos dos materiais gratuitos (PDF, planilha)
```

Campos do post: `title`, `excerpt`, `category`, `author`, `publishedAt` (AAAA-MM-DD), `draft`, `cover` (ex.: `imagens/posts/<slug>/cover.webp`), `coverAlt`, `summary` (Em 30 segundos), `sources` (name, date, url), `tags`, `seoTitle`, `seoDescription`.

## Editar

- **No painel:** rode a landing em modo dev com este repositório em `.blog-conteudo/` (veja o README da landing) e abra `localhost:3000/keystatic`.
- **No GitHub:** dá para editar qualquer `.mdoc` direto no navegador.

As regras editoriais (tom, checagem de fatos, imagens, o que nunca escrever) estão no "Guia editorial do blog", no projeto do Claude.

## Conferir antes de enviar (opcional)

```
npm install --no-save --no-package-lock yaml@2
node scripts/gerar.cjs --checar
```
