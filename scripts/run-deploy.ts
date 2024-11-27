import {
  addPageAssets,
  configure,
  configureCatalog,
  deployBookOfLore,
  deployCatalog,
  deployStrangePage,
  mintBook,
} from './deploy-methods';
import * as C from './constants';
import { ethers } from 'hardhat';

async function main() {
  const [owner] = await ethers.getSigners();
  const book = await deployBookOfLore();
  const page = await deployStrangePage();
  const catalog = await deployCatalog(C.CATALOG_METADATA_URI, C.CATALOG_TYPE);

  await configureCatalog(catalog, await page.getAddress());
  await addPageAssets(page, await book.getAddress());
  await configure(book, page, catalog);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
