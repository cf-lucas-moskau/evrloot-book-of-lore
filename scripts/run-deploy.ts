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

  await mintBook(
    book,
    1n,
    owner.address,
    C.FIXED_PART_RIBBON_GREEN_PART_ID,
    C.FIXED_PART_RUNE_1A_PART_ID,
    C.FIXED_PART_RUNE_2A_PART_ID,
    C.FIXED_PART_RUNE_3A_PART_ID,
    C.FIXED_PART_TREE_BLUE_PART_ID,
    [
      { number: 1, id: 22 },
      { number: 2, id: 10 },
      { number: 3, id: 1 },
      { number: 4, id: 17 },
      { number: 5, id: 23 },
      { number: 6, id: 35 },
      { number: 7, id: 4 },
      { number: 8, id: 2 },
      { number: 9, id: 62 },
      { number: 10, id: 8 },
    ],
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
