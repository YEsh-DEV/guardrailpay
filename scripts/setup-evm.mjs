import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const envPath = resolve(rootDir, '.env');
const envExamplePath = resolve(rootDir, '.env.example');

function generateWallet() {
  try {
    const out = execSync('cast wallet new', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const [address, privateKey] = out.trim().split('\t');
    if (address && privateKey && address.startsWith('0x') && privateKey.startsWith('0x')) {
      return { address, privateKey };
    }
  } catch {
    // fallback if cast fails
  }

  // Fallback generation via crypto
  const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(Buffer.from(privateKey.slice(2), 'hex'));
  const publicKey = ecdh.getPublicKey().subarray(1);
  const addressHash = crypto.createHash('sha256').update(publicKey).digest();
  const address = '0x' + addressHash.subarray(12).toString('hex');
  return { address, privateKey };
}

function updateEnvFile(keyValues) {
  let content = '';
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf-8');
  }
  if (!content || content.length < 50) {
    content = existsSync(envExamplePath) ? readFileSync(envExamplePath, 'utf-8') : '';
  }

  for (const [key, value] of Object.entries(keyValues)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  writeFileSync(envPath, content.trim() + '\n', 'utf-8');
}

console.log('----------------------------------------------------');
console.log(' QuoteSeal: Generating Fresh EVM Testnet Wallets');
console.log('----------------------------------------------------\n');

// 1. Deployer Account
const deployer = generateWallet();
console.log('🔑 Deployer Wallet:');
console.log(`   Address:     ${deployer.address}`);
console.log(`   Private Key: ${deployer.privateKey}\n`);

// 2. Rotation Attestor Account
const attestor = generateWallet();
console.log('🛡️  Rotation Attestor / Approver Wallet:');
console.log(`   Address:     ${attestor.address}`);
console.log(`   Private Key: ${attestor.privateKey}\n`);

// Update .env
updateEnvFile({
  DEPLOYER_PRIVATE_KEY: deployer.privateKey,
  ROTATION_ATTESTOR_PRIVATE_KEY: attestor.privateKey,
  ROTATION_APPROVER: attestor.address,
});

console.log('✅ Updated .env with:');
console.log('   - DEPLOYER_PRIVATE_KEY');
console.log('   - ROTATION_ATTESTOR_PRIVATE_KEY');
console.log('   - ROTATION_APPROVER');
console.log('\n----------------------------------------------------');
console.log('Next step for Sepolia deployment:');
console.log(`1. Request Sepolia testnet ETH for the deployer:`);
console.log(`   👉 ${deployer.address}`);
console.log('   Faucets:');
console.log('   - Google Cloud Web3 Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia');
console.log('   - Sepolia PoW Faucet:       https://sepolia-faucet.pk910.de/');
console.log('----------------------------------------------------\n');
