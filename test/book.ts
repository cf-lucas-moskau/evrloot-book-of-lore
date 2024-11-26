import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { BookOfLore, StrangePage, RMRKCatalogImpl, RMRKEquipRenderUtils } from '../typechain-types';
import {
  addPageAssets,
  configure,
  configureCatalog,
  deployBookOfLore,
  deployCatalog,
  deployRenderUtils,
  deployStrangePage,
  mintBook,
} from '../scripts/deploy-methods';
import * as C from '../scripts/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ZeroAddress } from 'ethers';

async function fixture(): Promise<{
  book: BookOfLore;
  page: StrangePage;
  catalog: RMRKCatalogImpl;
  renderUtils: RMRKEquipRenderUtils;
}> {
  const book = await deployBookOfLore();
  const page = await deployStrangePage();
  const catalog = await deployCatalog(C.CATALOG_METADATA_URI, C.CATALOG_TYPE);
  const renderUtils = await deployRenderUtils();

  await configureCatalog(catalog, await page.getAddress());
  await addPageAssets(page, await book.getAddress());
  await configure(book, page, catalog);

  return { book, page, catalog, renderUtils };
}

describe('Book of Lore', async () => {
  let book: BookOfLore;
  let page: StrangePage;
  let catalog: RMRKCatalogImpl;
  let renderUtils: RMRKEquipRenderUtils;
  let owner: SignerWithAddress;

  beforeEach(async function () {
    ({ book, page, catalog, renderUtils } = await loadFixture(fixture));
    [owner] = await ethers.getSigners();
  });

  it('can mint book with no pages', async function () {
    await mintBook(
      book,
      1n,
      owner.address,
      C.FIXED_PART_RIBBON_GREEN_PART_ID,
      C.FIXED_PART_RUNE_1A_PART_ID,
      C.FIXED_PART_RUNE_2A_PART_ID,
      C.FIXED_PART_RUNE_3A_PART_ID,
      C.FIXED_PART_TREE_BLUE_PART_ID,
      [],
    );
    expect(await book.ownerOf(1n)).to.equal(owner.address);
  });

  it('can mint book with pages', async function () {
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
        {
          number: 1,
          id: 1,
        },
        {
          number: 2,
          id: 1,
        },
        {
          number: 3,
          id: 1,
        },
      ],
    );
    expect(await book.ownerOf(1n)).to.equal(owner.address);
  });

  it('composes book as expected', async function () {
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
        {
          number: 1,
          id: 1,
        },
        {
          number: 3,
          id: 1,
        },
        {
          number: 5,
          id: 1,
        },
      ],
    );
    expect(await book.ownerOf(1n)).to.equal(owner.address);

    const compose = await renderUtils.composeEquippables(await book.getAddress(), 1n, 1n);

    expect(compose[0]).to.eql(C.BOOK_ASSET_METADATA_URI);

    // Fixed parts
    expect(compose[3]).to.eql([
      [
        C.FIXED_PART_RIBBON_GREEN_PART_ID,
        C.FIXED_PART_RIBBON_GREEN_Z_INDEX,
        C.FIXED_PART_RIBBON_GREEN_METADATA_URI,
      ],
      [
        C.FIXED_PART_RUNE_1A_PART_ID,
        C.FIXED_PART_RUNE_1A_Z_INDEX,
        C.FIXED_PART_RUNE_1A_METADATA_URI,
      ],
      [
        C.FIXED_PART_RUNE_2A_PART_ID,
        C.FIXED_PART_RUNE_2A_Z_INDEX,
        C.FIXED_PART_RUNE_2A_METADATA_URI,
      ],
      [
        C.FIXED_PART_RUNE_3A_PART_ID,
        C.FIXED_PART_RUNE_3A_Z_INDEX,
        C.FIXED_PART_RUNE_3A_METADATA_URI,
      ],
      [
        C.FIXED_PART_TREE_BLUE_PART_ID,
        C.FIXED_PART_TREE_BLUE_Z_INDEX,
        C.FIXED_PART_TREE_BLUE_METADATA_URI,
      ],
      [
        C.FIXED_PART_BOOK_BASE_PART_ID,
        C.FIXED_PART_BOOK_BASE_Z_INDEX,
        C.FIXED_PART_BOOK_BASE_METADATA_URI,
      ],
    ]);

    expect(compose[4][0]).to.eql([
      // Page 1
      C.SLOT_PART_PAGE_1_SLOT_ID, // partId
      1n, // childAssetId
      C.SLOT_PART_PAGE_1_Z_INDEX, // z index
      await page.getAddress(), // childAddress
      1n, // childId
      C.PAGE_1_METADATA_URI, // childAssetMetadata
      C.SLOT_PART_PAGE_1_METADATA_URI, // partMetadata
    ]);
    expect(compose[4][1]).to.eql([
      // Page 2 (empty)
      C.SLOT_PART_PAGE_2_SLOT_ID, // partId
      0n, // childAssetId
      C.SLOT_PART_PAGE_2_Z_INDEX, // z index
      ZeroAddress, // childAddress
      0n, // childId
      '', // childAssetMetadata
      C.SLOT_PART_PAGE_2_METADATA_URI, // partMetadata
    ]);
    expect(compose[4][2]).to.eql([
      // Page 3
      C.SLOT_PART_PAGE_3_SLOT_ID, // partId
      3n, // childAssetId
      C.SLOT_PART_PAGE_3_Z_INDEX, // z index
      await page.getAddress(), // childAddress
      2n, // childId
      C.PAGE_3_METADATA_URI, // childAssetMetadata
      C.SLOT_PART_PAGE_3_METADATA_URI, // partMetadata
    ]);
  });
});
