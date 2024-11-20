import { deployBookOfLore, deployStrangePage } from './deploy-methods';

async function main() {
  await deployBookOfLore();
  await deployStrangePage();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
