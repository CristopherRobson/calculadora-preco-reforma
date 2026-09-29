// Publica dist/ na branch gh-pages. O cache fica numa pasta curta do sistema:
// o caminho do projeto no OneDrive estoura o limite de caminho do Windows.
import os from 'node:os';
import path from 'node:path';

process.env.CACHE_DIR = path.join(os.tmpdir(), 'ghp-cache');
const { publish } = (await import('gh-pages')).default;

publish('dist', { dotfiles: false }, (erro) => {
  if (erro) {
    console.error(erro);
    process.exit(1);
  }
  console.log('Publicado: https://cristopherrobson.github.io/calculadora-preco-reforma/');
});
