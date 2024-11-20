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

export async function deployBookOfLore(): Promise<BookOfLore> {
  console.log(`Deploying BookOfLore to ${network.name} blockchain...`);

  const contractFactory = await ethers.getContractFactory('BookOfLore');
  const args = [C.BOOK_METADATA_URL, 66n, C.BENEFICIARY_ADDRESS, 1500] as const;
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
  const args = [C.PAGE_METADATA_URL, 850n, C.BENEFICIARY_ADDRESS, 1500] as const;
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

export async function addBookAssets(book: BookOfLore) {}

export async function addPageAssets(page: StrangePage) {}

export async function configureCatalog(catalog: RMRKCatalogImpl, pageAddress: string) {}

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
