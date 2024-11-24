// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.21;

import {
    RMRKAbstractEquippable
} from "@rmrk-team/evm-contracts/contracts/implementations/abstract/RMRKAbstractEquippable.sol";
import {
    RMRKImplementationBase
} from "@rmrk-team/evm-contracts/contracts/implementations/utils/RMRKImplementationBase.sol";
import {
    RMRKTokenHolder
} from "@rmrk-team/evm-contracts/contracts/RMRK/extension/tokenHolder/RMRKTokenHolder.sol";
import {
    IERC6220
} from "@rmrk-team/evm-contracts/contracts/RMRK/equippable/IERC6220.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IStrangePage} from "./IStrangePage.sol";

error ArraysLengthMismatch();
error ContractURIFrozen();
error OnlyNFTOwnerCanTransferTokensFromIt();

contract BookOfLore is RMRKAbstractEquippable, RMRKTokenHolder {
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
    mapping(address => bool) private _autoAcceptCollection;
    IStrangePage private _pagesCollection;
    address private _catalog;
    string private _bookMetadataURI;
    uint256 private _contractURIFrozen; // Cheaper than a bool

    // Constructor
    constructor(
        string memory collectionMetadata,
        uint256 maxSupply,
        address royaltyRecipient,
        uint16 royaltyPercentageBps
    )
        RMRKImplementationBase(
            "Book of Lore",
            "EVRBOL",
            collectionMetadata,
            maxSupply,
            royaltyRecipient,
            royaltyPercentageBps
        )
    {}

    // Methods
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        _requireMinted(tokenId);
        return _bookMetadataURI;
    }

    function setConfig(
        address pagesCollection,
        address catalog,
        string memory bookMetadataURI
    ) external onlyOwner {
        _pagesCollection = IStrangePage(pagesCollection);
        _catalog = catalog;
        _bookMetadataURI = bookMetadataURI;
    }

    function getConfig()
        external
        view
        returns (
            address pagesCollection,
            address catalog,
            string memory bookMetadataURI
        )
    {
        pagesCollection = address(_pagesCollection);
        catalog = _catalog;
        bookMetadataURI = _bookMetadataURI;
    }

    function batchMintWithParts(
        uint256[] memory bookIds,
        address[] memory tos,
        uint64[][] memory fixedPartIds,
        IStrangePage.Page[][] memory pages
    ) public virtual onlyOwnerOrContributor {
        uint256 length = bookIds.length;
        if (
            length != tos.length ||
            length != fixedPartIds.length ||
            length != pages.length
        ) {
            revert ArraysLengthMismatch();
        }
        for (uint256 i; i < length; ) {
            mintWithParts(bookIds[i], tos[i], fixedPartIds[i], pages[i]);
            unchecked {
                ++i;
            }
        }
    }

    function mintWithParts(
        uint256 bookId,
        address to,
        uint64[] memory fixedPartIds,
        IStrangePage.Page[] memory pages
    ) public virtual onlyOwnerOrContributor {
        _prepareMint(1);
        uint64 bookAssetId = _addAssetWithFixedParts(fixedPartIds);
        _safeMint(to, bookId, "");
        _addAssetToToken(bookId, bookAssetId, 0);
        if (pages.length > 0) {
            _nestMintPagesAndEquip(bookId, bookAssetId, pages);
        }
    }

    function _addAssetWithFixedParts(
        uint64[] memory fixedPartIds
    ) internal returns (uint64 bookAssetId) {
        unchecked {
            ++_totalAssets;
        }

        uint64[] memory partIds = new uint64[](fixedPartIds.length + 10);
        uint256 length = fixedPartIds.length;
        for (uint256 i; i < length; ) {
            partIds[i] = fixedPartIds[i];
            unchecked {
                ++i;
            }
        }

        for (uint64 i; i < 10; ) {
            partIds[length + i] = 1001 + i;
            unchecked {
                ++i;
            }
        }

        _addAssetEntry(
            uint64(_totalAssets),
            1,
            _catalog,
            _bookMetadataURI,
            partIds
        );
        bookAssetId = uint64(_totalAssets);
    }

    function _nestMintPagesAndEquip(
        uint256 bookId,
        uint64 bookAssetId,
        IStrangePage.Page[] memory pages
    ) internal {
        _pagesCollection.nestMintPages(bookId, pages);
        uint256 length = pages.length;
        for (uint256 i; i < length; ) {
            IERC6220.IntakeEquip memory equipInfo = IERC6220.IntakeEquip({
                tokenId: bookId,
                childIndex: i,
                assetId: bookAssetId,
                slotPartId: pages[i].number + 1000, // Slot part ids start at 1001
                childAssetId: pages[i].number
            });
            /*  If failing, overwrite RMRK/equippable/RMRKMinifiedEquippable.sol to have an external and internal function to equip like this:
            function equip(
                IntakeEquip memory data
            ) public virtual onlyApprovedForAssetsOrOwner(data.tokenId) nonReentrant {
                _equip(data);
            }

            function _equip(
                IntakeEquip memory data
            ) internal virtual {
                // All code here
            } */
            _equip(equipInfo);
            unchecked {
                ++i;
            }
        }
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
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(RMRKTokenHolder, RMRKAbstractEquippable)
        returns (bool)
    {
        return
            RMRKAbstractEquippable.supportsInterface(interfaceId) ||
            RMRKTokenHolder.supportsInterface(interfaceId);
    }

    function transferHeldERC20FromToken(
        address erc20Contract,
        uint256 tokenHolderId,
        address to,
        uint256 amount,
        bytes memory data
    ) external {
        if (_msgSender() != ownerOf(tokenHolderId)) {
            revert OnlyNFTOwnerCanTransferTokensFromIt();
        }
        _transferHeldERC20FromToken(
            erc20Contract,
            tokenHolderId,
            to,
            amount,
            data
        );
    }

    function setAutoAcceptCollection(
        address collection,
        bool autoAccept
    ) public virtual onlyOwnerOrContributor {
        _autoAcceptCollection[collection] = autoAccept;
    }

    function _afterAddChild(
        uint256 tokenId,
        address childAddress,
        uint256 childId,
        bytes memory
    ) internal virtual override {
        // Auto accept children if they are from known collections
        if (_autoAcceptCollection[childAddress]) {
            _acceptChild(
                tokenId,
                _pendingChildren[tokenId].length - 1,
                childAddress,
                childId
            );
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
