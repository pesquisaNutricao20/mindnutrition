import { hashAdminPassword } from '../api/_lib/admin.js';

const MIN_LENGTH = 8;
const password = String(process.argv[2] ?? process.env.ADMIN_PASSWORD ?? '').trim();

if (!password) {
  console.error('Uso: npm run admin:hash -- "sua-senha"');
  process.exit(1);
}

if (password.length < MIN_LENGTH) {
  console.error(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
  process.exit(1);
}

const hash = hashAdminPassword(password, { N: 32768, r: 8, p: 1 });

console.log('');
console.log('Adicione esta linha ao seu .env / variáveis do servidor:');
console.log('');
console.log(`ADMIN_KEY_HASH=${hash}`);
console.log('');
console.log('Cada execução gera um hash diferente, mas todos validam a mesma senha.');
console.log('Troque a senha gerando um novo hash e reiniciando o servidor.');
