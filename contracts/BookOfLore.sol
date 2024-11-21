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

error OnlyNFTOwnerCanTransferTokensFromIt();
error ContractURIFrozen();
error ArraysLengthMismatch();

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
    uint256 private _contractURIFrozen; // Cheaper than a bool

    // Constructor
    constructor(
        string memory collectionMetadata,
        uint256 maxSupply,
        address royaltyRecipient,
        uint16 royaltyPercentageBps
    )
        RMRKImplementationBase(
            "BookOfLore",
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
        // This will revert if the token has not assets, only use if at least an asset is assigned on mint to every token
        return getAssetMetadata(tokenId, _activeAssets[tokenId][0]);
    }

    function batchMintWithAsset(
        uint256[] memory tokenIds,
        address[] memory tos,
        uint64[] memory assetIds,
        IStrangePage.Page[][] memory pages
    ) public virtual onlyOwnerOrContributor {
        uint256 length = tokenIds.length;
        if (
            length != tos.length ||
            length != assetIds.length ||
            length != pages.length
        ) {
            revert ArraysLengthMismatch();
        }
        _prepareMint(length);
        for (uint256 i = 0; i < length; ) {
            uint256 tokenId = tokenIds[i];
            uint64 bookAssetId = assetIds[i];
            _safeMint(tos[i], tokenId, "");
            _addAssetToToken(tokenId, bookAssetId, 0);
            _nestMintPagesAndEquip(tokenId, bookAssetId, pages[i]);
        }
    }

    function _nestMintPagesAndEquip(
        uint256 bookId,
        uint64 bookAssetId,
        IStrangePage.Page[] memory pages
    ) internal {
        uint256 length = pages.length;
        for (uint256 i; i < length; ) {
            IERC6220.IntakeEquip memory equipInfo = IERC6220.IntakeEquip({
                tokenId: bookId,
                childIndex: i,
                assetId: bookAssetId,
                slotPartId: pages[i].pageNumber,
                childAssetId: pages[i].pageNumber
            });
            _equip(equipInfo);
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
