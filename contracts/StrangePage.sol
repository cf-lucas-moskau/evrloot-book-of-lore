// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.21;

import {
    RMRKAbstractEquippable
} from "@rmrk-team/evm-contracts/contracts/implementations/abstract/RMRKAbstractEquippable.sol";
import {
    RMRKImplementationBase
} from "@rmrk-team/evm-contracts/contracts/implementations/utils/RMRKImplementationBase.sol";
import {IStrangePage} from "./IStrangePage.sol";

error ArraysLengthMismatch();
error ContractURIFrozen();
error PageAlreadyMinted(uint8 pageNumber, uint8 pageId, uint256 pageTokenId);

contract StrangePage is RMRKAbstractEquippable, IStrangePage {
    // Events
    /**
     * @notice From ERC4906 This event emits when the metadata of a token is changed.
     *  So that the third-party platforms such as NFT market could
     *  get notified when the metadata of a token is changed.
     */
    event MetadataUpdate(uint256 _tokenId);

    /**
     * @notice From ERC7572 (Draft) Emitted when the contract-level metadata is updated
     */
    event ContractURIUpdated();

    // Variables
    uint256 private _contractURIFrozen; // Cheaper than a bool
    address private _bookOfLore;
    mapping(uint256 tokenId => Page page) private _tokenIdToPage;
    mapping(uint16 pageNumberAndId => uint256 tokenId) private _pageToTokenId;

    // Constructor
    constructor(
        string memory collectionMetadata,
        uint256 maxSupply,
        address royaltyRecipient,
        uint16 royaltyPercentageBps
    )
        RMRKImplementationBase(
            "StrangePage",
            "EVRSP",
            collectionMetadata,
            maxSupply,
            royaltyRecipient,
            royaltyPercentageBps
        )
    {}

    // Methods
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        _requireMinted(tokenId);
        // This will revert if the token has not assets, only use if at least an asset is assigned on mint to every token
        return getAssetMetadata(tokenId, _activeAssets[tokenId][0]);
    }

    function setBookOfLore(address bookOfLore_) external onlyOwner {
        _bookOfLore = bookOfLore_;
    }

    function getBookOfLore() external view returns (address) {
        return _bookOfLore;
    }

    function getTokenIdFromPage(
        uint8 pageNumber,
        uint8 pageId
    ) external view returns (uint256) {
        return _pageToTokenId[(uint16(pageNumber) << 8) | pageId];
    }

    function getPageFromTokenId(
        uint256 tokenId
    ) external view returns (Page memory) {
        return _tokenIdToPage[tokenId];
    }

    function nestMintPages(
        uint256 bookId,
        Page[] memory pages
    ) external onlyOwnerOrContributor returns (uint256 firstId) {
        uint256 offset;
        (firstId, offset) = _prepareMint(pages.length);

        for (uint256 tokenId = firstId; tokenId < offset; ) {
            Page memory page = pages[tokenId - firstId];
            _nestMint(_bookOfLore, tokenId, bookId, "");
            _checkPageNotMintedAndStore(tokenId, page);
            _addAssetToToken(tokenId, page.number, 0);

            unchecked {
                ++tokenId;
            }
        }
    }

    function mintPages(
        address[] memory tos,
        Page[] memory pages
    ) external onlyOwnerOrContributor returns (uint256 firstId) {
        uint256 length = tos.length;
        if (length != pages.length) {
            revert ArraysLengthMismatch();
        }
        uint256 offset;
        (firstId, offset) = _prepareMint(pages.length);

        for (uint256 tokenId = firstId; tokenId < offset; ) {
            Page memory page = pages[tokenId - firstId];
            _safeMint(_bookOfLore, tokenId, "");
            _checkPageNotMintedAndStore(tokenId, page);
            _addAssetToToken(tokenId, page.number, 0);

            unchecked {
                ++tokenId;
            }
        }
    }

    /* This is to prevent erreoneous minting of the same page when migrating */
    function _checkPageNotMintedAndStore(
        uint256 tokenId,
        Page memory page
    ) internal {
        uint16 pageNumberAndId = (uint16(page.number) << 8) | page.id;
        uint256 pageTokenId = _pageToTokenId[pageNumberAndId];
        if (pageTokenId != 0) {
            revert PageAlreadyMinted(page.number, page.id, pageTokenId);
        }
        _pageToTokenId[pageNumberAndId] = tokenId;
        _tokenIdToPage[tokenId] = page;
    }

    /**
     * @notice Hook that is called after an asset is accepted to a token's active assets array.
     * @param tokenId ID of the token for which the asset has been accepted
     * @param index Index of the asset in the token's pending assets array
     * @param assetId ID of the asset expected to have been located at the specified index
     * @param replacedAssetId ID of the asset that has been replaced by the accepted asset
     */
    function _afterAcceptAsset(
        uint256 tokenId,
        uint256 index,
        uint64 assetId,
        uint64 replacedAssetId
    ) internal virtual override {
        if (replacedAssetId != 0) {
            emit MetadataUpdate(tokenId);
        }
    }

    /**
     * @notice Used to get whether the contract-level metadata is frozen and cannot be further updated.
     * @return isFrozen Whether the contract-level metadata is frozen
     */
    function isContractURIFrozen() external view returns (bool isFrozen) {
        isFrozen = _contractURIFrozen == 1;
    }

    /**
     * @notice Freezes the contract-level metadata, so it cannot be further updated.
     */
    function freezeContractURI() external onlyOwner {
        _contractURIFrozen = 1;
    }

    /**
     * @notice Sets the contract-level metadata URI to a new value and emits an event.
     * @param contractURI_ The new contract-level metadata URI
     */
    function setContractURI(string memory contractURI_) external onlyOwner {
        if (_contractURIFrozen == 1) {
            revert ContractURIFrozen();
        }
        _contractURI = contractURI_;
        emit ContractURIUpdated();
    }
}
