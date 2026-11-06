import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const envPath = resolve(rootDir, '.env');
const contractsDir = resolve(rootDir, 'contracts');

if (!existsSync(envPath)) {
  console.error('❌ .env file not found. Run "npm run setup:evm" first.');
  process.exit(1);
}

const envContent = readFileSync(envPath, 'utf-8');
const rpcMatch = envContent.match(/^SEPOLIA_RPC_URL=(.+)$/m);
const pkMatch = envContent.match(/^DEPLOYER_PRIVATE_KEY=(.+)$/m);

const rpcUrl = rpcMatch ? rpcMatch[1].trim() : 'https://rpc.sepolia.org';
const privateKey = pkMatch ? pkMatch[1].trim() : '';

if (!privateKey || privateKey.length < 64) {
  console.error('❌ DEPLOYER_PRIVATE_KEY is missing or invalid in .env.');
  console.error('   Please add your funded Sepolia private key to .env.');
  process.exit(1);
}

console.log('----------------------------------------------------');
console.log(' Deploying RotationController.sol to Sepolia...');
console.log(` RPC: ${rpcUrl}`);
console.log('----------------------------------------------------\n');

try {
  const deployCmd = `forge script script/Deploy.s.sol:DeployScript --rpc-url "${rpcUrl}" --private-key "${privateKey}" --broadcast`;
  execSync(deployCmd, { cwd: contractsDir, stdio: 'inherit' });

  // Read broadcast output to capture contract address
  const broadcastPath = resolve(contractsDir, 'broadcast/Deploy.s.sol/11155111/run-latest.json');
  if (existsSync(broadcastPath)) {
    const broadcastData = JSON.parse(readFileSync(broadcastPath, 'utf-8'));
    const contractReceipt = broadcastData.receipts?.find(r => r.contractAddress);
    const deployedAddress = contractReceipt?.contractAddress;

    if (deployedAddress) {
      console.log('\n====================================================');
      console.log(`✅ RotationController deployed at: ${deployedAddress}`);
      console.log(`🔍 Sepolia Etherscan: https://sepolia.etherscan.io/address/${deployedAddress}`);
      console.log('====================================================\n');

      // Update .env with contract address
      let updatedEnv = envContent;
      const addrRegex = /^ROTATION_CONTROLLER_ADDRESS=.*$/m;
      if (addrRegex.test(updatedEnv)) {
        updatedEnv = updatedEnv.replace(addrRegex, `ROTATION_CONTROLLER_ADDRESS=${deployedAddress}`);
      } else {
        updatedEnv += `\nROTATION_CONTROLLER_ADDRESS=${deployedAddress}`;
      }
      writeFileSync(envPath, updatedEnv, 'utf-8');
      console.log('✅ Updated ROTATION_CONTROLLER_ADDRESS in .env');
    }
  }
} catch (err) {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
}
