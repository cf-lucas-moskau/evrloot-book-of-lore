import { ethers, network, run } from 'hardhat';
import { delay, isHardhatNetwork } from './utils';
import {
  RMRKBulkWriter,
  RMRKCatalogImpl,
  RMRKCatalogUtils,
  RMRKCollectionUtils,
  RMRKEquipRenderUtils,
  RMRKRoyaltiesSplitter,
  BookOfLore,
  StrangePage,
} from '../typechain-types';
import { getRegistry } from './get-registry';
import * as C from './constants';
import { ZeroAddress } from 'ethers';

interface Page {
  number: number;
  id: number;
}

interface Book {
  bookId: bigint;
  to: string;
  ribbon: number;
  rune1: number;
  rune2: number;
  rune3: number;
  tree: number;
  pages: Page[];
}

export async function deployBookOfLore(): Promise<BookOfLore> {
  console.log(`Deploying BookOfLore to ${network.name} blockchain...`);

  const contractFactory = await ethers.getContractFactory('BookOfLore');
  const args = [C.BOOK_COLLECTION_METADATA_URI, 66n, C.BENEFICIARY_ADDRESS, 1500] as const;
  const contract: BookOfLore = await contractFactory.deploy(...args);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`BookOfLore deployed to ${contractAddress}`);

  if (!isHardhatNetwork()) {
    console.log('Waiting 10 seconds before verifying contract...');
    await delay(10000);
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
      contract: 'contracts/BookOfLore.sol:BookOfLore',
    });

    // Only do on testing, or if whitelisted for production
    const registry = await getRegistry();
    await registry.addExternalCollection(contractAddress, args[0]);
    console.log('Collection added to Singular Registry');
  }
  return contract;
}

export async function deployStrangePage(): Promise<StrangePage> {
  console.log(`Deploying StrangePage to ${network.name} blockchain...`);

  const contractFactory = await ethers.getContractFactory('StrangePage');
  const args = [C.PAGE_COLLECTION_METADATA_URI, 850n, C.BENEFICIARY_ADDRESS, 1500] as const;
  const contract: StrangePage = await contractFactory.deploy(...args);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`StrangePage deployed to ${contractAddress}`);

  if (!isHardhatNetwork()) {
    console.log('Waiting 10 seconds before verifying contract...');
    await delay(10000);
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
      contract: 'contracts/StrangePage.sol:StrangePage',
    });

    // Only do on testing, or if whitelisted for production
    const registry = await getRegistry();
    await registry.addExternalCollection(contractAddress, args[0]);
    console.log('Collection added to Singular Registry');
  }
  return contract;
}

export async function configure(book: BookOfLore, page: StrangePage, catalog: RMRKCatalogImpl) {
  let tx = await book.setConfig(
    await page.getAddress(),
    await catalog.getAddress(),
    C.BOOK_ASSET_METADATA_URI,
    C.FIXED_PART_BOOK_BASE_PART_ID,
  );
  await tx.wait();

  tx = await page.setBookOfLore(await book.getAddress());
  await tx.wait();

  tx = await page.manageContributor(await book.getAddress(), true);
  await tx.wait();

  tx = await book.setAutoAcceptCollection(await page.getAddress(), true);
  await tx.wait();

  console.log('Configured Book+Page+Catalog');
}

export async function mintBook(
  book: BookOfLore,
  bookId: bigint,
  to: string,
  ribbon: bigint,
  rune1: bigint,
  rune2: bigint,
  rune3: bigint,
  tree: bigint,
  pages: Page[],
) {
  const tx = await book.mintWithParts(bookId, to, [ribbon, rune1, rune2, rune3, tree], pages);
  await tx.wait();
}

export async function batchMintBooks(book: BookOfLore, books: Book[]) {
  const batch_size = 5;
  for (let i = 0; i < books.length; i += batch_size) {
    const batch = books.slice(i, i + batch_size);
    const tx = await book.batchMintWithParts(
      batch.map((b) => b.bookId),
      batch.map((b) => b.to),
      batch.map((b) => [b.ribbon, b.rune1, b.rune2, b.rune3, b.tree]),
      batch.map((b) => b.pages),
    );
    await tx.wait();
    console.log(`Minted batch of books ${i + 1} to ${i + batch.length} of ${books.length}`);
  }
}

export async function mintPages(page: StrangePage, tos: string[], pages: Page[]) {
  const batch_size = 30;
  for (let i = 0; i < tos.length; i += batch_size) {
    const batch_tos = tos.slice(i, i + batch_size);
    const batch_pages = pages.slice(i, i + batch_size);

    const tx = await page.mintPages(batch_tos, batch_pages);
    await tx.wait();
    console.log(`Minted batch of pages ${i + 1} to ${i + batch_size} of ${tos.length}`);
  }
}

