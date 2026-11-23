// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

/// @notice Testnet and test stand in for the Agent ID: non transferable, one token per owner, tokenId = keccak256(label).
/// @dev Anyone can mint or burn their own token. Never deploy on mainnet.
contract MockAgentID {
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) internal _owners;

    error Taken();
    error NotFound();

    /// @notice Mint the token for `label` to the caller.
    function mint(string calldata label) external {
        mintTo(msg.sender, label);
    }

    /// @notice Mint the token for `label` to `to` (tests and testnet faucet).
    function mintTo(address to, string calldata label) public {
        uint256 id = uint256(keccak256(bytes(label)));
        if (_owners[id] != address(0) || balanceOf[to] != 0) revert Taken();
        _owners[id] = to;
        balanceOf[to] = 1;
    }

    /// @notice Burn the caller's token for `label`.
    function burn(string calldata label) external {
        uint256 id = uint256(keccak256(bytes(label)));
        if (_owners[id] != msg.sender) revert NotFound();
        delete _owners[id];
        balanceOf[msg.sender] = 0;
    }

    /// @notice Owner of `tokenId`; reverts when it does not exist, like ERC721.
    function ownerOf(uint256 tokenId) external view returns (address o) {
        o = _owners[tokenId];
        if (o == address(0)) revert NotFound();
    }
}