export async function addPageAssets(page: StrangePage, bookAddress: string) {
  for (let i = 0; i < C.ALL_PAGES.length; i++) {
    // We use part Id as equippable group Id for simplicity:
    const equippableGroupIdAndPartId = C.ALL_SLOT_PARTS_IDS[i];
    let tx = await page.addEquippableAssetEntry(
      equippableGroupIdAndPartId,
      ZeroAddress,
      C.ALL_PAGES[i],
      [],
    );
    await tx.wait();

    tx = await page.setValidParentForEquippableGroup(
      equippableGroupIdAndPartId,
      bookAddress,
      equippableGroupIdAndPartId,
    );
    await tx.wait();
  }
  console.log('Added all page assets to page');
}

export async function configureCatalog(catalog: RMRKCatalogImpl, pageAddress: string) {
  let tx = await catalog.addPartList(
    C.ALL_SLOT_PARTS.map((partUri, index) => ({
      partId: C.ALL_SLOT_PARTS_IDS[index],
      part: {
        itemType: C.PART_TYPE_SLOT,
        z: C.ALL_SLOT_PARTS_Z_INDICES[index],
        equippable: [pageAddress],
        metadataURI: partUri,
      },
    })),
  );
  await tx.wait();
  console.log('Added all slot parts to catalog');

  tx = await catalog.addPartList(
    C.ALL_FIXED_PARTS.map((partUri, index) => ({
      partId: C.ALL_FIXED_PARTS_IDS[index],
      part: {
        itemType: C.PART_TYPE_FIXED,
        z: C.ALL_FIXED_PARTS_Z_INDICES[index],
        equippable: [],
        metadataURI: partUri,
      },
    })),
  );
  await tx.wait();
  console.log('Added all fixed parts to catalog');
}

export async function deployBulkWriter(): Promise<RMRKBulkWriter> {
  const bulkWriterFactory = await ethers.getContractFactory('RMRKBulkWriter');
  const bulkWriter = await bulkWriterFactory.deploy();
  await bulkWriter.waitForDeployment();
  const bulkWriterAddress = await bulkWriter.getAddress();
  console.log('Bulk Writer deployed to:', bulkWriterAddress);

  await verifyIfNotHardhat(bulkWriterAddress);
  return bulkWriter;
}

export async function deployCatalogUtils(): Promise<RMRKCatalogUtils> {
  const catalogUtilsFactory = await ethers.getContractFactory('RMRKCatalogUtils');
  const catalogUtils = await catalogUtilsFactory.deploy();
  await catalogUtils.waitForDeployment();
  const catalogUtilsAddress = await catalogUtils.getAddress();
  console.log('Catalog Utils deployed to:', catalogUtilsAddress);

  await verifyIfNotHardhat(catalogUtilsAddress);
  return catalogUtils;
}

export async function deployCollectionUtils(): Promise<RMRKCollectionUtils> {
  const collectionUtilsFactory = await ethers.getContractFactory('RMRKCollectionUtils');
  const collectionUtils = await collectionUtilsFactory.deploy();
  await collectionUtils.waitForDeployment();
  const collectionUtilsAddress = await collectionUtils.getAddress();
  console.log('Collection Utils deployed to:', collectionUtilsAddress);

  await verifyIfNotHardhat(collectionUtilsAddress);
  return collectionUtils;
}

export async function deployRenderUtils(): Promise<RMRKEquipRenderUtils> {
  const renderUtilsFactory = await ethers.getContractFactory('RMRKEquipRenderUtils');
  const renderUtils = await renderUtilsFactory.deploy();
  await renderUtils.waitForDeployment();
  const renderUtilsAddress = await renderUtils.getAddress();
  console.log('Equip Render Utils deployed to:', renderUtilsAddress);

  await verifyIfNotHardhat(renderUtilsAddress);
  return renderUtils;
}

export async function deployCatalog(
  catalogMetadataUri: string,
  catalogType: string,
): Promise<RMRKCatalogImpl> {
  const catalogFactory = await ethers.getContractFactory('RMRKCatalogImpl');
  const catalog = await catalogFactory.deploy(catalogMetadataUri, catalogType);
  await catalog.waitForDeployment();
  const catalogAddress = await catalog.getAddress();
  console.log('Catalog deployed to:', catalogAddress);

  await verifyIfNotHardhat(catalogAddress, [catalogMetadataUri, catalogType]);
  return catalog;
}

export async function deployRoyaltiesSplitter(
  beneficiaries: string[],
  sharesBPS: number[],
): Promise<RMRKRoyaltiesSplitter> {
  const splitterFactory = await ethers.getContractFactory('RMRKRoyaltiesSplitter');
  const splitter = await splitterFactory.deploy(beneficiaries, sharesBPS);
  await splitter.waitForDeployment();
  const splitterAddress = await splitter.getAddress();
  console.log('RoyaltiesSplitter deployed to:', splitterAddress);

  await verifyIfNotHardhat(splitterAddress, [beneficiaries, sharesBPS]);
  return splitter;
}

async function verifyIfNotHardhat(contractAddress: string, args: any[] = []) {
  if (isHardhatNetwork()) {
    // Hardhat
    return;
  }

  // sleep 20s
  await delay(20000);

  console.log('Etherscan contract verification starting now.');
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (error) {
    // probably already verified
  }
}
